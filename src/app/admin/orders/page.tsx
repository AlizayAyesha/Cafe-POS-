import { listOrders, setOrderFulfillment } from "@/actions/orders";
import { getSettings } from "@/lib/settings";
import { formatMoney, toNumber } from "@/lib/money";
import Link from "next/link";
import {
  fulfillmentChipClass,
  fulfillmentLabel,
} from "@/modules/sales/application/fulfillment";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const [orders, settings] = await Promise.all([
    listOrders({ q: sp.q, from: sp.from, to: sp.to }),
    getSettings(),
  ]);
  const money = (n: number) =>
    formatMoney(n, settings.currencySymbol, settings.currency);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Orders</h1>
        <p className="text-sm text-[var(--muted)]">
          Paid sales start as <strong>In process</strong> — mark Delivered, then Complete
          when handed to the guest
        </p>
      </div>

      <form className="card-surface flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:p-4">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Order #, staff, notes"
          className="w-full min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm sm:min-w-[180px]"
        />
        <div className="flex gap-2">
          <input
            name="from"
            type="date"
            defaultValue={sp.from || ""}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm sm:w-auto sm:flex-none"
          />
          <input
            name="to"
            type="date"
            defaultValue={sp.to || ""}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm sm:w-auto sm:flex-none"
          />
        </div>
        <button type="submit" className="btn-primary touch-btn w-full px-4 py-2.5 text-sm sm:w-auto">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {orders.map((o) => {
          const paid = o.status === "COMPLETED";
          const voided = o.status === "VOIDED" || o.status === "RETURNED";
          return (
            <div key={o.id} className="card-surface p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-semibold text-[var(--accent)]"
                  >
                    {o.orderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {o.createdAt.toLocaleString()} · {o.createdBy.name} ·{" "}
                    {o.orderType.replace("_", " ")}
                  </p>
                  <p className="mt-2 break-words text-sm leading-snug">
                    {o.items
                      .map((i) => `${i.quantity}× ${i.productName}`)
                      .join(", ")}
                  </p>
                  <p className="mt-1 break-words text-xs text-[var(--muted)]">
                    Pay:{" "}
                    {o.payments
                      .map((p) => `${p.method} ${money(toNumber(p.amount))}`)
                      .join(" + ")}
                  </p>
                </div>
                <div className="shrink-0 space-y-2 text-right">
                  <p className="text-lg font-bold tabular-nums">{money(toNumber(o.total))}</p>
                  {voided ? (
                    <span className="status-chip status-void">{o.status}</span>
                  ) : paid ? (
                    <span className={fulfillmentChipClass(o.fulfillmentStatus)}>
                      {fulfillmentLabel(o.fulfillmentStatus)}
                    </span>
                  ) : (
                    <span className="status-chip">{o.status}</span>
                  )}
                </div>
              </div>

              {paid && !voided && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                  {(
                    [
                      ["IN_PROCESS", "In process"],
                      ["DELIVERED", "Delivered"],
                      ["DONE", "Complete"],
                    ] as const
                  ).map(([value, label]) => (
                    <form
                      key={value}
                      action={async () => {
                        "use server";
                        await setOrderFulfillment(o.id, value);
                      }}
                    >
                      <button
                        type="submit"
                        className={`touch-btn rounded-lg px-3 py-2 text-sm font-medium border transition ${
                          o.fulfillmentStatus === value
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {label}
                      </button>
                    </form>
                  ))}
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="touch-btn rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    Details →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
        {orders.length === 0 && (
          <p className="card-surface p-8 text-center text-[var(--muted)]">
            No orders yet
          </p>
        )}
      </div>
    </div>
  );
}
