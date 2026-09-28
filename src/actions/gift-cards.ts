"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { requireRole } from "@/lib/session";
import { AppError } from "@/core/errors";
import { toNumber } from "@/lib/money";
import {
  issueGiftCard as issueGiftCardUseCase,
  reloadGiftCard as reloadGiftCardUseCase,
  setGiftCardActive,
} from "@/modules/gift-cards/application/lifecycle";

function rethrow(e: unknown): never {
  if (e instanceof AppError) throw new Error(e.message);
  throw e;
}

export async function listGiftCards(q?: string) {
  await requireRole(Role.SUPERVISOR);
  return prisma.giftCard.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q } },
            { customer: { name: { contains: q } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : undefined,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      issuedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function lookupGiftCard(code: string) {
  await requireRole(Role.CASHIER);
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const card = await prisma.giftCard.findUnique({
    where: { code: normalized },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!card || !card.active) return null;
  if (card.expiresAt && card.expiresAt < new Date()) return null;
  return {
    id: card.id,
    code: card.code,
    balance: toNumber(card.balance),
    customerId: card.customerId,
    customerName: card.customer.name,
    customerPhone: card.customer.phone,
  };
}

export async function issueGiftCard(formData: FormData) {
  const session = await requireRole(Role.SUPERVISOR);
  const expiresRaw = String(formData.get("expiresAt") || "").trim();
  try {
    const card = await issueGiftCardUseCase(
      { id: session.user.id, role: session.user.role },
      {
        customerId: String(formData.get("customerId") || "").trim(),
        amountRupees: Number(formData.get("amount") || 0),
        code: String(formData.get("code") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        expiresAt: expiresRaw ? new Date(expiresRaw) : null,
      }
    );
    revalidatePath("/admin/gift-cards");
    revalidatePath("/admin/customers");
    return card;
  } catch (e) {
    rethrow(e);
  }
}

export async function reloadGiftCard(formData: FormData) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    const card = await reloadGiftCardUseCase(
      { id: session.user.id, role: session.user.role },
      {
        giftCardId: String(formData.get("id") || ""),
        amountRupees: Number(formData.get("amount") || 0),
        note: String(formData.get("note") || "").trim() || null,
      }
    );
    revalidatePath("/admin/gift-cards");
    return card;
  } catch (e) {
    rethrow(e);
  }
}

export async function toggleGiftCard(id: string, active: boolean) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    await setGiftCardActive(
      { id: session.user.id, role: session.user.role },
      id,
      active
    );
  } catch (e) {
    rethrow(e);
  }
  revalidatePath("/admin/gift-cards");
}

export async function listGiftCardHistory(giftCardId: string) {
  await requireRole(Role.SUPERVISOR);
  return prisma.giftCardTransaction.findMany({
    where: { giftCardId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

const issueSchema = z.object({
  customerId: z.string().min(1),
});

export async function getCustomerGiftCards(customerId: string) {
  await requireRole(Role.CASHIER);
  issueSchema.parse({ customerId });
  return prisma.giftCard.findMany({
    where: { customerId, active: true },
    orderBy: { createdAt: "desc" },
  });
}
