import type { FulfillmentStatus, Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { ForbiddenError, NotFoundError, ValidationError } from "@/core/errors";
import { hasMinRole } from "@/core/permissions";
import { recordAudit } from "@/modules/audit/application/record-audit";

type Actor = { id: string; role: Role };

const FLOW: FulfillmentStatus[] = ["IN_PROCESS", "DELIVERED", "DONE"];

export function fulfillmentLabel(s: FulfillmentStatus | string) {
  if (s === "IN_PROCESS") return "In process";
  if (s === "DELIVERED") return "Delivered";
  if (s === "DONE") return "Complete";
  return s;
}

export function fulfillmentChipClass(s: FulfillmentStatus | string) {
  if (s === "IN_PROCESS") return "status-chip status-in-process";
  if (s === "DELIVERED") return "status-chip status-delivered";
  if (s === "DONE") return "status-chip status-done";
  return "status-chip";
}

/** Update kitchen/handoff status for a paid order. */
export async function setFulfillmentStatus(
  actor: Actor,
  orderId: string,
  next: FulfillmentStatus
) {
  if (!hasMinRole(actor.role, "CASHIER")) throw new ForbiddenError();
  if (!FLOW.includes(next)) throw new ValidationError("Invalid fulfillment status");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order not found");
  if (order.status !== "COMPLETED") {
    throw new ValidationError("Only paid orders can be updated for delivery");
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { fulfillmentStatus: next },
  });

  await recordAudit({
    userId: actor.id,
    action: "FULFILLMENT_UPDATED",
    entityType: "Order",
    entityId: orderId,
    details: `${order.orderNumber} → ${next}`,
  });

  return updated;
}
