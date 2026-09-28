"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { requireRole, requireSession } from "@/lib/session";
import { canViewAllOrders } from "@/lib/permissions";
import { prisma } from "@/core/database";
import { completeSale, holdSale } from "@/modules/sales/application/complete-sale";
import { voidSale, returnSale } from "@/modules/sales/application/void-return";
import { AppError } from "@/core/errors";

function actorFrom(session: { user: { id: string; role: Role } }) {
  return { id: session.user.id, role: session.user.role };
}

function rethrow(e: unknown): never {
  if (e instanceof AppError) throw new Error(e.message);
  throw e;
}

/** Thin adapter — business rules live in modules/sales/application */
export async function completeOrder(input: {
  items: { productId: string; quantity: number; notes?: string }[];
  notes?: string;
  payments?: {
    method: "CASH" | "CARD" | "OTHER" | "GIFT_CARD";
    amount: number;
    giftCardCode?: string | null;
  }[];
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  discountType?: "NONE" | "PERCENT" | "FIXED";
  discountValue?: number;
  customerId?: string | null;
  hold?: boolean;
  heldOrderId?: string | null;
}) {
  const session = await requireRole(Role.CASHIER);
  const actor = actorFrom(session);
  try {
    if (input.hold) {
      const held = await holdSale(actor, {
        items: input.items,
        notes: input.notes,
        orderType: input.orderType as never,
        discountType: input.discountType as never,
        discountValue: input.discountValue ?? 0,
        customerId: input.customerId,
        heldOrderId: input.heldOrderId,
      });
      revalidatePath("/pos");
      revalidatePath("/admin/orders");
      return held;
    }
    const order = await completeSale(actor, {
      items: input.items,
      notes: input.notes,
      payments: input.payments || [],
      orderType: input.orderType as never,
      discountType: input.discountType as never,
      discountValue: input.discountValue ?? 0,
      customerId: input.customerId,
      heldOrderId: input.heldOrderId,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/gift-cards");
    revalidatePath("/admin/register");
    revalidatePath("/pos");
    return order;
  } catch (e) {
    rethrow(e);
  }
}

export async function voidOrder(orderId: string, reason: string) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    await voidSale(actorFrom(session), orderId, reason);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/gift-cards");
    revalidatePath("/admin/register");
  } catch (e) {
    rethrow(e);
  }
}

export async function returnOrder(orderId: string, reason: string) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    await returnSale(actorFrom(session), orderId, reason);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/gift-cards");
    revalidatePath("/admin/register");
  } catch (e) {
    rethrow(e);
  }
}

export async function setOrderFulfillment(
  orderId: string,
  fulfillmentStatus: "IN_PROCESS" | "DELIVERED" | "DONE"
) {
  const session = await requireRole(Role.CASHIER);
  try {
    const { setFulfillmentStatus } = await import(
      "@/modules/sales/application/fulfillment"
    );
    await setFulfillmentStatus(actorFrom(session), orderId, fulfillmentStatus);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/pos");
  } catch (e) {
    rethrow(e);
  }
}

export async function deleteHeldOrder(orderId: string) {
  const session = await requireRole(Role.CASHIER);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "HELD") throw new Error("Held order not found");
  if (
    order.createdById !== session.user.id &&
    session.user.role === Role.CASHIER
  ) {
    throw new Error("Cannot discard another cashier's held order");
  }
  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/pos");
  revalidatePath("/admin/orders");
}

export async function listOrders(opts?: {
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const session = await requireSession();
  return prisma.order.findMany({
    where: {
      ...(canViewAllOrders(session.user.role)
        ? {}
        : { createdById: session.user.id }),
      ...(opts?.q
        ? {
            OR: [
              { orderNumber: { contains: opts.q } },
              { notes: { contains: opts.q } },
              { createdBy: { name: { contains: opts.q } } },
            ],
          }
        : {}),
      ...(opts?.from || opts?.to
        ? {
            createdAt: {
              ...(opts.from ? { gte: new Date(opts.from) } : {}),
              ...(opts.to ? { lte: new Date(opts.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      items: true,
      payments: true,
      customer: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 100,
  });
}

export async function getOrder(id: string) {
  await requireSession();
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: true,
      customer: true,
      createdBy: { select: { name: true, email: true } },
      voidedBy: { select: { name: true } },
    },
  });
}
