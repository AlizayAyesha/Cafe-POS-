import type { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/core/errors";
import { hasMinRole } from "@/core/permissions";
import { fromRupees, toRupees, addMoney } from "@/core/money";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";

type Actor = { id: string; role: Role };

function generateGiftCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TIS-${part()}-${part()}`;
}

export type IssueGiftCardInput = {
  customerId: string;
  amountRupees: number;
  code?: string | null;
  notes?: string | null;
  expiresAt?: Date | null;
};

export async function issueGiftCard(actor: Actor, input: IssueGiftCardInput) {
  if (!hasMinRole(actor.role, "SUPERVISOR")) throw new ForbiddenError();
  if (!input.customerId) throw new ValidationError("Select a repeat customer");
  if (!(input.amountRupees > 0)) {
    throw new ValidationError("Initial balance must be greater than 0");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!customer || !customer.active) throw new NotFoundError("Customer not found");

  const code = (input.code || "").trim().toUpperCase() || generateGiftCode();
  const amount = toRupees(fromRupees(input.amountRupees));

  const existing = await prisma.giftCard.findUnique({ where: { code } });
  if (existing) throw new ConflictError("Gift card code already exists");

  const card = await prisma.$transaction(async (tx) => {
    const created = await tx.giftCard.create({
      data: {
        code,
        customerId: input.customerId,
        balance: amount,
        notes: input.notes || null,
        issuedById: actor.id,
        expiresAt: input.expiresAt || null,
      },
    });
    await tx.giftCardTransaction.create({
      data: {
        giftCardId: created.id,
        type: "ISSUE",
        amount,
        balanceAfter: amount,
        userId: actor.id,
        note: input.notes || null,
      },
    });
    return created;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.GIFTCARD_ISSUE,
    entityType: "GiftCard",
    entityId: card.id,
    details: `${code} → ${customer.name} ${amount}`,
  });

  return card;
}

export type ReloadGiftCardInput = {
  giftCardId: string;
  amountRupees: number;
  note?: string | null;
};

export async function reloadGiftCard(actor: Actor, input: ReloadGiftCardInput) {
  if (!hasMinRole(actor.role, "SUPERVISOR")) throw new ForbiddenError();
  if (!(input.amountRupees > 0)) throw new ValidationError("Amount required");

  const amount = toRupees(fromRupees(input.amountRupees));

  const card = await prisma.$transaction(async (tx) => {
    const current = await tx.giftCard.findUnique({
      where: { id: input.giftCardId },
    });
    if (!current) throw new NotFoundError("Gift card not found");
    if (!current.active) throw new ValidationError("Gift card is inactive");

    const next = toRupees(
      addMoney(fromRupees(Number(current.balance)), fromRupees(amount))
    );
    const updated = await tx.giftCard.update({
      where: { id: input.giftCardId },
      data: { balance: next },
    });
    await tx.giftCardTransaction.create({
      data: {
        giftCardId: input.giftCardId,
        type: "RELOAD",
        amount,
        balanceAfter: next,
        userId: actor.id,
        note: input.note || null,
      },
    });
    return updated;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.GIFTCARD_RELOAD,
    entityType: "GiftCard",
    entityId: input.giftCardId,
    details: String(amount),
  });

  return card;
}

export async function setGiftCardActive(
  actor: Actor,
  giftCardId: string,
  active: boolean
) {
  if (!hasMinRole(actor.role, "SUPERVISOR")) throw new ForbiddenError();
  const card = await prisma.giftCard.update({
    where: { id: giftCardId },
    data: { active },
  });
  await recordAudit({
    userId: actor.id,
    action: active
      ? AuditActions.GIFTCARD_ACTIVATED
      : AuditActions.GIFTCARD_DEACTIVATED,
    entityType: "GiftCard",
    entityId: giftCardId,
    details: active ? "activated" : "deactivated",
  });
  return card;
}
