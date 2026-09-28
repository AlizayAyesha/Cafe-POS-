import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const renames: [string, string, Role, string][] = [
    ["admin@thisissandwich.local", "admin@whatthefood.local", Role.ADMIN, "Admin"],
    [
      "supervisor@thisissandwich.local",
      "supervisor@whatthefood.local",
      Role.SUPERVISOR,
      "Supervisor",
    ],
    ["cashier@thisissandwich.local", "cashier@whatthefood.local", Role.CASHIER, "Cashier"],
  ];
  for (const [from, to, role, name] of renames) {
    const legacy = await prisma.user.findUnique({ where: { email: from } });
    if (legacy) {
      const clash = await prisma.user.findUnique({ where: { email: to } });
      if (!clash) {
        await prisma.user.update({
          where: { id: legacy.id },
          data: { email: to, passwordHash, role, name, active: true },
        });
      }
    }
  }

  for (const u of [
    { email: "admin@whatthefood.local", role: Role.ADMIN, name: "Admin" },
    {
      email: "supervisor@whatthefood.local",
      role: Role.SUPERVISOR,
      name: "Supervisor",
    },
    { email: "cashier@whatthefood.local", role: Role.CASHIER, name: "Cashier" },
  ]) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, role: u.role, active: true },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
      },
    });
  }

  const settings: Record<string, string> = {
    cafeName: "What The Food",
    currency: "PKR",
    currencySymbol: "Rs",
    receiptFooter: "Thank you for visiting What The Food!",
    address: "Karachi",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  // Deactivate old demo categories/products that aren't on the real menu
  await prisma.product.updateMany({ data: { isActive: false } });

  async function cat(name: string, sortOrder: number) {
    return prisma.category.upsert({
      where: { name },
      update: { sortOrder, active: true },
      create: { name, sortOrder, active: true },
    });
  }

  const sandwiches = await cat("Sandwiches", 1);
  const sides = await cat("Sides", 2);
  const bev = await cat("Beverages", 3);

  async function item(opts: {
    name: string;
    price: number;
    categoryId: string;
    sku: string;
    description?: string;
  }) {
    const existing = await prisma.product.findFirst({ where: { sku: opts.sku } });
    if (existing) {
      return prisma.product.update({
        where: { id: existing.id },
        data: {
          name: opts.name,
          price: opts.price,
          categoryId: opts.categoryId,
          description: opts.description || null,
          isActive: true,
          trackInventory: false,
        },
      });
    }
    return prisma.product.create({
      data: {
        name: opts.name,
        price: opts.price,
        categoryId: opts.categoryId,
        sku: opts.sku,
        description: opts.description || null,
        isActive: true,
        trackInventory: false,
      },
    });
  }

  // Prices: set placeholders — update in Menu when you confirm flyer prices
  await item({
    name: "Saucewitch",
    price: 750,
    categoryId: sandwiches.id,
    sku: "TIS-SAUCE",
    description:
      "Classic sauced-up sandwich with pulled chicken and veggies.",
  });
  await item({
    name: "Tender Dome",
    price: 850,
    categoryId: sandwiches.id,
    sku: "TIS-TENDER",
    description:
      "Flavourful chicken tenders between panini bread lined with coleslaw.",
  });
  await item({
    name: "Franks Feast",
    price: 950,
    categoryId: sandwiches.id,
    sku: "TIS-FRANK",
    description:
      "Fried sausages, onion rings and fried tenders in panini with coleslaw.",
  });

  await item({
    name: "Chicken Tenders",
    price: 450,
    categoryId: sides.id,
    sku: "TIS-TENDERS",
    description: "Crispy chicken tender pieces.",
  });
  await item({
    name: "Small Fries",
    price: 200,
    categoryId: sides.id,
    sku: "TIS-FRIES-S",
  });
  await item({
    name: "Large Fries",
    price: 350,
    categoryId: sides.id,
    sku: "TIS-FRIES-L",
  });
  await item({
    name: "Onion Rings with Garlic Sauce",
    price: 300,
    categoryId: sides.id,
    sku: "TIS-RINGS",
  });
  await item({
    name: "Coleslaw",
    price: 150,
    categoryId: sides.id,
    sku: "TIS-SLAW",
  });
  await item({
    name: "Sauces",
    price: 50,
    categoryId: sides.id,
    sku: "TIS-SAUCE-SIDE",
  });

  await item({
    name: "Soft Drink",
    price: 150,
    categoryId: bev.id,
    sku: "TIS-SOFT",
  });
  await item({
    name: "Karak Chai",
    price: 120,
    categoryId: bev.id,
    sku: "TIS-KARAK",
  });
  await item({
    name: "Cava",
    price: 200,
    categoryId: bev.id,
    sku: "TIS-CAVA",
  });
  await item({
    name: "Black Cortado",
    price: 280,
    categoryId: bev.id,
    sku: "TIS-CORTADO",
  });
  await item({
    name: "Milk Cappuccino",
    price: 350,
    categoryId: bev.id,
    sku: "TIS-CAP",
  });
  await item({
    name: "Coffee Frappe",
    price: 450,
    categoryId: bev.id,
    sku: "TIS-FRAPPE",
  });

  console.log("Seed complete — What The Food menu (This Is Sandwich items)");
  console.log("  admin@whatthefood.local / password123");
  console.log("  Update prices in Menu if flyer prices differ.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
