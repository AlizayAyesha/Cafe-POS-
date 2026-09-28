import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log(
    "Users:",
    users.map((u) => `${u.email}:${u.role}`).join(", ")
  );
  console.log("Products:", await prisma.product.count());
  console.log("Categories:", await prisma.category.count());

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@whatthefood.local" },
  });
  console.log("Password check:", await bcrypt.compare("password123", admin.passwordHash));

  const product = await prisma.product.findFirstOrThrow({
    where: { isActive: true, trackInventory: true },
    include: { inventoryItem: true },
  });
  const before = Number(product.inventoryItem!.quantity);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: `SMOKE${Date.now()}`,
        status: "COMPLETED",
        source: "POS",
        subtotal: product.price,
        total: product.price,
        createdById: admin.id,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              unitPrice: product.price,
              quantity: 1,
              lineTotal: product.price,
            },
          ],
        },
        payments: {
          create: [
            { method: "CASH", amount: Number(product.price) / 2 },
            { method: "CARD", amount: Number(product.price) / 2 },
          ],
        },
      },
    });
    await tx.inventoryItem.update({
      where: { id: product.inventoryItemId! },
      data: { quantity: { decrement: 1 } },
    });
    await tx.inventoryTransaction.create({
      data: {
        itemId: product.inventoryItemId!,
        type: "SALE",
        quantity: 1,
        reason: `Sale ${created.orderNumber}`,
        userId: admin.id,
        orderId: created.id,
      },
    });
    return created;
  });

  const after = await prisma.inventoryItem.findUniqueOrThrow({
    where: { id: product.inventoryItemId! },
  });
  console.log("Order:", order.orderNumber);
  console.log("Inventory:", product.name, before, "->", Number(after.quantity));
  console.log("SMOKE OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
