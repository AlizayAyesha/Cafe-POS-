import { InventoryTxnType, type Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { ForbiddenError, ValidationError } from "@/core/errors";
import { hasMinRole } from "@/core/permissions";
import { recordStockMovement } from "@/modules/inventory/application/stock-movements";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";

type Actor = { id: string; role: Role };

export type AdjustStockInput =
  | { itemId: string; type: "ADD"; quantity: number; reason?: string }
  | { itemId: string; type: "REDUCE"; quantity: number; reason?: string }
  | {
      itemId: string;
      type: "ADJUST";
      newQuantity: number;
      reason?: string;
    }
  | { itemId: string; type: "WASTAGE"; quantity: number; reason?: string };

/**
 * Supervisor inventory adjustment — always writes InventoryTransaction ledger.
 * Never overwrite InventoryItem.quantity from the UI without going through this.
 */
export async function adjustStock(actor: Actor, input: AdjustStockInput) {
  if (!hasMinRole(actor.role, "SUPERVISOR")) throw new ForbiddenError();

  await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: input.itemId },
    });
    if (!item) throw new ValidationError("Inventory item not found");
    const current = Number(item.quantity);

    if (input.type === "ADD") {
      if (input.quantity <= 0) throw new ValidationError("Quantity must be positive");
      await recordStockMovement(tx, {
        itemId: item.id,
        type: InventoryTxnType.ADD,
        quantity: input.quantity,
        outbound: false,
        userId: actor.id,
        reason: input.reason || "Manual add",
      });
    } else if (input.type === "REDUCE" || input.type === "WASTAGE") {
      if (input.quantity <= 0) throw new ValidationError("Quantity must be positive");
      await recordStockMovement(tx, {
        itemId: item.id,
        type:
          input.type === "WASTAGE"
            ? InventoryTxnType.WASTAGE
            : InventoryTxnType.REDUCE,
        quantity: input.quantity,
        outbound: true,
        userId: actor.id,
        reason: input.reason || (input.type === "WASTAGE" ? "Wastage" : "Manual reduce"),
      });
    } else {
      if (input.newQuantity < 0) {
        throw new ValidationError("newQuantity cannot be negative");
      }
      const delta = input.newQuantity - current;
      if (delta === 0) return;
      await recordStockMovement(tx, {
        itemId: item.id,
        type: InventoryTxnType.ADJUST,
        quantity: Math.abs(delta),
        outbound: delta < 0,
        userId: actor.id,
        reason: input.reason || `Set to ${input.newQuantity} (was ${current})`,
      });
    }
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.INVENTORY_ADJUSTED,
    entityType: "InventoryItem",
    entityId: input.itemId,
    details: JSON.stringify(input),
  });
}
