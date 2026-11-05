import type { Product } from "@prisma/client";
import { orderNumberPrefix } from "@/core/time/business-time";

/** Product is sellable now (active + within optional schedule window). */
export function isProductAvailableNow(
  product: Pick<Product, "isActive" | "availableFrom" | "availableTo">,
  now = new Date()
): boolean {
  if (!product.isActive) return false;
  if (product.availableFrom && now < product.availableFrom) return false;
  if (product.availableTo && now > product.availableTo) return false;
  return true;
}

/** New numbers use a WF + PKT-date prefix. Historical TIS numbers stay stored. */
export async function nextOrderNumber(now = new Date()): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const prefix = orderNumberPrefix(now);

  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let seq = 1;
  if (latest?.orderNumber) {
    const part = latest.orderNumber.slice(prefix.length);
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
