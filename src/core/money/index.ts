/**
 * Money as integer minor units (paisa for PKR).
 * 1 PKR = 100 paisa. Never use float for authoritative totals.
 */

export type Money = number; // paisa (integer)

export function assertMoney(paisa: number): Money {
  if (!Number.isFinite(paisa) || !Number.isInteger(paisa)) {
    throw new Error(`Invalid money amount (must be integer paisa): ${paisa}`);
  }
  return paisa;
}

/** Convert rupees (decimal display) → paisa */
export function fromRupees(rupees: number | string): Money {
  const n = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(n)) return 0;
  return assertMoney(Math.round(n * 100));
}

/** Convert paisa → rupees number for display / Decimal columns */
export function toRupees(paisa: Money): number {
  return assertMoney(paisa) / 100;
}

export function addMoney(...amounts: Money[]): Money {
  return assertMoney(amounts.reduce((s, a) => s + assertMoney(a), 0));
}

export function subMoney(a: Money, b: Money): Money {
  return assertMoney(assertMoney(a) - assertMoney(b));
}

export function mulQty(unitPaisa: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`Invalid quantity: ${qty}`);
  }
  return assertMoney(assertMoney(unitPaisa) * qty);
}

export function percentOf(amount: Money, percent: number): Money {
  return assertMoney(Math.round((assertMoney(amount) * percent) / 100));
}

export function moneyEqual(a: Money, b: Money): boolean {
  return assertMoney(a) === assertMoney(b);
}

export function minMoney(a: Money, b: Money): Money {
  return assertMoney(a) <= assertMoney(b) ? a : b;
}

export function formatPkr(paisa: Money, symbol = "Rs"): string {
  const rupees = toRupees(paisa);
  return `${symbol} ${rupees.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
