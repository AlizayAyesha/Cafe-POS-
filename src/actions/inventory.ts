"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { requireRole } from "@/lib/session";
import { AppError } from "@/core/errors";
import { adjustStock as adjustStockUseCase } from "@/modules/inventory/application/adjust-stock";
import { toNumber } from "@/lib/money";

export async function listInventory() {
  await requireRole(Role.SUPERVISOR);
  return prisma.inventoryItem.findMany({
    include: { supplier: true, product: true },
    orderBy: { name: "asc" },
  });
}

export async function listSuppliers() {
  await requireRole(Role.SUPERVISOR);
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function upsertSupplier(formData: FormData) {
  await requireRole(Role.SUPERVISOR);
  const id = (formData.get("id") as string) || undefined;
  const name = String(formData.get("name") || "").trim();
  const contact = String(formData.get("contact") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!name) throw new Error("Supplier name required");

  if (id) {
    await prisma.supplier.update({ where: { id }, data: { name, contact, notes } });
  } else {
    await prisma.supplier.create({ data: { name, contact, notes } });
  }
  revalidatePath("/admin/inventory");
}

export async function upsertInventoryItem(formData: FormData) {
  const session = await requireRole(Role.SUPERVISOR);
  const id = (formData.get("id") as string) || undefined;
  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim() || null;
  const unit = String(formData.get("unit") || "pcs").trim() || "pcs";
  const minThreshold = Number(formData.get("minThreshold") || 0);
  const supplierId = String(formData.get("supplierId") || "") || null;
  if (!name) throw new Error("Name required");

  if (id) {
    // Quantity is ledger-owned — do not overwrite from this form.
    await prisma.inventoryItem.update({
      where: { id },
      data: { name, sku, unit, minThreshold, supplierId },
    });
  } else {
    const openingQty = Number(formData.get("quantity") || 0);
    const created = await prisma.inventoryItem.create({
      data: {
        name,
        sku,
        unit,
        quantity: 0,
        minThreshold,
        supplierId,
      },
    });
    if (openingQty > 0) {
      await adjustStockUseCase(
        { id: session.user.id, role: session.user.role },
        {
          itemId: created.id,
          type: "ADD",
          quantity: openingQty,
          reason: "Opening stock",
        }
      );
    }
  }
  revalidatePath("/admin/inventory");
}

const adjustSchema = z.object({
  itemId: z.string(),
  type: z.enum(["ADD", "REDUCE", "ADJUST", "WASTAGE"]),
  quantity: z.coerce.number().positive().optional(),
  reason: z.string().max(200).optional(),
  newQuantity: z.coerce.number().optional(),
});

export async function adjustStock(input: z.infer<typeof adjustSchema>) {
  const session = await requireRole(Role.SUPERVISOR);
  const data = adjustSchema.parse(input);
  try {
    if (data.type === "ADJUST") {
      if (data.newQuantity == null) throw new Error("newQuantity required for ADJUST");
      await adjustStockUseCase(
        { id: session.user.id, role: session.user.role },
        {
          itemId: data.itemId,
          type: "ADJUST",
          newQuantity: data.newQuantity,
          reason: data.reason,
        }
      );
    } else {
      if (data.quantity == null || data.quantity <= 0) {
        throw new Error("quantity required");
      }
      await adjustStockUseCase(
        { id: session.user.id, role: session.user.role },
        {
          itemId: data.itemId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
        }
      );
    }
  } catch (e) {
    if (e instanceof AppError) throw new Error(e.message);
    throw e;
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
}

export async function listInventoryHistory(itemId?: string) {
  await requireRole(Role.SUPERVISOR);
  return prisma.inventoryTransaction.findMany({
    where: itemId ? { itemId } : undefined,
    include: {
      item: { select: { name: true, sku: true } },
      user: { select: { name: true } },
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getLowStockItems() {
  await requireRole(Role.SUPERVISOR);
  const items = await prisma.inventoryItem.findMany({
    include: { supplier: true },
    orderBy: { name: "asc" },
  });
  return items.filter((i) => toNumber(i.quantity) <= toNumber(i.minThreshold));
}
