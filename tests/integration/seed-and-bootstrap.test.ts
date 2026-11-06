import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootstrapInitialAdmin } from "@/modules/identity/application/bootstrap-admin";
import { seedDatabase } from "../../prisma/seed";
import { ensureTestSchema, getPrisma, resetBusinessData } from "./helpers";

describe("non-destructive seed and initial admin", () => {
  beforeAll(async () => {
    await ensureTestSchema();
  }, 60_000);

  beforeEach(async () => {
    await resetBusinessData();
  });

  it("does not reset passwords, settings, or an existing menu", async () => {
    const prisma = await getPrisma();
    const passwordHash = await bcrypt.hash("already-set-secret", 4);
    const category = await prisma.category.create({
      data: { name: "House specials", sortOrder: 9, active: true },
    });
    const kept = await prisma.product.create({
      data: {
        name: "Real burger",
        price: 999,
        categoryId: category.id,
        sku: "REAL-BURGER",
        isActive: true,
      },
    });
    const placeholder = await prisma.product.create({
      data: {
        name: "Renamed saucewich",
        price: 111,
        categoryId: category.id,
        sku: "TIS-SAUCE",
        isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        name: "Owner",
        email: "admin@whatthefood.local",
        role: "ADMIN",
        passwordHash,
      },
    });
    await prisma.setting.create({ data: { key: "cafeName", value: "Real Cafe" } });

    await seedDatabase(prisma, {
      ...process.env,
      NODE_ENV: "test",
      DEMO_SEED_PASSWORD: "local-only-password",
    });

    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@whatthefood.local" },
    });
    expect(admin.passwordHash).toBe(passwordHash);
    expect(admin.name).toBe("Owner");

    const burger = await prisma.product.findUniqueOrThrow({ where: { id: kept.id } });
    expect(burger.isActive).toBe(true);
    expect(Number(burger.price)).toBe(999);

    const sauce = await prisma.product.findUniqueOrThrow({ where: { id: placeholder.id } });
    expect(sauce.name).toBe("Renamed saucewich");
    expect(Number(sauce.price)).toBe(111);
    expect(sauce.isActive).toBe(true);

    const cafeName = await prisma.setting.findUniqueOrThrow({ where: { key: "cafeName" } });
    expect(cafeName.value).toBe("Real Cafe");

    const address = await prisma.setting.findUnique({ where: { key: "address" } });
    expect(address?.value).toBe("Karachi");
  });

  it("refuses to seed in production and leaves rows untouched", async () => {
    const prisma = await getPrisma();
    await prisma.product.create({
      data: {
        name: "Only item",
        price: 50,
        category: { create: { name: "Only", sortOrder: 1 } },
        isActive: true,
      },
    });
    await expect(
      seedDatabase(prisma, { ...process.env, NODE_ENV: "production" })
    ).rejects.toThrow(/disabled/);
    const still = await prisma.product.findFirstOrThrow();
    expect(still.isActive).toBe(true);
    expect(still.name).toBe("Only item");
  });

  it("creates one initial admin and does not echo the password or touch the menu", async () => {
    const prisma = await getPrisma();
    const category = await prisma.category.create({
      data: { name: "Kept", sortOrder: 1, active: true },
    });
    await prisma.product.create({
      data: { name: "Kept item", price: 80, categoryId: category.id, isActive: true },
    });

    const password = "horse-battery-staple";
    const env = {
      enabled: "true",
      setupSecret: "setup-secret-value",
      providedSecret: "setup-secret-value",
      email: "owner@example.com",
      password,
    };

    const created = await bootstrapInitialAdmin(env, prisma);
    expect(created.status).toBe(200);
    expect(JSON.stringify(created.body)).not.toContain(password);
    expect(created.body).not.toHaveProperty("password");
    expect(created.body).not.toHaveProperty("login");

    const again = await bootstrapInitialAdmin(env, prisma);
    expect(again.status).toBe(409);
    expect(await prisma.user.count()).toBe(1);
    const menu = await prisma.product.findFirstOrThrow();
    expect(menu.name).toBe("Kept item");
    expect(menu.isActive).toBe(true);

    const closed = await bootstrapInitialAdmin({ ...env, enabled: "false" }, prisma);
    expect(closed.status).toBe(404);
  });

  it("rejects a previously published demo password when the database is empty", async () => {
    const prisma = await getPrisma();
    const result = await bootstrapInitialAdmin(
      {
        enabled: "true",
        setupSecret: "setup-secret-value",
        providedSecret: "setup-secret-value",
        email: "owner@example.com",
        password: "password123",
      },
      prisma
    );
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain("password123");
    expect(await prisma.user.count()).toBe(0);
  });
});
