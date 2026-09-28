import { execSync } from "child_process";
import path from "path";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

const root = path.resolve(__dirname, "../..");

export async function ensureTestSchema() {
  execSync("npx prisma db push --skip-generate", {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: "file:./test.db",
    },
    stdio: "pipe",
  });
}

export async function getPrisma() {
  const { prisma } = await import("@/core/database");
  return prisma;
}

/** Wipe all business data between tests (schema already present). */
export async function resetBusinessData() {
  const prisma = await getPrisma();
  await prisma.giftCardTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.kitItem.deleteMany();
  await prisma.receivingItem.deleteMany();
  await prisma.receiving.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.order.deleteMany();
  await prisma.registerSession.deleteMany();
  await prisma.product.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
}

export type Fixtures = Awaited<ReturnType<typeof seedSaleFixtures>>;

export async function seedSaleFixtures() {
  const prisma = await getPrisma();
  const passwordHash = await bcrypt.hash("password123", 4);

  const cashier = await prisma.user.create({
    data: {
      name: "Test Cashier",
      email: "cashier@test.local",
      passwordHash,
      role: Role.CASHIER,
    },
  });
  const supervisor = await prisma.user.create({
    data: {
      name: "Test Supervisor",
      email: "supervisor@test.local",
      passwordHash,
      role: Role.SUPERVISOR,
    },
  });

  const category = await prisma.category.create({
    data: { name: "Sandwiches", sortOrder: 1, active: true },
  });

  const inventory = await prisma.inventoryItem.create({
    data: {
      name: "Club Sandwich Stock",
      sku: "INV-CLUB",
      quantity: 20,
      unit: "pcs",
      minThreshold: 2,
    },
  });

  const product = await prisma.product.create({
    data: {
      name: "Club Sandwich",
      price: 650,
      categoryId: category.id,
      sku: "CLUB-01",
      isActive: true,
      trackInventory: true,
      inventoryItemId: inventory.id,
    },
  });

  const untracked = await prisma.product.create({
    data: {
      name: "Soft Drink",
      price: 150,
      categoryId: category.id,
      sku: "DRINK-01",
      isActive: true,
      trackInventory: false,
    },
  });

  return { cashier, supervisor, category, inventory, product, untracked };
}

export function actor(user: {
  id: string;
  role: Role;
}): { id: string; role: Role } {
  return { id: user.id, role: user.role };
}
