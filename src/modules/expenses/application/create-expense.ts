import type { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { ForbiddenError, ValidationError } from "@/core/errors";
import { hasMinRole } from "@/core/permissions";
import { fromRupees, toRupees } from "@/core/money";
import { recordCashMovement } from "@/modules/cash/application/cash-movements";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";

type Actor = { id: string; role: Role };

export type CreateExpenseInput = {
  category: string;
  amountRupees: number;
  description?: string | null;
  paidAt?: Date;
  /** When true (default), deduct from open register cash ledger if one exists */
  payFromDrawer?: boolean;
};

/**
 * Record an expense. Cash expenses reduce the open register via CashMovement.
 */
export async function createExpense(actor: Actor, input: CreateExpenseInput) {
  if (!hasMinRole(actor.role, "SUPERVISOR")) throw new ForbiddenError();
  const category = input.category.trim();
  if (!category) throw new ValidationError("Category required");
  if (!(input.amountRupees > 0)) throw new ValidationError("Amount must be positive");

  const amount = toRupees(fromRupees(input.amountRupees));
  const payFromDrawer = input.payFromDrawer !== false;

  const row = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        category,
        description: input.description?.trim() || null,
        amount,
        paidAt: input.paidAt || new Date(),
        userId: actor.id,
      },
    });

    if (payFromDrawer) {
      const reg = await tx.registerSession.findFirst({
        where: { status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });
      if (reg) {
        await recordCashMovement(tx, {
          registerSessionId: reg.id,
          type: "EXPENSE",
          amountRupees: -amount,
          userId: actor.id,
          note: `${category}: ${expense.id}`,
        });
      }
    }

    return expense;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.EXPENSE_CREATED,
    entityType: "Expense",
    entityId: row.id,
    details: `${category} ${amount}`,
  });

  return row;
}
