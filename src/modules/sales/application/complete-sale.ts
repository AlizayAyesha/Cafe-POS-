import {
  DiscountType,
  InventoryTxnType,
  OrderType,
  PaymentMethod,
  type Role,
} from "@prisma/client";
import { z } from "zod";
import { prisma, type TxClient } from "@/core/database";
import {
  addMoney,
  fromRupees,
  moneyEqual,
  mulQty,
  percentOf,
  subMoney,
  toRupees,
  type Money,
} from "@/core/money";
import { ForbiddenError, ValidationError, ConflictError } from "@/core/errors";
import { hasMinRole } from "@/core/permissions";
import { assertOrderTransition } from "@/modules/sales/domain/order-status";
import { recordStockMovement } from "@/modules/inventory/application/stock-movements";
import { recordCashMovement } from "@/modules/cash/application/cash-movements";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";
import { nextOrderNumber } from "@/lib/orders";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().max(200).optional(),
});

const paymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().positive(),
  giftCardCode: z.string().optional().nullable(),
});

export const completeSaleInputSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  notes: z.string().max(500).optional(),
  payments: z.array(paymentSchema).min(1),
  orderType: z.nativeEnum(OrderType).default(OrderType.TAKEAWAY),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.NONE),
  discountValue: z.number().min(0).default(0),
  customerId: z.string().optional().nullable(),
  heldOrderId: z.string().optional().nullable(),
});

export type CompleteSaleInput = z.input<typeof completeSaleInputSchema>;

export type Actor = { id: string; role: Role };

function calcDiscountPaisa(
  subtotal: Money,
  discountType: DiscountType,
  discountValue: number
): Money {
  if (discountType === DiscountType.PERCENT) {
    return percentOf(subtotal, discountValue);
  }
  if (discountType === DiscountType.FIXED) {
    const fixed = fromRupees(discountValue);
    return fixed > subtotal ? subtotal : fixed;
  }
  return 0;
}

/**
 * CompleteSale — authoritative transactional use case.
 * UI must not implement these rules; it only collects input and displays results.
 */
