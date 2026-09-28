import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-1" },
    update: { name: "Walk-in Regular", phone: "0300-1111111" },
    create: {
      id: "seed-customer-1",
      name: "Walk-in Regular",
      phone: "0300-1111111",
      address: "DHA Phase 6, Karachi",
    },
  });

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  const card = await prisma.giftCard.upsert({
    where: { code: "TIS-DEMO-0001" },
    update: { balance: 2000, active: true, customerId: customer.id },
    create: {
      code: "TIS-DEMO-0001",
      customerId: customer.id,
      balance: 2000,
      active: true,
      issuedById: admin?.id,
      notes: "Demo gift card for repeat customer",
    },
  });

  const txnCount = await prisma.giftCardTransaction.count({
    where: { giftCardId: card.id, type: "ISSUE" },
  });
  if (txnCount === 0) {
    await prisma.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        type: "ISSUE",
        amount: 2000,
        balanceAfter: 2000,
        userId: admin?.id,
        note: "Seed issue",
      },
    });
  }

  console.log("Demo gift card ready:", card.code, "balance", Number(card.balance));
  console.log("Customer:", customer.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
