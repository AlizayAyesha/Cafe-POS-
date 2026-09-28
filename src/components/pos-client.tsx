"use client";

import { useMemo, useState, useTransition } from "react";
import { completeOrder, deleteHeldOrder } from "@/actions/orders";
import { openRegister, closeRegister } from "@/actions/ospos";
import { lookupGiftCard } from "@/actions/gift-cards";
import { formatMoney, roundMoney } from "@/lib/money";
import type { DiscountType, OrderType, PaymentMethod } from "@prisma/client";
import Link from "next/link";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  sku: string | null;
  imageUrl?: string | null;
};
type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
};
type Customer = { id: string; name: string; phone: string | null };
type HeldOrder = {
  id: string;
  orderNumber: string;
  total: number;
  orderType: OrderType;
  discountType: DiscountType;
  discountValue: number;
  notes: string | null;
  customerId: string | null;
  items: CartLine[];
};

type Props = {
  categories: Category[];
  products: Product[];
  settings: {
    cafeName: string;
    currencySymbol: string;
    currency: string;
    receiptFooter: string;
    address: string;
  };
  staffName: string;
  showAdminLink: boolean;
  canCloseRegister: boolean;
  signOutAction: () => Promise<void>;
  register: {
    id: string;
    openingFloat: number;
    openedAt: string;
    openedBy: string;
  } | null;
  customers: Customer[];
  heldOrders: HeldOrder[];
};

