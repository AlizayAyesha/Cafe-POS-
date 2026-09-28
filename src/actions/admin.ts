"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/session";
import { hasMinRole } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns";

export async function getDashboardStats() {
  await requireRole(Role.SUPERVISOR);
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [todayOrders, weekOrders, monthOrders, recentOrders, inventory] =
    await Promise.all([
      prisma.order.findMany({
        where: { status: "COMPLETED", createdAt: { gte: dayStart, lte: dayEnd } },
        include: { items: true },
      }),
      prisma.order.findMany({
        where: { status: "COMPLETED", createdAt: { gte: weekStart, lte: weekEnd } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { status: "COMPLETED", createdAt: { gte: monthStart, lte: monthEnd } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { status: "COMPLETED" },
        include: {
          createdBy: { select: { name: true } },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.inventoryItem.findMany({ include: { supplier: true } }),
    ]);

  const sum = (orders: { total: unknown }[]) =>
    orders.reduce((s, o) => s + toNumber(o.total as never), 0);

  const todayRevenue = sum(todayOrders);
  const orderCount = todayOrders.length;
  const avgOrder = orderCount ? todayRevenue / orderCount : 0;

  const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of todayOrders) {
    for (const item of order.items) {
      const key = item.productName;
      const cur = productSales.get(key) || { name: key, qty: 0, revenue: 0 };
      cur.qty += item.quantity;
      cur.revenue += toNumber(item.lineTotal);
      productSales.set(key, cur);
    }
  }
  const bestSellers = [...productSales.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lowStock = inventory.filter(
    (i) => toNumber(i.quantity) <= toNumber(i.minThreshold)
  );

  return {
    todayRevenue,
    weekRevenue: sum(weekOrders),
    monthRevenue: sum(monthOrders),
    orderCount,
    avgOrder,
    bestSellers,
    lowStock,
    recentOrders,
  };
}

export async function getPeakHourAnalysis(days = 7) {
  await requireRole(Role.SUPERVISOR);
  const from = subDays(new Date(), days);
  const orders = await prisma.order.findMany({
    where: { status: "COMPLETED", createdAt: { gte: from } },
    select: { createdAt: true, total: true },
  });

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    revenue: 0,
  }));

  for (const o of orders) {
    const h = o.createdAt.getHours();
    hours[h].orders += 1;
    hours[h].revenue += toNumber(o.total);
  }

  return hours;
}

export async function getProductSalesReport(from?: string, to?: string) {
  await requireRole(Role.SUPERVISOR);
  const orders = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { items: true },
  });

  const map = new Map<string, { product: string; qty: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const cur = map.get(item.productName) || {
        product: item.productName,
        qty: 0,
        revenue: 0,
      };
      cur.qty += item.quantity;
      cur.revenue += toNumber(item.lineTotal);
      map.set(item.productName, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export async function listStaff() {
  await requireRole(Role.ADMIN);
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
}

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
});

export async function upsertStaff(formData: FormData) {
  await requireRole(Role.ADMIN);
  const id = (formData.get("id") as string) || undefined;
  const parsed = staffSchema.parse({
    name: formData.get("name"),
    email: String(formData.get("email") || "").toLowerCase(),
    role: formData.get("role"),
    password: formData.get("password") || undefined,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });

  if (id) {
    const data: {
      name: string;
      email: string;
      role: Role;
      active: boolean;
      passwordHash?: string;
    } = {
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      active: parsed.active ?? true,
    };
    if (parsed.password) {
      data.passwordHash = await bcrypt.hash(parsed.password, 10);
    }
    await prisma.user.update({ where: { id }, data });
  } else {
    if (!parsed.password) throw new Error("Password required for new staff");
    await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        active: parsed.active ?? true,
        passwordHash: await bcrypt.hash(parsed.password, 10),
      },
    });
  }
  revalidatePath("/admin/staff");
}

export async function updateSettingsAction(formData: FormData) {
  await requireRole(Role.ADMIN);
  const { setSettings } = await import("@/lib/settings");
  await setSettings({
    cafeName: String(formData.get("cafeName") || ""),
    currency: String(formData.get("currency") || "PKR"),
    currencySymbol: String(formData.get("currencySymbol") || "Rs"),
    receiptFooter: String(formData.get("receiptFooter") || ""),
    address: String(formData.get("address") || ""),
  });
  revalidatePath("/admin/settings");
  revalidatePath("/pos");
}

export async function listShifts(from?: string, to?: string) {
  const session = await requireSession();
  const canManage = hasMinRole(session.user.role, "SUPERVISOR");

  return prisma.shift.findMany({
    where: {
      ...(canManage ? {} : { userId: session.user.id }),
      ...(from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export async function upsertShift(formData: FormData) {
  const session = await requireRole(Role.SUPERVISOR);
  const id = (formData.get("id") as string) || undefined;
  const userId = String(formData.get("userId") || "");
  const startAt = new Date(String(formData.get("startAt")));
  const endAt = new Date(String(formData.get("endAt")));
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!userId || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("Invalid shift data");
  }
  if (endAt <= startAt) throw new Error("End must be after start");

  if (id) {
    await prisma.shift.update({
      where: { id },
      data: { userId, startAt, endAt, notes },
    });
  } else {
    await prisma.shift.create({
      data: {
        userId,
        startAt,
        endAt,
        notes,
        createdById: session.user.id,
      },
    });
  }
  revalidatePath("/admin/schedule");
}

export async function deleteShift(id: string) {
  await requireRole(Role.SUPERVISOR);
  await prisma.shift.delete({ where: { id } });
  revalidatePath("/admin/schedule");
}

export async function listActiveStaffForSchedule() {
  await requireRole(Role.SUPERVISOR);
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}
