"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { requireRole } from "@/lib/session";
import { AppError } from "@/core/errors";
import { isProductAvailableNow } from "@/lib/orders";
import {
  createProduct,
  updateProduct,
  deleteProduct as deleteProductUseCase,
  setProductActive,
  upsertCategory as upsertCategoryUseCase,
  deleteCategory as deleteCategoryUseCase,
} from "@/modules/catalog/application/products";

function rethrow(e: unknown): never {
  if (e instanceof AppError) throw new Error(e.message);
  throw e;
}

export async function listCategories(includeInactive = false) {
  await requireRole(Role.CASHIER);
  return prisma.category.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function upsertCategory(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const id = (formData.get("id") as string) || undefined;
  try {
    await upsertCategoryUseCase(
      { id: session.user.id, role: session.user.role },
      {
        id,
        name: String(formData.get("name") || "").trim(),
        sortOrder: Number(formData.get("sortOrder") || 0),
        active:
          formData.get("active") === "on" || formData.get("active") === "true",
      }
    );
  } catch (e) {
    rethrow(e);
  }
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function deleteCategory(id: string) {
  const session = await requireRole(Role.ADMIN);
  try {
    await deleteCategoryUseCase(
      { id: session.user.id, role: session.user.role },
      id
    );
  } catch (e) {
    rethrow(e);
  }
  revalidatePath("/admin/categories");
}

export async function listProducts(opts?: {
  forPos?: boolean;
  search?: string;
  categoryId?: string;
}) {
  await requireRole(Role.CASHIER);
  const products = await prisma.product.findMany({
    where: {
      ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts?.search
        ? {
            OR: [
              { name: { contains: opts.search } },
              { sku: { contains: opts.search } },
              { description: { contains: opts.search } },
            ],
          }
        : {}),
    },
    include: { category: true, inventoryItem: true },
    orderBy: [{ name: "asc" }],
  });

  if (opts?.forPos) {
    return products.filter((p) => isProductAvailableNow(p));
  }
  return products;
}

export async function upsertProduct(formData: FormData) {
  const session = await requireRole(Role.ADMIN);
  const id = (formData.get("id") as string) || undefined;
  const actor = { id: session.user.id, role: session.user.role };
  const imageRaw = String(formData.get("imageUrl") || "");
  const input = {
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || null,
    priceRupees: Number(formData.get("price") || 0),
    categoryId: String(formData.get("categoryId") || ""),
    sku: String(formData.get("sku") || "") || null,
    imageUrl: imageRaw || null,
    isActive:
      formData.get("isActive") === "on" || formData.get("isActive") === "true",
    isTemporary:
      formData.get("isTemporary") === "on" ||
      formData.get("isTemporary") === "true",
    availableFrom: formData.get("availableFrom")
      ? new Date(String(formData.get("availableFrom")))
      : null,
    availableTo: formData.get("availableTo")
      ? new Date(String(formData.get("availableTo")))
      : null,
    trackInventory:
      formData.get("trackInventory") === "on" ||
      formData.get("trackInventory") === "true",
    inventoryItemId: String(formData.get("inventoryItemId") || "") || null,
  };

  try {
    if (id) await updateProduct(actor, id, input);
    else await createProduct(actor, input);
  } catch (e) {
    rethrow(e);
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
}

export async function deleteProduct(id: string) {
  const session = await requireRole(Role.ADMIN);
  try {
    await deleteProductUseCase(
      { id: session.user.id, role: session.user.role },
      id
    );
  } catch (e) {
    rethrow(e);
  }
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function toggleProductActive(id: string, isActive: boolean) {
  const session = await requireRole(Role.ADMIN);
  try {
    await setProductActive(
      { id: session.user.id, role: session.user.role },
      id,
      isActive
    );
  } catch (e) {
    rethrow(e);
  }
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}
