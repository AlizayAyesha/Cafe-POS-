import { getProductSalesReport, getPeakHourAnalysis } from "@/actions/admin";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";

export default async function AnalyticsPage() {
  const [sales, hours, settings] = await Promise.all([
    getProductSalesReport(),
    getPeakHourAnalysis(14),
    getSettings(),
  ]);
  const money = (n: number) =>
    formatMoney(n, settings.currencySymbol, settings.currency);

  const ranked = [...sales].sort((a, b) => b.qty - a.qty);
  const top = ranked.slice(0, 8);
  const low = [...ranked].reverse().slice(0, 8);
  const maxQty = Math.max(...top.map((t) => t.qty), 1);
  const busyHours = hours.filter((h) => h.orders > 0);
  const maxHourOrders = Math.max(...hours.map((h) => h.orders), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl tracking-tight">Analytics</h1>
        <p className="text-sm text-[var(--muted)]">
          What sells, what sits, and when you are busiest
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="font-semibold mb-1">Most bought</h2>
          <p className="text-xs text-[var(--muted)] mb-4">Top products by quantity sold</p>
          <ul className="space-y-3">
            {top.map((row) => (
              <li key={row.product}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate pr-2 font-medium">{row.product}</span>
                  <span className="shrink-0 text-right text-[var(--muted)]">
                    <span className="block sm:inline">{row.qty}</span>
                    <span className="hidden sm:inline"> · </span>
                    <span className="block sm:inline">{money(row.revenue)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--accent-soft)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(row.qty / maxQty) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {top.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No sales yet</li>
            )}
          </ul>
        </section>

        <section className="card-surface p-5">
          <h2 className="font-semibold mb-1">Lowest movers</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            Softest demand — review price or promote
          </p>
          <ul className="space-y-3">
            {low.map((row) => (
              <li key={`low-${row.product}`}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate pr-2 font-medium">{row.product}</span>
                  <span className="shrink-0 text-right text-[var(--muted)]">
                    <span className="block sm:inline">{row.qty} sold</span>
                    <span className="hidden sm:inline"> · </span>
                    <span className="block sm:inline">{money(row.revenue)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-300"
                    style={{
                      width: `${Math.max(8, (row.qty / maxQty) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
            {low.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No sales yet</li>
            )}
          </ul>
        </section>
      </div>

      <section className="card-surface p-5">
        <h2 className="font-semibold mb-1">Peak hours (14 days)</h2>
        <p className="text-xs text-[var(--muted)] mb-4">Orders by hour of day</p>
        <div className="scroll-x-touch -mx-1 px-1">
          <div className="flex h-40 min-w-[480px] items-end gap-1">
            {hours.map((h) => (
              <div
                key={h.hour}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${h.hour}:00 — ${h.orders} orders, ${money(h.revenue)}`}
              >
                <div
                  className="min-h-[2px] w-full rounded-t bg-[var(--accent)]"
                  style={{
                    height: `${(h.orders / maxHourOrders) * 100}%`,
                    opacity: h.orders ? 1 : 0.15,
                  }}
                />
                <span className="text-[9px] text-[var(--muted)]">
                  {h.hour % 3 === 0 ? h.hour : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
        {busyHours.length > 0 && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Busiest:{" "}
            <strong className="text-[var(--ink)]">
              {
                [...hours].sort((a, b) => b.orders - a.orders)[0].hour
              }
              :00
            </strong>
          </p>
        )}
      </section>
    </div>
  );
}
