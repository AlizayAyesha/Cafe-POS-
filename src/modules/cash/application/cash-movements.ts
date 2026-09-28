import type { TxClient } from "@/core/database";
import { fromRupees, toRupees, type Money } from "@/core/money";
import type { CashMovementType } from "@prisma/client";

/** Record a cash drawer ledger entry inside an existing DB transaction. */
export async function recordCashMovement(
  tx: TxClient,
  input: {
    registerSessionId: string;
    type: CashMovementType;
    /** Rupees; positive = into drawer */
    amountRupees: number;
    userId?: string | null;
    orderId?: string | null;
    note?: string | null;
  }
) {
  const paisa: Money = fromRupees(input.amountRupees);
  return tx.cashMovement.create({
    data: {
      registerSessionId: input.registerSessionId,
      type: input.type,
      amount: toRupees(paisa),
      userId: input.userId || null,
      orderId: input.orderId || null,
      note: input.note || null,
    },
  });
}

export async function sumCashInDrawer(
  tx: TxClient,
  registerSessionId: string
): Promise<number> {
  const rows = await tx.cashMovement.findMany({
    where: { registerSessionId },
    select: { amount: true },
  });
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}
