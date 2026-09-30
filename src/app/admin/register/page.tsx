import { listRegisterSessions, getOpenRegister } from "@/actions/ospos";
import { getSettings } from "@/lib/settings";
import { formatMoney, toNumber } from "@/lib/money";
import { prisma } from "@/core/database";
import { requireRole } from "@/lib/session";
import { Role } from "@prisma/client";

async function getDrawerDetail(sessionId: string) {
  const movements = await prisma.cashMovement.findMany({
    where: { registerSessionId: sessionId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const orders = await prisma.order.findMany({
    where: { registerSessionId: sessionId, status: "COMPLETED" },
    include: {
      payments: true,
      createdBy: { select: { name: true } },
    },
  });

  let cashSales = 0;
  let cardSales = 0;
  let giftSales = 0;
  let otherSales = 0;
  const byStaff = new Map<string, { name: string; cash: number; card: number; total: number }>();

  for (const o of orders) {
    const staff = byStaff.get(o.createdById) || {
      name: o.createdBy.name,
      cash: 0,
      card: 0,
      total: 0,
    };
    for (const p of o.payments) {
      const amt = toNumber(p.amount);
      staff.total += amt;
      if (p.method === "CASH") {
        cashSales += amt;
        staff.cash += amt;
      } else if (p.method === "CARD") {
        cardSales += amt;
        staff.card += amt;
      } else if (p.method === "GIFT_CARD") giftSales += amt;
      else otherSales += amt;
    }
    byStaff.set(o.createdById, staff);
  }

  const opening = movements
    .filter((m) => m.type === "OPENING_FLOAT")
    .reduce((s, m) => s + toNumber(m.amount), 0);
  const refunds = movements
    .filter((m) => m.type === "REFUND")
    .reduce((s, m) => s + toNumber(m.amount), 0);
  const expenses = movements
    .filter((m) => m.type === "EXPENSE")
    .reduce((s, m) => s + toNumber(m.amount), 0);
  const expectedCash = movements.reduce((s, m) => s + toNumber(m.amount), 0);

  return {
    movements,
    cashSales,
    cardSales,
    giftSales,
    otherSales,
    byStaff: [...byStaff.values()],
    opening,
    refunds,
    expenses,
    expectedCash,
    orderCount: orders.length,
  };
}

export default async function RegisterPage() {
  await requireRole(Role.SUPERVISOR);
  const [sessions, settings, open] = await Promise.all([
    listRegisterSessions(),
    getSettings(),
    getOpenRegister(),
  ]);
  const money = (n: number) =>
    formatMoney(n, settings.currencySymbol, settings.currency);

  const openDetail = open ? await getDrawerDetail(open.id) : null;
  const latestClosed = sessions.find((s) => s.status === "CLOSED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl tracking-tight">Cash drawer</h1>
        <p className="text-sm text-[var(--muted)] max-w-2xl">
          Tracks physical cash only. Card / JazzCash stay in payment records — they do not
          enter the drawer. At close: count notes & coins, compare to expected, see variance.
          Closing counted cash is your <strong>rollover float</strong> for the next open.
        </p>
      </div>

      {open && openDetail ? (
        <section className="card-surface p-5 space-y-5 border-[var(--accent)]/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                Current shift · OPEN
              </p>
              <p className="text-sm text-[var(--muted)]">
                Opened {open.openedAt.toLocaleString()} by {open.openedBy.name}
              </p>
            </div>
            <span className="status-chip status-done">Live</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Opening float", value: money(openDetail.opening) },
              { label: "Cash sales in drawer", value: money(openDetail.cashSales) },
              { label: "Cash refunds / out", value: money(openDetail.refunds + openDetail.expenses) },
              { label: "Expected in drawer now", value: money(openDetail.expectedCash) },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-[var(--accent-soft)] p-4">
                <p className="text-xs text-[var(--muted)]">{c.label}</p>
                <p className="mt-1 text-xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold text-sm mb-2">Payments taken (this shift)</h3>
              <ul className="text-sm space-y-1 text-[var(--muted)]">
                <li className="flex justify-between">
                  <span>Cash (drawer)</span>
                  <strong className="text-[var(--ink)]">{money(openDetail.cashSales)}</strong>
                </li>
                <li className="flex justify-between">
                  <span>Card (not in drawer)</span>
                  <strong className="text-[var(--ink)]">{money(openDetail.cardSales)}</strong>
                </li>
                <li className="flex justify-between">
                  <span>Gift card</span>
                  <strong className="text-[var(--ink)]">{money(openDetail.giftSales)}</strong>
                </li>
                <li className="flex justify-between">
                  <span>Other</span>
                  <strong className="text-[var(--ink)]">{money(openDetail.otherSales)}</strong>
                </li>
                <li className="flex justify-between pt-2 border-t border-[var(--line)]">
                  <span>Orders</span>
                  <strong className="text-[var(--ink)]">{openDetail.orderCount}</strong>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">By cashier (who took pay)</h3>
              {openDetail.byStaff.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No sales yet this shift</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {openDetail.byStaff.map((s) => (
                    <li key={s.name} className="rounded-lg border border-[var(--line)] p-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-[var(--muted)] leading-relaxed">
                        <span className="block sm:inline">Cash {money(s.cash)}</span>
                        <span className="hidden sm:inline"> · </span>
                        <span className="block sm:inline">Card {money(s.card)}</span>
                        <span className="hidden sm:inline"> · </span>
                        <span className="block sm:inline">Total {money(s.total)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2">Drawer movement log</h3>
            <div className="max-h-48 overflow-y-auto text-sm">
              {openDetail.movements.map((m) => (
                <div
                  key={m.id}
                  className="flex justify-between gap-3 border-b border-[var(--line)] py-1.5"
                >
                  <span className="min-w-0 flex-1 break-words">
                    {m.type.replace(/_/g, " ")}
                    {m.note ? ` · ${m.note}` : ""}
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {m.user?.name || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {money(toNumber(m.amount))}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Close from the POS screen: enter counted cash → system shows variance vs expected.
            </p>
          </div>
        </section>
      ) : (
        <section className="card-surface p-5">
          <p className="font-medium">No register open</p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Open the drawer from POS with an opening float before the first sale.
          </p>
          {latestClosed && (
            <p className="text-sm mt-3 text-[var(--muted)]">
              Last close counted{" "}
              <strong className="text-[var(--ink)]">
                {latestClosed.closingCounted != null
                  ? money(toNumber(latestClosed.closingCounted))
                  : "—"}
              </strong>
              {" "}— use that as tomorrow&apos;s float (rollover).
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Shift history</h2>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {sessions.map((s) => (
            <div key={s.id} className="card-surface space-y-2 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{s.openedBy.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {s.openedAt.toLocaleString()}
                  </p>
                </div>
                <span
                  className={
                    s.status === "OPEN" ? "status-chip status-done" : "status-chip"
                  }
                >
                  {s.status}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-[var(--muted)]">Float</dt>
                <dd className="text-right tabular-nums">{money(toNumber(s.openingFloat))}</dd>
                <dt className="text-[var(--muted)]">Expected</dt>
                <dd className="text-right tabular-nums">
                  {s.expectedCash != null ? money(toNumber(s.expectedCash)) : "—"}
                </dd>
                <dt className="text-[var(--muted)]">Counted</dt>
                <dd className="text-right tabular-nums">
                  {s.closingCounted != null ? money(toNumber(s.closingCounted)) : "—"}
                </dd>
                <dt className="text-[var(--muted)]">Variance</dt>
                <dd
                  className={`text-right tabular-nums font-medium ${
                    s.variance != null && toNumber(s.variance) !== 0
                      ? "text-amber-800"
                      : "text-emerald-700"
                  }`}
                >
                  {s.variance != null ? money(toNumber(s.variance)) : "—"}
                </dd>
                <dt className="text-[var(--muted)]">Closed by</dt>
                <dd className="text-right">{s.closedBy?.name || "—"}</dd>
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="card-surface hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--accent-soft)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Opened</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Float</th>
                <th className="px-4 py-3 font-medium">Expected</th>
                <th className="px-4 py-3 font-medium">Counted</th>
                <th className="px-4 py-3 font-medium">Variance</th>
                <th className="px-4 py-3 font-medium">Closed by</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3">{s.openedAt.toLocaleString()}</td>
                  <td className="px-4 py-3">{s.openedBy.name}</td>
                  <td className="px-4 py-3">{money(toNumber(s.openingFloat))}</td>
                  <td className="px-4 py-3">
                    {s.expectedCash != null ? money(toNumber(s.expectedCash)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.closingCounted != null
                      ? money(toNumber(s.closingCounted))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.variance != null ? (
                      <span
                        className={
                          toNumber(s.variance) === 0
                            ? "font-medium text-emerald-700"
                            : "font-medium text-amber-800"
                        }
                      >
                        {money(toNumber(s.variance))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{s.closedBy?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.status === "OPEN"
                          ? "status-chip status-done"
                          : "status-chip"
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
