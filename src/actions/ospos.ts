"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/core/database";
import { requireRole } from "@/lib/session";
import { AppError } from "@/core/errors";
import { writeAudit } from "@/lib/audit";
import {
  getOpenRegister as getOpenRegisterUseCase,
  openRegister as openRegisterUseCase,
  closeRegister as closeRegisterUseCase,
} from "@/modules/cash/application/register";
import { receiveStock } from "@/modules/purchasing/application/receive-stock";
import { createExpense as createExpenseUseCase } from "@/modules/expenses/application/create-expense";

function rethrow(e: unknown): never {
  if (e instanceof AppError) throw new Error(e.message);
  throw e;
}

export async function listCustomers(q?: string) {
  await requireRole(Role.CASHIER);
  return prisma.customer.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 100,
  });
}

export async function upsertCustomer(formData: FormData) {
  const session = await requireRole(Role.CASHIER);
  const id = (formData.get("id") as string) || undefined;
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");
  const data = {
    name,
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    landmark: String(formData.get("landmark") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    active: formData.get("active") !== "false",
  };
  const row = id
    ? await prisma.customer.update({ where: { id }, data })
    : await prisma.customer.create({ data });
  await writeAudit(
    session.user.id,
    id ? "customer.update" : "customer.create",
    "Customer",
    row.id,
    row.name
  );
  revalidatePath("/admin/customers");
  revalidatePath("/pos");
  return row;
}

export async function getOpenRegister() {
  await requireRole(Role.CASHIER);
  return getOpenRegisterUseCase();
}

export async function openRegister(openingFloat: number, notes?: string) {
  const session = await requireRole(Role.CASHIER);
  try {
    const reg = await openRegisterUseCase(
      { id: session.user.id, role: session.user.role },
      openingFloat,
      notes
    );
    revalidatePath("/pos");
    revalidatePath("/admin/register");
    return reg;
  } catch (e) {
    rethrow(e);
  }
}

export async function closeRegister(countedCash: number, notes?: string) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    const closed = await closeRegisterUseCase(
      { id: session.user.id, role: session.user.role },
      countedCash,
      notes
    );
    revalidatePath("/pos");
    revalidatePath("/admin/register");
    return closed;
  } catch (e) {
    rethrow(e);
  }
}

export async function listRegisterSessions() {
  await requireRole(Role.SUPERVISOR);
  return prisma.registerSession.findMany({
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      cashMovements: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { openedAt: "desc" },
    take: 50,
  });
}

export async function listExpenses() {
  await requireRole(Role.SUPERVISOR);
  return prisma.expense.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
}

export async function createExpense(formData: FormData) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    await createExpenseUseCase(
      { id: session.user.id, role: session.user.role },
      {
        category: String(formData.get("category") || ""),
        amountRupees: Number(formData.get("amount") || 0),
        description: String(formData.get("description") || "").trim() || null,
        paidAt: formData.get("paidAt")
          ? new Date(String(formData.get("paidAt")))
          : new Date(),
      }
    );
  } catch (e) {
    rethrow(e);
  }
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/register");
}

export async function listReceivings() {
  await requireRole(Role.SUPERVISOR);
  return prisma.receiving.findMany({
    include: {
      supplier: true,
      user: { select: { name: true } },
      items: { include: { inventoryItem: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createReceiving(input: {
  supplierId?: string | null;
  reference?: string | null;
  notes?: string | null;
  items: { inventoryItemId: string; quantity: number; unitCost: number }[];
}) {
  const session = await requireRole(Role.SUPERVISOR);
  try {
    const receiving = await receiveStock(
      { id: session.user.id, role: session.user.role },
      input
    );
    revalidatePath("/admin/receivings");
    revalidatePath("/admin/inventory");
    return receiving;
  } catch (e) {
    rethrow(e);
  }
}

export async function listAuditLogs(limit = 100) {
  await requireRole(Role.ADMIN);
  return prisma.auditLog.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listHeldOrders() {
  await requireRole(Role.CASHIER);
  return prisma.order.findMany({
    where: { status: "HELD" },
    include: {
      items: true,
      customer: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}
