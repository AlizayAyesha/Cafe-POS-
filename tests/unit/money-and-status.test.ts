import { describe, it, expect } from "vitest";
import {
  fromRupees,
  toRupees,
  addMoney,
  subMoney,
  mulQty,
  percentOf,
  moneyEqual,
} from "@/core/money";
import { canTransition } from "@/modules/sales/domain/order-status";
import {
  hasMinRole,
  canVoidSales,
  canCloseRegister,
  canManageStaff,
} from "@/core/permissions";

describe("money (paisa)", () => {
  it("rounds rupees to integer paisa without float drift", () => {
    expect(fromRupees(10.1)).toBe(1010);
    expect(fromRupees(0.1 + 0.2)).toBe(30); // classic float trap → 30 paisa
    expect(toRupees(125000)).toBe(1250);
  });

  it("computes line totals and discounts in paisa", () => {
    const unit = fromRupees(650);
    const line = mulQty(unit, 2);
    expect(line).toBe(130000);
    const discount = percentOf(line, 10);
    expect(discount).toBe(13000);
    expect(subMoney(line, discount)).toBe(117000);
  });

  it("validates payment equality", () => {
    const total = fromRupees(1000);
    const cash = fromRupees(600);
    const card = fromRupees(400);
    expect(moneyEqual(addMoney(cash, card), total)).toBe(true);
  });
});

describe("order status machine", () => {
  it("allows COMPLETED → VOIDED / RETURNED only", () => {
    expect(canTransition("COMPLETED", "VOIDED")).toBe(true);
    expect(canTransition("COMPLETED", "RETURNED")).toBe(true);
    expect(canTransition("COMPLETED", "HELD")).toBe(false);
    expect(canTransition("VOIDED", "COMPLETED")).toBe(false);
  });

  it("allows HELD → COMPLETED", () => {
    expect(canTransition("HELD", "COMPLETED")).toBe(true);
    expect(canTransition("HELD", "OPEN")).toBe(true);
  });
});

describe("server-side role gates", () => {
  it("enforces cashier < supervisor < admin", () => {
    expect(hasMinRole("CASHIER", "CASHIER")).toBe(true);
    expect(hasMinRole("CASHIER", "SUPERVISOR")).toBe(false);
    expect(canVoidSales("CASHIER")).toBe(false);
    expect(canVoidSales("SUPERVISOR")).toBe(true);
    expect(canCloseRegister("CASHIER")).toBe(false);
    expect(canCloseRegister("SUPERVISOR")).toBe(true);
    expect(canManageStaff("SUPERVISOR")).toBe(false);
    expect(canManageStaff("ADMIN")).toBe(true);
  });
});
