import { InventoryTxnType, type Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/core/database";
import { ForbiddenError, ValidationError } from "@/core/errors";
import { hasMinRole } from "@/core/permissions";
import { fromRupees, toRupees } from "@/core/money";
import { recordStockMovement } from "@/modules/inventory/application/stock-movements";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";

type Actor = { id: string; role: Role };

export const receiveStockSchema = z.object({
  supplierId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string(),
        quantity: z.number().positive(),
        unitCost: z.number().min(0).default(0),
      })
    )
    .min(1),
});

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

/** Supplier receiving — creates Receiving + stock-in ledger rows atomically. */
export async function receiveStock(actor: Actor, raw: ReceiveStockInput) {
  if (!hasMinRole(actor.role, "SUPERVISOR")) throw new ForbiddenError();
  const data = receiveStockSchema.parse(raw);

  const totalPaisa = data.items.reduce((sum, i) => {
    return sum + fromRupees(i.quantity * i.unitCost);
  }, 0);

  const receiving = await prisma.$transaction(async (tx) => {
    const rec = await tx.receiving.create({
      data: {
        supplierId: data.supplierId || null,
        reference: data.reference || null,
        notes: data.notes || null,
        userId: actor.id,
        totalCost: toRupees(totalPaisa),
        items: {
          create: data.items.map((i) => ({
            inventoryItemId: i.inventoryItemId,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
        },
      },
    });

    for (const i of data.items) {
      const item = await tx.inventoryItem.findUnique({
        where: { id: i.inventoryItemId },
      });
      if (!item) {
        throw new ValidationError(`Unknown inventory item ${i.inventoryItemId}`);
      }
      await recordStockMovement(tx, {
        itemId: i.inventoryItemId,
        type: InventoryTxnType.RECEIVE,
        quantity: i.quantity,
        outbound: false,
        userId: actor.id,
        reason: `Receiving ${rec.id}${data.reference ? ` (${data.reference})` : ""}`,
      });
    }
    return rec;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.STOCK_RECEIVED,
    entityType: "Receiving",
    entityId: receiving.id,
  });

  return receiving;
}
