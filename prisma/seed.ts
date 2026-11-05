import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Explicit local/demo seed.
 * Importing this module does nothing. `npm run db:seed` is the only entry.
 * It never deactivates products, overwrites settings, or resets passwords.
 */

const DEMO_USERS: { email: string; role: Role; name: string }[] = [
  { email: "admin@whatthefood.local", role: Role.ADMIN, name: "Admin" },
  { email: "supervisor@whatthefood.local", role: Role.SUPERVISOR, name: "Supervisor" },
  { email: "cashier@whatthefood.local", role: Role.CASHIER, name: "Cashier" },
];

const LEGACY_EMAILS: [string, string][] = [
  ["admin@thisissandwich.local", "admin@whatthefood.local"],
  ["supervisor@thisissandwich.local", "supervisor@whatthefood.local"],
  ["cashier@thisissandwich.local", "cashier@whatthefood.local"],
];

const DEFAULT_SETTINGS: Record<string, string> = {
  cafeName: "What The Food",
  currency: "PKR",
  currencySymbol: "Rs",
  receiptFooter: "Thank you for visiting What The Food!",
  address: "Karachi",
};

type PlaceholderItem = {
  name: string;
  price: number;
  category: string;
  sku: string;
  description?: string;
};

const PLACEHOLDER_ITEMS: PlaceholderItem[] = [
  {
    name: "Saucewitch",
    price: 750,
    category: "Sandwiches",
    sku: "TIS-SAUCE",
    description: "Classic sauced-up sandwich with pulled chicken and veggies.",
  },
  {
    name: "Tender Dome",
    price: 850,
    category: "Sandwiches",
    sku: "TIS-TENDER",
    description: "Flavourful chicken tenders between panini bread lined with coleslaw.",
  },
  {
    name: "Franks Feast",
    price: 950,
    category: "Sandwiches",
    sku: "TIS-FRANK",
    description: "Fried sausages, onion rings and fried tenders in panini with coleslaw.",
  },
  {
    name: "Chicken Tenders",
    price: 450,
    category: "Sides",
    sku: "TIS-TENDERS",
    description: "Crispy chicken tender pieces.",
  },
  { name: "Small Fries", price: 200, category: "Sides", sku: "TIS-FRIES-S" },
  { name: "Large Fries", price: 350, category: "Sides", sku: "TIS-FRIES-L" },
  {
    name: "Onion Rings with Garlic Sauce",
    price: 300,
    category: "Sides",
    sku: "TIS-RINGS",
  },
  { name: "Coleslaw", price: 150, category: "Sides", sku: "TIS-SLAW" },
  { name: "Sauces", price: 50, category: "Sides", sku: "TIS-SAUCE-SIDE" },
  { name: "Soft Drink", price: 150, category: "Beverages", sku: "TIS-SOFT" },
  { name: "Karak Chai", price: 120, category: "Beverages", sku: "TIS-KARAK" },
  { name: "Cava", price: 200, category: "Beverages", sku: "TIS-CAVA" },
  { name: "Black Cortado", price: 280, category: "Beverages", sku: "TIS-CORTADO" },
  { name: "Milk Cappuccino", price: 350, category: "Beverages", sku: "TIS-CAP" },
  { name: "Coffee Frappe", price: 450, category: "Beverages", sku: "TIS-FRAPPE" },
];

export function demoSeedAllowed(
  env: NodeJS.ProcessEnv = process.env
): { ok: true } | { ok: false; reason: string } {
  if (env.NODE_ENV === "production" && env.ALLOW_DEMO_SEED !== "true") {
    return {
      ok: false,
      reason:
        "Demo seed is disabled when NODE_ENV=production. It is for local development. Do not point it at a live café database.",
    };
  }
  return { ok: true };
}

export async function seedDatabase(
  client: PrismaClient,
  env: NodeJS.ProcessEnv = process.env
) {
  const gate = demoSeedAllowed(env);
  if (!gate.ok) throw new Error(gate.reason);

  for (const [from, to] of LEGACY_EMAILS) {
    const legacy = await client.user.findUnique({ where: { email: from } });
    if (!legacy) continue;
    const clash = await client.user.findUnique({ where: { email: to } });
    if (clash) continue;
    await client.user.update({
      where: { id: legacy.id },
      data: { email: to },
    });
  }

  const missingUsers = [];
  for (const user of DEMO_USERS) {
    const existing = await client.user.findUnique({ where: { email: user.email } });
    if (!existing) missingUsers.push(user);
  }

  if (missingUsers.length > 0) {
    const password = env.DEMO_SEED_PASSWORD ?? "";
    if (password.length < 8) {
      throw new Error(
        "Set DEMO_SEED_PASSWORD to at least 8 characters to create missing demo users. Existing passwords are never changed, and the password is not printed."
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    for (const user of missingUsers) {
      await client.user.create({
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          active: true,
          passwordHash,
        },
      });
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await client.setting.findUnique({ where: { key } });
    if (existing) continue;
    await client.setting.create({ data: { key, value } });
  }

  const categoryIds = new Map<string, string>();
  const categoryOrder = ["Sandwiches", "Sides", "Beverages"];
  for (const [index, name] of categoryOrder.entries()) {
    const existing = await client.category.findUnique({ where: { name } });
    if (existing) {
      categoryIds.set(name, existing.id);
      continue;
    }
    const created = await client.category.create({
      data: { name, sortOrder: index + 1, active: true },
    });
    categoryIds.set(name, created.id);
  }

  let createdItems = 0;
  for (const item of PLACEHOLDER_ITEMS) {
    const existing = await client.product.findFirst({ where: { sku: item.sku } });
    if (existing) continue;
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) continue;
    await client.product.create({
      data: {
        name: item.name,
        price: item.price,
        categoryId,
        sku: item.sku,
        description: item.description ?? null,
        isActive: true,
        trackInventory: false,
      },
    });
    createdItems += 1;
  }

  console.log(
    `Demo seed finished. New demo users: ${missingUsers.length}. New placeholder items: ${createdItems}. Existing users, passwords, settings, balances, and menu rows were left unchanged.`
  );
}

function invokedAsCli(): boolean {
  const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
  return entry.endsWith("/prisma/seed.ts") || entry.endsWith("/prisma/seed.js");
}

if (invokedAsCli()) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
