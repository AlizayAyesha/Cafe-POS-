import type { TxClient } from "@/core/database";
import type { InventoryTxnType } from "@prisma/client";

/** Stock ledger write — quantity on InventoryItem is a projection updated with the movement. */
export async function recordStockMovement(
  tx: TxClient,
  input: {
    itemId: string;
    type: InventoryTxnType;
    /** Absolute quantity moved (always positive); direction inferred from type */
    quantity: number;
    userId?: string | null;
    orderId?: string | null;
    reason?: string | null;
    /** If true, decrease on-hand; if false, increase */
    outbound: boolean;
  }
) {
  const qty = input.quantity;
  if (qty <= 0) return;

  await tx.inventoryItem.update({
    where: { id: input.itemId },
    data: {
      quantity: input.outbound ? { decrement: qty } : { increment: qty },
    },
  });

  await tx.inventoryTransaction.create({
    data: {
      itemId: input.itemId,
      type: input.type,
      quantity: qty,
      reason: input.reason || null,
      userId: input.userId || null,
      orderId: input.orderId || null,
    },
  });
}
