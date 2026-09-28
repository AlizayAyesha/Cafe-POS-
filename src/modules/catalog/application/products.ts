import type { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/core/database";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/core/errors";
import { canManageCatalog } from "@/core/permissions";
import { fromRupees, toRupees } from "@/core/money";
import { recordAudit } from "@/modules/audit/application/record-audit";
import { AuditActions } from "@/modules/audit/domain/actions";

type Actor = { id: string; role: Role };

export const productInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  priceRupees: z.number().positive(),
  categoryId: z.string().min(1),
  sku: z.string().max(60).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  isTemporary: z.boolean().optional(),
  availableFrom: z.date().optional().nullable(),
  availableTo: z.date().optional().nullable(),
  trackInventory: z.boolean().optional(),
  inventoryItemId: z.string().optional().nullable(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

function toPayload(data: ProductInput) {
  return {
    name: data.name,
    description: data.description || null,
    price: toRupees(fromRupees(data.priceRupees)),
    categoryId: data.categoryId,
    sku: data.sku || null,
    imageUrl: data.imageUrl || null,
    isActive: data.isActive ?? true,
    isTemporary: data.isTemporary ?? false,
    availableFrom: data.availableFrom || null,
    availableTo: data.availableTo || null,
    trackInventory: data.trackInventory ?? false,
    inventoryItemId: data.inventoryItemId || null,
  };
}

export async function createProduct(actor: Actor, raw: ProductInput) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  const data = productInputSchema.parse(raw);
  const payload = toPayload(data);

  const created = await prisma.product.create({ data: payload });
  await recordAudit({
    userId: actor.id,
    action: AuditActions.PRODUCT_CHANGED,
    entityType: "Product",
    entityId: created.id,
    details: `created ${created.name} @ ${payload.price}`,
  });
  return created;
}

export async function updateProduct(
  actor: Actor,
  productId: string,
  raw: ProductInput
) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  const data = productInputSchema.parse(raw);
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError("Product not found");

  const payload = toPayload(data);
  const priceChanged =
    toRupees(fromRupees(Number(existing.price))) !== payload.price;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: payload,
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.PRODUCT_CHANGED,
    entityType: "Product",
    entityId: productId,
    details: priceChanged
      ? `updated ${updated.name}; price ${Number(existing.price)} → ${payload.price}`
      : `updated ${updated.name}`,
  });
  return updated;
}

/** Dedicated price change — always audited with before/after. */
export async function changeProductPrice(
  actor: Actor,
  productId: string,
  newPriceRupees: number
) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  if (!(newPriceRupees > 0)) throw new ValidationError("Price must be positive");

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError("Product not found");

  const next = toRupees(fromRupees(newPriceRupees));
  const updated = await prisma.product.update({
    where: { id: productId },
    data: { price: next },
  });

  await recordAudit({
    userId: actor.id,
    action: AuditActions.PRODUCT_CHANGED,
    entityType: "Product",
    entityId: productId,
    details: `price ${Number(existing.price)} → ${next}`,
  });
  return updated;
}

export async function setProductActive(
  actor: Actor,
  productId: string,
  isActive: boolean
) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isActive },
  });
  await recordAudit({
    userId: actor.id,
    action: AuditActions.PRODUCT_CHANGED,
    entityType: "Product",
    entityId: productId,
    details: isActive ? "activated" : "deactivated",
  });
  return updated;
}

export async function deleteProduct(actor: Actor, productId: string) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  await prisma.product.delete({ where: { id: productId } });
  await recordAudit({
    userId: actor.id,
    action: AuditActions.PRODUCT_CHANGED,
    entityType: "Product",
    entityId: productId,
    details: "deleted",
  });
}

export async function upsertCategory(
  actor: Actor,
  input: { id?: string; name: string; sortOrder?: number; active?: boolean }
) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  const name = input.name.trim();
  if (!name) throw new ValidationError("Category name is required");

  if (input.id) {
    return prisma.category.update({
      where: { id: input.id },
      data: {
        name,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
  }
  return prisma.category.create({
    data: {
      name,
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
    },
  });
}

export async function deleteCategory(actor: Actor, categoryId: string) {
  if (!canManageCatalog(actor.role)) throw new ForbiddenError();
  const count = await prisma.product.count({ where: { categoryId } });
  if (count > 0) {
    throw new ConflictError("Cannot delete category with products");
  }
  await prisma.category.delete({ where: { id: categoryId } });
}
