import { getDashboardStats } from "@/actions/admin";
import { getSettings } from "@/lib/settings";
import { formatMoney, toNumber } from "@/lib/money";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [stats, settings] = await Promise.all([getDashboardStats(), getSettings()]);
  const money = (n: number) =>
    formatMoney(n, settings.currencySymbol, settings.currency);

  const cards = [
    { label: "Today's sales", value: money(stats.todayRevenue) },
    { label: "Orders today", value: String(stats.orderCount) },
    { label: "Avg order", value: money(stats.avgOrder) },
    { label: "Weekly revenue", value: money(stats.weekRevenue) },
    { label: "Monthly revenue", value: money(stats.monthRevenue) },
    { label: "Low stock", value: String(stats.lowStock.length) },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">Dashboard</h1>
        <p className="text-sm text-stone-600">
          {settings.cafeName} · operational overview
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500 sm:text-xs">
              {c.label}
            </p>
            <p className="mt-1 break-all text-lg font-bold text-stone-900 sm:mt-2 sm:text-2xl">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Best sellers today</h2>
            <Link href="/admin/reports" className="text-sm text-[var(--accent)]">
              Reports
            </Link>
          </div>
          {stats.bestSellers.length === 0 ? (
            <p className="text-sm text-stone-500">No sales yet today</p>
          ) : (
            <ul className="space-y-2">
              {stats.bestSellers.map((b) => (
                <li
                  key={b.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate pr-2">{b.name}</span>
                  <span className="shrink-0 text-right text-stone-500">
                    {b.qty} · {money(b.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Low stock</h2>
            <Link href="/admin/inventory" className="text-sm text-[var(--accent)]">
              Inventory
            </Link>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-stone-500">All stock levels OK</p>
          ) : (
            <ul className="space-y-2">
              {stats.lowStock.slice(0, 8).map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="shrink-0 font-medium text-[var(--accent)]">
                    {toNumber(i.quantity)} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-[var(--accent)]">
            View all
          </Link>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {stats.recentOrders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-xs text-stone-500">
                  {o.createdAt.toLocaleString()} · {o.createdBy.name}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {money(toNumber(o.total))}
              </p>
            </Link>
          ))}
          {stats.recentOrders.length === 0 && (
            <p className="py-6 text-center text-sm text-stone-500">No orders yet</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-100 text-stone-500">
              <tr>
                <th className="pb-2 font-medium">Order</th>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Staff</th>
                <th className="pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-stone-50">
                  <td className="py-2.5 font-medium">
                    <Link href={`/admin/orders/${o.id}`} className="text-[var(--accent)]">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 text-stone-600">
                    {o.createdAt.toLocaleString()}
                  </td>
                  <td className="py-2.5">{o.createdBy.name}</td>
                  <td className="py-2.5 tabular-nums">{money(toNumber(o.total))}</td>
                </tr>
              ))}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-stone-500">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
