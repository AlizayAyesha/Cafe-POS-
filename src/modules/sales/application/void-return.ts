import { InventoryTxnType, type Role } from "@prisma/client";
import { prisma, type TxClient } from "@/core/database";
import { ForbiddenError, NotFoundError, ValidationError } from "@/core/errors";
import { canVoidSales } from "@/core/permissions";
import { assertOrderTransition } from "@/modules/sales/domain/order-status";
import { recordStockMovement } from "@/modules/inventory/application/stock-movements";
import { recordCashMovement } from "@/modules/cash/application/cash-movements";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";
import { fromRupees, toRupees, addMoney, type Money } from "@/core/money";

type Actor = { id: string; role: Role };

async function restoreGiftCards(
  tx: TxClient,
  orderId: string,
  userId: string,
  note: string
) {
  const payments = await tx.payment.findMany({
    where: { orderId, method: "GIFT_CARD", giftCardId: { not: null } },
  });
  for (const p of payments) {
    if (!p.giftCardId) continue;
    const card = await tx.giftCard.findUnique({ where: { id: p.giftCardId } });
    if (!card) continue;
    const next = toRupees(
      addMoney(fromRupees(Number(card.balance)), fromRupees(Number(p.amount)))
    );
    await tx.giftCard.update({
      where: { id: p.giftCardId },
      data: { balance: next },
    });
    await tx.giftCardTransaction.create({
      data: {
        giftCardId: p.giftCardId,
        type: "REFUND",
        amount: Number(p.amount),
        balanceAfter: next,
        orderId,
        userId,
        note,
      },
    });
  }
}

async function restoreStockAndCash(
  tx: TxClient,
  order: {
    id: string;
    orderNumber: string;
    registerSessionId: string | null;
    items: { productId: string | null; quantity: number }[];
    payments: { method: string; amount: unknown }[];
  },
  actorId: string,
  stockType: "VOID" | "RETURN",
  reason: string
) {
  await restoreGiftCards(tx, order.id, actorId, reason);

  for (const item of order.items) {
    if (!item.productId) continue;
    const product = await tx.product.findUnique({
      where: { id: item.productId },
    });
    if (!product?.trackInventory || !product.inventoryItemId) continue;
    await recordStockMovement(tx, {
      itemId: product.inventoryItemId,
      type:
        stockType === "VOID" ? InventoryTxnType.VOID : InventoryTxnType.RETURN,
      quantity: item.quantity,
      outbound: false,
      userId: actorId,
      orderId: order.id,
      reason,
    });
  }

  if (order.registerSessionId) {
    let cashOut: Money = 0;
    for (const p of order.payments) {
      if (p.method === "CASH") {
        cashOut = addMoney(cashOut, fromRupees(Number(p.amount)));
      }
    }
    if (cashOut > 0) {
      await recordCashMovement(tx, {
        registerSessionId: order.registerSessionId,
        type: "REFUND",
        amountRupees: -toRupees(cashOut),
        userId: actorId,
        orderId: order.id,
        note: reason,
      });
    }
  }
}

export async function voidSale(actor: Actor, orderId: string, reason: string) {
  if (!canVoidSales(actor.role)) throw new ForbiddenError();
  if (!reason.trim()) throw new ValidationError("Void reason required");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  assertOrderTransition(order.status, "VOIDED");

  await prisma.$transaction(async (tx) => {
    await restoreStockAndCash(
      tx,
      order,
      actor.id,
      "VOID",
      `Void ${order.orderNumber}: ${reason}`
    );
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "VOIDED",
        voidReason: reason.trim(),
        voidedById: actor.id,
      },
    });
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.ORDER_VOIDED,
    entityType: "Order",
    entityId: orderId,
    details: reason,
  });
}

export async function returnSale(actor: Actor, orderId: string, reason: string) {
  if (!canVoidSales(actor.role)) throw new ForbiddenError();
  if (!reason.trim()) throw new ValidationError("Return reason required");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  assertOrderTransition(order.status, "RETURNED");

  await prisma.$transaction(async (tx) => {
    await restoreStockAndCash(
      tx,
      order,
      actor.id,
      "RETURN",
      `Return ${order.orderNumber}: ${reason}`
    );
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "RETURNED",
        voidReason: reason.trim(),
        voidedById: actor.id,
      },
    });
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.ORDER_RETURNED,
    entityType: "Order",
    entityId: orderId,
    details: reason,
  });
}
