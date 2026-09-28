import type { Product } from "@prisma/client";

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

export async function nextOrderNumber(): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const today = new Date();
  const y = today.getFullYear().toString().slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `TIS${y}${m}${d}`;

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
