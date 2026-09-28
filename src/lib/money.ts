import { fromRupees, toRupees, formatPkr } from "@/core/money";
import { Decimal } from "@prisma/client/runtime/library";

/** Display helpers (legacy). Authoritative math uses @/core/money paisa. */
export function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  return value.toNumber();
}

export function roundMoney(n: number): number {
  return toRupees(fromRupees(n));
}

export function formatMoney(
  amount: number | Decimal | string,
  currencySymbol = "Rs",
  _currencyCode?: string
): string {
  return formatPkr(fromRupees(toNumber(amount as Decimal)), currencySymbol);
}

export function moneyEqual(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) < epsilon;
}