export function PosClient({
  categories,
  products,
  settings,
  staffName,
  showAdminLink,
  canCloseRegister,
  signOutAction,
  register: initialRegister,
  customers,
  heldOrders: initialHeld,
}: Props) {
  const [categoryId, setCategoryId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [heldOrderId, setHeldOrderId] = useState<string | null>(null);
  const [heldOrders, setHeldOrders] = useState(initialHeld);
  const [register, setRegister] = useState(initialRegister);
  const [floatInput, setFloatInput] = useState("2000");
  const [closeCount, setCloseCount] = useState("");
  const [payments, setPayments] = useState<
    { method: PaymentMethod; amount: string; giftCardCode?: string }[]
  >([{ method: "CASH", amount: "" }]);
  const [giftLookup, setGiftLookup] = useState<string>("");
  const [giftInfo, setGiftInfo] = useState<{
    code: string;
    balance: number;
    customerName: string;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{
    orderNumber: string;
    items: CartLine[];
    notes: string;
    payments: { method: PaymentMethod; amount: number }[];
    subtotal: number;
    discountAmount: number;
    total: number;
    orderType: OrderType;
    at: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const money = (n: number) => formatMoney(n, settings.currencySymbol);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== "all" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    });
  }, [products, categoryId, search]);

  const subtotal = roundMoney(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  const dVal = parseFloat(discountValue) || 0;
  const discountAmount =
    discountType === "PERCENT"
      ? roundMoney(Math.min(subtotal, (subtotal * dVal) / 100))
      : discountType === "FIXED"
        ? roundMoney(Math.min(subtotal, dVal))
        : 0;
  const total = roundMoney(subtotal - discountAmount);

  function addProduct(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }];
    });
    setError("");
  }

  function setQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity } : l))
    );
  }

  function clearOrder() {
    setCart([]);
    setOrderNotes("");
    setPayments([{ method: "CASH", amount: "" }]);
    setDiscountType("NONE");
    setDiscountValue("");
    setCustomerId("");
    setHeldOrderId(null);
    setOrderType("TAKEAWAY");
    setGiftLookup("");
    setGiftInfo(null);
    setError("");
  }

  function loadHeld(h: HeldOrder) {
    setHeldOrderId(h.id);
    setCart(h.items.filter((i) => i.productId));
    setOrderType(h.orderType);
    setDiscountType(h.discountType);
    setDiscountValue(h.discountValue ? String(h.discountValue) : "");
    setOrderNotes(h.notes || "");
    setCustomerId(h.customerId || "");
    setError("");
  }

  function fillRemaining(index: number) {
    const other = payments.reduce((s, p, i) => {
      if (i === index) return s;
      return s + (parseFloat(p.amount) || 0);
    }, 0);
    const remaining = roundMoney(Math.max(0, total - other));
    setPayments((prev) =>
      prev.map((p, i) => (i === index ? { ...p, amount: String(remaining) } : p))
    );
  }

  function runSale(hold: boolean) {
    if (!register && !hold) {
      setError("Open the cash register before completing a sale");
      return;
    }
    if (cart.length === 0) {
      setError("Add items to the order first");
      return;
    }
    const parsedPayments = hold
      ? []
      : payments
          .map((p) => ({
            method: p.method,
            amount: roundMoney(parseFloat(p.amount) || 0),
            giftCardCode: p.giftCardCode || undefined,
          }))
          .filter((p) => p.amount > 0);

    if (!hold && parsedPayments.length === 0) {
      setError("Enter payment amount(s)");
      return;
    }
    for (const p of parsedPayments) {
      if (p.method === "GIFT_CARD" && !p.giftCardCode) {
        setError("Enter gift card code for gift card payment");
        return;
      }
    }

    startTransition(async () => {
      try {
        const order = await completeOrder({
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            notes: l.notes,
          })),
          notes: orderNotes || undefined,
          payments: hold ? undefined : parsedPayments,
          orderType,
          discountType,
          discountValue: dVal,
          customerId: customerId || null,
          hold,
          heldOrderId,
        });
        if (hold) {
          setHeldOrders((prev) => {
            const mapped: HeldOrder = {
              id: order.id,
              orderNumber: order.orderNumber,
              total: Number(order.total),
              orderType,
              discountType,
              discountValue: dVal,
              notes: orderNotes || null,
              customerId: customerId || null,
              items: cart,
            };
            const rest = prev.filter((h) => h.id !== order.id);
            return [mapped, ...rest];
          });
          clearOrder();
          return;
        }
        setLastReceipt({
          orderNumber: order.orderNumber,
          items: cart,
          notes: orderNotes,
          payments: parsedPayments,
          subtotal,
          discountAmount,
          total,
          orderType,
          at: new Date().toLocaleString(),
        });
        setHeldOrders((prev) => prev.filter((h) => h.id !== heldOrderId));
        clearOrder();
        setTimeout(() => window.print(), 200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed");
      }
    });
  }

  function doOpenRegister() {
    startTransition(async () => {
      try {
        const reg = await openRegister(parseFloat(floatInput) || 0);
        setRegister({
          id: reg.id,
          openingFloat: Number(reg.openingFloat),
          openedAt: new Date().toISOString(),
          openedBy: staffName,
        });
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open register");
      }
    });
  }

  function doCloseRegister() {
    startTransition(async () => {
      try {
        await closeRegister(parseFloat(closeCount) || 0);
        setRegister(null);
        setCloseCount("");
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not close register");
      }
    });
  }

  if (!register) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">{settings.cafeName}</h1>
          <p className="mt-1 text-sm text-stone-600">
            Open cash register to start selling (OSPOS-style cash up)
          </p>
          <label className="mt-4 block text-sm">
            Opening float ({settings.currencySymbol})
            <input
              type="number"
              value={floatInput}
              onChange={(e) => setFloatInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={doOpenRegister}
            className="mt-4 w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white"
          >
            {pending ? "Opening…" : "Open register"}
          </button>
          <div className="mt-4 flex justify-between text-sm">
            {showAdminLink && (
              <Link href="/admin" className="text-[var(--accent)]">
                Admin
              </Link>
            )}
            <form action={signOutAction}>
              <button type="submit" className="text-stone-500">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--sidebar)] px-4 py-3 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {settings.cafeName}
          </p>
          <p className="text-sm text-emerald-100/70">
            POS · {staffName} · Register open (float {money(register.openingFloat)})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCloseRegister && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Counted cash"
                value={closeCount}
                onChange={(e) => setCloseCount(e.target.value)}
                className="w-28 rounded-lg border-0 bg-white/10 px-2 py-2 text-sm text-white placeholder:text-stone-400"
              />
              <button
                type="button"
                onClick={doCloseRegister}
                className="touch-btn rounded-lg bg-red-800/80 px-3 py-2 text-sm"
              >
                Cash up
              </button>
            </div>
          )}
          {showAdminLink && (
            <Link
              href="/admin"
              className="touch-btn rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Admin
            </Link>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className="touch-btn rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Quick lookup — name or SKU"
              className="touch-btn flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base outline-none focus:border-[var(--accent)]"
            />
          </div>
          {heldOrders.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {heldOrders.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => loadHeld(h)}
                  className="touch-btn shrink-0 rounded-xl border border-emerald-300 bg-[var(--accent-soft)] px-3 py-2 text-left text-sm"
                >
                  <span className="font-medium">{h.orderNumber}</span>
                  <span className="ml-2 text-stone-600">{money(h.total)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`touch-btn shrink-0 rounded-full px-4 text-sm font-medium ${
                categoryId === "all"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-stone-200 bg-white text-stone-700"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`touch-btn shrink-0 rounded-full px-4 text-sm font-medium ${
                  categoryId === c.id
                    ? "bg-[var(--accent)] text-white"
                    : "border border-stone-200 bg-white text-stone-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="flex min-h-[120px] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-left shadow-sm active:scale-[0.98] hover:border-[var(--accent)]"
              >
                <div className="aspect-[5/3] w-full bg-[var(--accent-soft)]">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--muted)]">
                      No photo
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <span className="font-semibold text-[var(--ink)] leading-snug">
                    {p.name}
                  </span>
                  <span className="mt-auto pt-2 text-lg font-bold text-[var(--accent)]">
                    {money(p.price)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="flex w-full flex-col border-t border-stone-200 bg-white lg:w-[400px] lg:border-l lg:border-t-0">
          <div className="border-b border-stone-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Current order {heldOrderId ? "(held)" : ""}
              </h2>
              <button
                type="button"
                onClick={clearOrder}
                className="text-sm text-stone-500 hover:text-red-700"
              >
                Clear
              </button>
            </div>
            <div className="mt-2 flex gap-1">
              {(["TAKEAWAY", "DINE_IN", "DELIVERY"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    orderType === t ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {t.replace("_", "-")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {cart.length === 0 && (
              <p className="text-sm text-stone-500">Tap products to add them</p>
            )}
            {cart.map((l) => (
              <div
                key={l.productId}
                className="rounded-xl border border-stone-100 bg-stone-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-sm text-stone-500">{money(l.unitPrice)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQty(l.productId, 0)}
                    className="text-xs text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="touch-btn rounded-lg bg-stone-200 px-3 font-bold"
                    onClick={() => setQty(l.productId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="min-w-8 text-center font-semibold">{l.quantity}</span>
                  <button
                    type="button"
                    className="touch-btn rounded-lg bg-stone-200 px-3 font-bold"
                    onClick={() => setQty(l.productId, l.quantity + 1)}
                  >
                    +
                  </button>
                  <span className="ml-auto font-semibold">
                    {money(roundMoney(l.unitPrice * l.quantity))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-stone-100 p-4">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="rounded-lg border border-stone-200 px-2 text-sm"
              >
                <option value="NONE">No discount</option>
                <option value="PERCENT">% off</option>
                <option value="FIXED">Fixed off</option>
              </select>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                disabled={discountType === "NONE"}
                placeholder="Discount"
                className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm disabled:opacity-40"
              />
            </div>

            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Order notes (optional)"
              rows={2}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Payment (split OK)</span>
                <button
                  type="button"
                  className="text-[var(--accent)]"
                  onClick={() =>
                    setPayments((p) => [...p, { method: "CARD", amount: "" }])
                  }
                >
                  + Split
                </button>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-[var(--accent-soft)]/80 p-2 space-y-2">
                <p className="text-xs font-medium text-[var(--accent-dark)]">
                  Repeat customer gift card
                </p>
                <div className="flex gap-2">
                  <input
                    value={giftLookup}
                    onChange={(e) => setGiftLookup(e.target.value.toUpperCase())}
                    placeholder="Gift card code"
                    className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={pending || !giftLookup.trim()}
                    className="touch-btn shrink-0 rounded-lg bg-stone-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          const info = await lookupGiftCard(giftLookup);
                          if (!info) {
                            setGiftInfo(null);
                            setError("Gift card not found, inactive, or expired");
                            return;
                          }
                          setGiftInfo({
                            code: info.code,
                            balance: info.balance,
                            customerName: info.customerName,
                          });
                          setCustomerId(info.customerId);
                          setError("");
                          const applyAmt = Math.min(info.balance, total || info.balance);
                          setPayments((prev) => {
                            const rest = prev.filter(
                              (x) => x.method !== "GIFT_CARD" && (parseFloat(x.amount) || 0) > 0
                            );
                            const giftLine = {
                              method: "GIFT_CARD" as PaymentMethod,
                              amount: String(applyAmt),
                              giftCardCode: info.code,
                            };
                            const remainder = roundMoney(Math.max(0, total - applyAmt));
                            if (remainder > 0) {
                              return [
                                giftLine,
                                ...rest,
                                { method: "CASH" as PaymentMethod, amount: String(remainder) },
                              ];
                            }
                            return [giftLine];
                          });
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Lookup failed");
                        }
                      })
                    }
                  >
                    Apply
                  </button>
                </div>
                {giftInfo && (
                  <p className="text-xs text-green-800">
                    {giftInfo.code} · {giftInfo.customerName} · balance{" "}
                    {money(giftInfo.balance)}
                  </p>
                )}
              </div>

              {payments.map((p, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <select
                    value={p.method}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? {
                                ...x,
                                method: e.target.value as PaymentMethod,
                                giftCardCode:
                                  e.target.value === "GIFT_CARD"
                                    ? x.giftCardCode || giftInfo?.code || ""
                                    : undefined,
                              }
                            : x
                        )
                      )
                    }
                    className="touch-btn rounded-lg border border-stone-200 px-2"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="GIFT_CARD">Gift card</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {p.method === "GIFT_CARD" && (
                    <input
                      value={p.giftCardCode || ""}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((x, idx) =>
                            idx === i
                              ? {
                                  ...x,
                                  giftCardCode: e.target.value.toUpperCase(),
                                }
                              : x
                          )
                        )
                      }
                      placeholder="Code"
                      className="w-28 rounded-lg border border-stone-200 px-2 text-sm"
                    />
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.amount}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, amount: e.target.value } : x
                        )
                      )
                    }
                    onFocus={() => {
                      if (!p.amount) fillRemaining(i);
                    }}
                    placeholder="Amount"
                    className="touch-btn min-w-0 flex-1 rounded-lg border border-stone-200 px-3"
                  />
                  {payments.length > 1 && (
                    <button
                      type="button"
                      className="text-sm text-stone-500"
                      onClick={() =>
                        setPayments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>−{money(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending || cart.length === 0}
                onClick={() => runSale(true)}
                className="touch-btn rounded-xl border border-stone-300 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Hold
              </button>
              <button
                type="button"
                disabled={pending || cart.length === 0}
                onClick={() => runSale(false)}
                className="touch-btn rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white hover:bg-[var(--accent-dark)] disabled:opacity-50"
              >
                {pending ? "…" : "Complete"}
              </button>
            </div>
            {heldOrderId && (
              <button
                type="button"
                className="w-full text-sm text-red-700"
                onClick={() =>
                  startTransition(async () => {
                    await deleteHeldOrder(heldOrderId);
                    setHeldOrders((prev) => prev.filter((h) => h.id !== heldOrderId));
                    clearOrder();
                  })
                }
              >
                Discard held order
              </button>
            )}
          </div>
        </aside>
      </div>

      {lastReceipt && (
        <div id="receipt-print" className="hidden p-4 text-sm print:block">
          <h1 className="text-lg font-bold">{settings.cafeName}</h1>
          <p>{settings.address}</p>
          <p className="mt-2">Order: {lastReceipt.orderNumber}</p>
          <p>{lastReceipt.at}</p>
          <p>
            {lastReceipt.orderType.replace("_", "-")} · Cashier: {staffName}
          </p>
          <hr className="my-2" />
          {lastReceipt.items.map((l) => (
            <div key={l.productId} className="flex justify-between">
              <span>
                {l.quantity}× {l.name}
              </span>
              <span>{money(roundMoney(l.unitPrice * l.quantity))}</span>
            </div>
          ))}
          <hr className="my-2" />
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(lastReceipt.subtotal)}</span>
          </div>
          {lastReceipt.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>−{money(lastReceipt.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{money(lastReceipt.total)}</span>
          </div>
          {lastReceipt.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.method}</span>
              <span>{money(p.amount)}</span>
            </div>
          ))}
          {lastReceipt.notes && <p className="mt-2">Notes: {lastReceipt.notes}</p>}
          <p className="mt-4">{settings.receiptFooter}</p>
        </div>
      )}
    </div>
  );
}