export async function completeSale(actor: Actor, raw: CompleteSaleInput) {
  if (!hasMinRole(actor.role, "CASHIER")) {
    throw new ForbiddenError("Cashier role required to complete a sale");
  }

  const data = completeSaleInputSchema.parse(raw);

  const register = await prisma.registerSession.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  if (!register) {
    throw new ValidationError("Open the cash register before completing a sale");
  }

  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      inventoryItem: true,
      kitItems: {
        include: { componentProduct: { include: { inventoryItem: true } } },
      },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  type Line = {
    productId: string;
    productName: string;
    unitPaisa: Money;
    quantity: number;
    linePaisa: Money;
    notes: string | null;
    trackInventory: boolean;
    inventoryItemId: string | null;
    kitItems: (typeof products)[0]["kitItems"];
  };

  const lineItems: Line[] = data.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) {
      throw new ValidationError(`Product unavailable: ${item.productId}`);
    }
    if (product.trackInventory && product.inventoryItem) {
      const qty = Number(product.inventoryItem.quantity);
      if (qty < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for ${product.name} (have ${qty})`
        );
      }
    }
    const unitPaisa = fromRupees(Number(product.price));
    const linePaisa = mulQty(unitPaisa, item.quantity);
    return {
      productId: product.id,
      productName: product.name,
      unitPaisa,
      quantity: item.quantity,
      linePaisa,
      notes: item.notes || null,
      trackInventory: product.trackInventory,
      inventoryItemId: product.inventoryItemId,
      kitItems: product.kitItems,
    };
  });

  const subtotalPaisa = addMoney(...lineItems.map((l) => l.linePaisa));
  const discountPaisa = calcDiscountPaisa(
    subtotalPaisa,
    data.discountType,
    data.discountValue
  );
  const totalPaisa = subMoney(subtotalPaisa, discountPaisa);

  const paidPaisa = addMoney(
    ...data.payments.map((p) => fromRupees(p.amount))
  );
  if (!moneyEqual(paidPaisa, totalPaisa)) {
    throw new ValidationError(
      `Payments (${toRupees(paidPaisa)}) must equal total (${toRupees(totalPaisa)})`
    );
  }

  // Resolve gift cards
  let saleCustomerId = data.customerId || null;
  const giftPayments: {
    amountPaisa: Money;
    giftCardId: string;
    giftCardCode: string;
  }[] = [];

  for (const p of data.payments) {
    if (p.method !== PaymentMethod.GIFT_CARD) continue;
    const code = (p.giftCardCode || "").trim().toUpperCase();
    if (!code) throw new ValidationError("Gift card code required");
    const card = await prisma.giftCard.findUnique({
      where: { code },
      include: { customer: true },
    });
    if (!card || !card.active) {
      throw new ValidationError(`Gift card ${code} not found or inactive`);
    }
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new ValidationError(`Gift card ${code} has expired`);
    }
    const amt = fromRupees(p.amount);
    if (fromRupees(Number(card.balance)) < amt) {
      throw new ValidationError(`Gift card ${code} has insufficient balance`);
    }
    if (!saleCustomerId) saleCustomerId = card.customerId;
    else if (saleCustomerId !== card.customerId) {
      throw new ValidationError(
        `Gift card ${code} belongs to ${card.customer.name}`
      );
    }
    giftPayments.push({
      amountPaisa: amt,
      giftCardId: card.id,
      giftCardCode: code,
    });
  }

  let orderNumber: string;
  if (data.heldOrderId) {
    const held = await prisma.order.findUniqueOrThrow({
      where: { id: data.heldOrderId },
    });
    assertOrderTransition(held.status, "COMPLETED");
    orderNumber = held.orderNumber;
  } else {
    orderNumber = await nextOrderNumber();
  }

  const order = await prisma.$transaction(async (tx: TxClient) => {
    if (data.heldOrderId) {
      await tx.orderItem.deleteMany({ where: { orderId: data.heldOrderId } });
      await tx.payment.deleteMany({ where: { orderId: data.heldOrderId } });
    }

    const paymentCreates = data.payments.map((p) => {
      if (p.method === PaymentMethod.GIFT_CARD) {
        const g = giftPayments.find(
          (x) =>
            x.giftCardCode === (p.giftCardCode || "").trim().toUpperCase()
        )!;
        return {
          method: p.method,
          amount: toRupees(fromRupees(p.amount)),
          giftCardId: g.giftCardId,
          giftCardCode: g.giftCardCode,
        };
      }
      return {
        method: p.method,
        amount: toRupees(fromRupees(p.amount)),
        giftCardId: null as string | null,
        giftCardCode: null as string | null,
      };
    });

    const payload = {
      orderNumber,
      status: "COMPLETED" as const,
      fulfillmentStatus: "IN_PROCESS" as const,
      source: "POS" as const,
      orderType: data.orderType,
      subtotal: toRupees(subtotalPaisa),
      discountType: data.discountType,
      discountValue: data.discountValue,
      discountAmount: toRupees(discountPaisa),
      total: toRupees(totalPaisa),
      notes: data.notes || null,
      createdById: actor.id,
      customerId: saleCustomerId,
      registerSessionId: register.id,
      items: {
        create: lineItems.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          unitPrice: toRupees(l.unitPaisa),
          quantity: l.quantity,
          lineTotal: toRupees(l.linePaisa),
          notes: l.notes,
        })),
      },
      payments: { create: paymentCreates },
    };

    const created = data.heldOrderId
      ? await tx.order.update({
          where: { id: data.heldOrderId },
          data: payload,
          include: {
            items: true,
            payments: true,
            createdBy: { select: { name: true } },
            customer: true,
          },
        })
      : await tx.order.create({
          data: payload,
          include: {
            items: true,
            payments: true,
            createdBy: { select: { name: true } },
            customer: true,
          },
        });

    // Gift card ledger
    for (const g of giftPayments) {
      const card = await tx.giftCard.findUniqueOrThrow({
        where: { id: g.giftCardId },
      });
      const next = toRupees(
        subMoney(fromRupees(Number(card.balance)), g.amountPaisa)
      );
      await tx.giftCard.update({
        where: { id: g.giftCardId },
        data: { balance: next },
      });
      await tx.giftCardTransaction.create({
        data: {
          giftCardId: g.giftCardId,
          type: "REDEEM",
          amount: toRupees(g.amountPaisa),
          balanceAfter: next,
          orderId: created.id,
          userId: actor.id,
          note: `Sale ${orderNumber}`,
        },
      });
    }

    // Cash ledger for CASH allocations
    for (const p of data.payments) {
      if (p.method !== PaymentMethod.CASH) continue;
      await recordCashMovement(tx, {
        registerSessionId: register.id,
        type: "SALE",
        amountRupees: p.amount,
        userId: actor.id,
        orderId: created.id,
        note: `Sale ${orderNumber}`,
      });
    }

    // Stock ledger
    for (const line of lineItems) {
      if (line.kitItems.length > 0) {
        for (const kit of line.kitItems) {
          const comp = kit.componentProduct;
          if (!comp.trackInventory || !comp.inventoryItemId) continue;
          await recordStockMovement(tx, {
            itemId: comp.inventoryItemId,
            type: InventoryTxnType.SALE,
            quantity: kit.quantity * line.quantity,
            outbound: true,
            userId: actor.id,
            orderId: created.id,
            reason: `Sale ${orderNumber} kit:${line.productName}`,
          });
        }
        continue;
      }
      if (!line.trackInventory || !line.inventoryItemId) continue;
      await recordStockMovement(tx, {
        itemId: line.inventoryItemId,
        type: InventoryTxnType.SALE,
        quantity: line.quantity,
        outbound: true,
        userId: actor.id,
        orderId: created.id,
        reason: `Sale ${orderNumber}`,
      });
    }

    return created;
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.ORDER_COMPLETED,
    entityType: "Order",
    entityId: order.id,
    details: order.orderNumber,
  });

  return order;
}

export async function holdSale(
  actor: Actor,
  raw: Omit<CompleteSaleInput, "payments"> & {
    payments?: CompleteSaleInput["payments"];
    heldOrderId?: string | null;
  }
) {
  if (!hasMinRole(actor.role, "CASHIER")) {
    throw new ForbiddenError();
  }
  const items = z.array(cartItemSchema).min(1).parse(raw.items);
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lineItems = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) {
      throw new ValidationError(`Product unavailable`);
    }
    const unitPaisa = fromRupees(Number(product.price));
    return {
      productId: product.id,
      productName: product.name,
      unitPaisa,
      quantity: item.quantity,
      linePaisa: mulQty(unitPaisa, item.quantity),
      notes: item.notes || null,
    };
  });

  const subtotalPaisa = addMoney(...lineItems.map((l) => l.linePaisa));
  const discountType = raw.discountType ?? DiscountType.NONE;
  const discountValue = raw.discountValue ?? 0;
  const discountPaisa = calcDiscountPaisa(subtotalPaisa, discountType, discountValue);
  const totalPaisa = subMoney(subtotalPaisa, discountPaisa);

  if (raw.heldOrderId) {
    const existing = await prisma.order.findUniqueOrThrow({
      where: { id: raw.heldOrderId },
    });
    if (existing.status !== "HELD" && existing.status !== "OPEN") {
      throw new ConflictError("Only held/open orders can be updated as hold");
    }
  }

  const orderNumber = raw.heldOrderId
    ? (
        await prisma.order.findUniqueOrThrow({ where: { id: raw.heldOrderId } })
      ).orderNumber
    : await nextOrderNumber();

  const held = await prisma.$transaction(async (tx) => {
    if (raw.heldOrderId) {
      await tx.orderItem.deleteMany({ where: { orderId: raw.heldOrderId } });
      return tx.order.update({
        where: { id: raw.heldOrderId },
        data: {
          status: "HELD",
          orderType: raw.orderType ?? OrderType.TAKEAWAY,
          subtotal: toRupees(subtotalPaisa),
          discountType,
          discountValue,
          discountAmount: toRupees(discountPaisa),
          total: toRupees(totalPaisa),
          notes: raw.notes || null,
          customerId: raw.customerId || null,
          items: {
            create: lineItems.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              unitPrice: toRupees(l.unitPaisa),
              quantity: l.quantity,
              lineTotal: toRupees(l.linePaisa),
              notes: l.notes,
            })),
          },
        },
        include: {
          items: true,
          payments: true,
          createdBy: { select: { name: true } },
        },
      });
    }
    return tx.order.create({
      data: {
        orderNumber,
        status: "HELD",
        source: "POS",
        orderType: raw.orderType ?? OrderType.TAKEAWAY,
        subtotal: toRupees(subtotalPaisa),
        discountType,
        discountValue,
        discountAmount: toRupees(discountPaisa),
        total: toRupees(totalPaisa),
        notes: raw.notes || null,
        createdById: actor.id,
        customerId: raw.customerId || null,
        items: {
          create: lineItems.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            unitPrice: toRupees(l.unitPaisa),
            quantity: l.quantity,
            lineTotal: toRupees(l.linePaisa),
            notes: l.notes,
          })),
        },
      },
      include: {
        items: true,
        payments: true,
        createdBy: { select: { name: true } },
      },
    });
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.ORDER_HELD,
    entityType: "Order",
    entityId: held.id,
    details: held.orderNumber,
  });

  return held;
}
