import type { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { ForbiddenError, ValidationError, ConflictError } from "@/core/errors";
import { canCloseRegister, hasMinRole } from "@/core/permissions";
import { recordCashMovement, sumCashInDrawer } from "@/modules/cash/application/cash-movements";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";
import { fromRupees, toRupees } from "@/core/money";

type Actor = { id: string; role: Role };

export async function openRegister(
  actor: Actor,
  openingFloatRupees: number,
  notes?: string
) {
  if (!hasMinRole(actor.role, "CASHIER")) throw new ForbiddenError();
  const existing = await prisma.registerSession.findFirst({
    where: { status: "OPEN" },
  });
  if (existing) throw new ConflictError("A register is already open");

  const reg = await prisma.$transaction(async (tx) => {
    const created = await tx.registerSession.create({
      data: {
        openedById: actor.id,
        openingFloat: openingFloatRupees,
        notes: notes || null,
        status: "OPEN",
      },
    });
    await recordCashMovement(tx, {
      registerSessionId: created.id,
      type: "OPENING_FLOAT",
      amountRupees: openingFloatRupees,
      userId: actor.id,
      note: "Opening float",
    });
    return created;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.REGISTER_OPENED,
    entityType: "RegisterSession",
    entityId: reg.id,
    details: `Float ${openingFloatRupees}`,
  });

  return reg;
}

export async function closeRegister(
  actor: Actor,
  countedCashRupees: number,
  notes?: string
) {
  if (!canCloseRegister(actor.role)) throw new ForbiddenError();
  const reg = await prisma.registerSession.findFirst({
    where: { status: "OPEN" },
  });
  if (!reg) throw new ValidationError("No open register");

  const closed = await prisma.$transaction(async (tx) => {
    const expected = await sumCashInDrawer(tx, reg.id);
    const variance = countedCashRupees - expected;
    const updated = await tx.registerSession.update({
      where: { id: reg.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: actor.id,
        closingCounted: countedCashRupees,
        expectedCash: expected,
        variance,
        notes: notes || reg.notes,
      },
    });
    await recordCashMovement(tx, {
      registerSessionId: reg.id,
      type: "CLOSING",
      amountRupees: 0,
      userId: actor.id,
      note: `Counted ${countedCashRupees}, expected ${expected}, variance ${variance}`,
    });
    return updated;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.REGISTER_CLOSED,
    entityType: "RegisterSession",
    entityId: closed.id,
    details: `Counted ${countedCashRupees}`,
  });

  return closed;
}

export async function getOpenRegister() {
  return prisma.registerSession.findFirst({
    where: { status: "OPEN" },
    include: { openedBy: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
  });
}

/** Expected cash from ledger (not ad-hoc dashboard math). */
export async function getExpectedCash(registerSessionId: string) {
  return prisma.$transaction(async (tx) => sumCashInDrawer(tx, registerSessionId));
}

export function floatToDisplay(rupees: number) {
  return toRupees(fromRupees(rupees));
}
