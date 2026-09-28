import type { OrderStatus } from "@prisma/client";
import { ConflictError } from "@/core/errors";

/** Allowed order status transitions (source of truth for sales lifecycle). */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  OPEN: ["HELD", "COMPLETED", "CANCELLED"],
  HELD: ["OPEN", "COMPLETED", "CANCELLED"],
  COMPLETED: ["VOIDED", "RETURNED"],
  VOIDED: [],
  RETURNED: [],
  CANCELLED: [],
};

export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ConflictError(`Invalid order transition ${from} → ${to}`);
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}
