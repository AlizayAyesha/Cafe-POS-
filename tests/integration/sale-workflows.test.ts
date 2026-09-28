import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { completeSale } from "@/modules/sales/application/complete-sale";
import { voidSale, returnSale } from "@/modules/sales/application/void-return";
import {
  openRegister,
  closeRegister,
  getOpenRegister,
} from "@/modules/cash/application/register";
import { ValidationError, ForbiddenError } from "@/core/errors";
import {
  actor,
  ensureTestSchema,
  getPrisma,
  resetBusinessData,
  seedSaleFixtures,
  type Fixtures,
} from "./helpers";

describe("POS workflow integration", () => {
  let fx: Fixtures;

  beforeAll(async () => {
    await ensureTestSchema();
  }, 60_000);

  beforeEach(async () => {
    await resetBusinessData();
    fx = await seedSaleFixtures();
  });

  it("refuses CompleteSale when register is closed", async () => {
    await expect(
      completeSale(actor(fx.cashier), {
        items: [{ productId: fx.product.id, quantity: 1 }],
        payments: [{ method: "CASH", amount: 650 }],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("CompleteSale: order + payment + stock + cash movement atomically", async () => {
    const prisma = await getPrisma();
    await openRegister(actor(fx.cashier), 5000);

    const order = await completeSale(actor(fx.cashier), {
      items: [{ productId: fx.product.id, quantity: 2 }],
      payments: [{ method: "CASH", amount: 1300 }],
    });

    expect(order.status).toBe("COMPLETED");
    expect(Number(order.total)).toBe(1300);
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].method).toBe("CASH");

    const stock = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: fx.inventory.id },
    });
    expect(Number(stock.quantity)).toBe(18);

    const stockTxn = await prisma.inventoryTransaction.findMany({
      where: { orderId: order.id, type: "SALE" },
    });
    expect(stockTxn).toHaveLength(1);
    expect(Number(stockTxn[0].quantity)).toBe(2);

    const reg = await getOpenRegister();
    expect(reg).toBeTruthy();
    const cash = await prisma.cashMovement.findMany({
      where: { registerSessionId: reg!.id, type: "SALE", orderId: order.id },
    });
    expect(cash).toHaveLength(1);
    expect(Number(cash[0].amount)).toBe(1300);
  });

  it("Split payment: allocations equal total and each method is recorded", async () => {
    const prisma = await getPrisma();
    await openRegister(actor(fx.cashier), 1000);

    const order = await completeSale(actor(fx.cashier), {
      items: [
        { productId: fx.product.id, quantity: 1 },
        { productId: fx.untracked.id, quantity: 1 },
      ],
      payments: [
        { method: "CASH", amount: 500 },
        { method: "CARD", amount: 300 },
      ],
    });

    expect(Number(order.total)).toBe(800);
    expect(order.payments).toHaveLength(2);
    const byMethod = Object.fromEntries(
      order.payments.map((p) => [p.method, Number(p.amount)])
    );
    expect(byMethod.CASH).toBe(500);
    expect(byMethod.CARD).toBe(300);

    const cashMoves = await prisma.cashMovement.findMany({
      where: { orderId: order.id, type: "SALE" },
    });
    expect(cashMoves).toHaveLength(1);
    expect(Number(cashMoves[0].amount)).toBe(500);
  });

  it("rejects split payment that does not equal order total", async () => {
    await openRegister(actor(fx.cashier), 1000);
    await expect(
      completeSale(actor(fx.cashier), {
        items: [{ productId: fx.product.id, quantity: 1 }],
        payments: [
          { method: "CASH", amount: 200 },
          { method: "CARD", amount: 200 },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("VoidSale: restores stock and records cash refund", async () => {
    const prisma = await getPrisma();
    await openRegister(actor(fx.cashier), 2000);
    const order = await completeSale(actor(fx.cashier), {
      items: [{ productId: fx.product.id, quantity: 1 }],
      payments: [{ method: "CASH", amount: 650 }],
    });

    await voidSale(actor(fx.supervisor), order.id, "Wrong item");

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.status).toBe("VOIDED");

    const stock = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: fx.inventory.id },
    });
    expect(Number(stock.quantity)).toBe(20);

    const voidTxn = await prisma.inventoryTransaction.findFirst({
      where: { orderId: order.id, type: "VOID" },
    });
    expect(voidTxn).toBeTruthy();

    const refund = await prisma.cashMovement.findFirst({
      where: { orderId: order.id, type: "REFUND" },
    });
    expect(refund).toBeTruthy();
    expect(Number(refund!.amount)).toBe(-650);
  });

  it("cashier cannot void; supervisor can", async () => {
    const prisma = await getPrisma();
    await openRegister(actor(fx.cashier), 2000);
    const order = await completeSale(actor(fx.cashier), {
      items: [{ productId: fx.untracked.id, quantity: 1 }],
      payments: [{ method: "CARD", amount: 150 }],
    });

    await expect(
      voidSale(actor(fx.cashier), order.id, "oops")
    ).rejects.toBeInstanceOf(ForbiddenError);

    await voidSale(actor(fx.supervisor), order.id, "Manager void");
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.status).toBe("VOIDED");
  });

  it("ReturnSale: validates completed sale and restores stock", async () => {
    const prisma = await getPrisma();
    await openRegister(actor(fx.cashier), 2000);
    const order = await completeSale(actor(fx.cashier), {
      items: [{ productId: fx.product.id, quantity: 3 }],
      payments: [{ method: "CASH", amount: 1950 }],
    });

    await returnSale(actor(fx.supervisor), order.id, "Customer return");

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(updated.status).toBe("RETURNED");

    const stock = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: fx.inventory.id },
    });
    expect(Number(stock.quantity)).toBe(20);

    const ret = await prisma.inventoryTransaction.findFirst({
      where: { orderId: order.id, type: "RETURN" },
    });
    expect(ret).toBeTruthy();
    expect(Number(ret!.quantity)).toBe(3);
  });

  it("Cash register: opening float, expected cash, close variance", async () => {
    const prisma = await getPrisma();
    const opened = await openRegister(actor(fx.cashier), 1000, "Start");
    expect(opened.status).toBe("OPEN");

    const floatMove = await prisma.cashMovement.findFirst({
      where: { registerSessionId: opened.id, type: "OPENING_FLOAT" },
    });
    expect(Number(floatMove!.amount)).toBe(1000);

    await completeSale(actor(fx.cashier), {
      items: [{ productId: fx.product.id, quantity: 1 }],
      payments: [{ method: "CASH", amount: 650 }],
    });

    const closed = await closeRegister(actor(fx.supervisor), 1600, "End");
    expect(closed.status).toBe("CLOSED");
    expect(Number(closed.expectedCash)).toBe(1650);
    expect(Number(closed.closingCounted)).toBe(1600);
    expect(Number(closed.variance)).toBe(-50);

    await expect(getOpenRegister()).resolves.toBeNull();
  });
});
