import { listGiftCards, issueGiftCard, reloadGiftCard, toggleGiftCard } from "@/actions/gift-cards";
import { listCustomers } from "@/actions/ospos";
import { getSettings } from "@/lib/settings";
import { formatMoney, toNumber } from "@/lib/money";

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const [cards, customers, settings] = await Promise.all([
    listGiftCards(sp.q),
    listCustomers(),
    getSettings(),
  ]);
  const money = (n: number) => formatMoney(n, settings.currencySymbol);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Gift cards</h1>
        <p className="text-sm text-stone-600">
          Prepaid balances for repeat customers — issue, reload, redeem on POS
        </p>
      </div>

      <form
        action={async (fd) => {
          "use server";
          await issueGiftCard(fd);
        }}
        className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2"
      >
        <h2 className="font-semibold md:col-span-2">Issue gift card to customer</h2>
        <select
          name="customerId"
          required
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        >
          <option value="">Select customer *</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
        </select>
        <input
          name="amount"
          type="number"
          min="1"
          step="0.01"
          required
          placeholder="Initial balance"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="code"
          placeholder="Code (auto if blank)"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="expiresAt"
          type="date"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="notes"
          placeholder="Notes"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm md:col-span-2"
        />
        <button
          type="submit"
          className="touch-btn w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white sm:w-fit"
        >
          Issue card
        </button>
      </form>

      <form className="flex w-full gap-2">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Search code / customer"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="touch-btn shrink-0 rounded-lg bg-stone-900 px-3 py-2.5 text-sm text-white"
        >
          Search
        </button>
      </form>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {cards.map((c) => (
          <div key={c.id} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-all font-mono text-sm font-semibold">{c.code}</p>
                <p className="text-sm">{c.customer.name}</p>
                <p className="text-xs text-stone-500">{c.customer.phone || "—"}</p>
              </div>
              <p className="shrink-0 font-bold tabular-nums">{money(toNumber(c.balance))}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                action={async () => {
                  "use server";
                  await toggleGiftCard(c.id, !c.active);
                }}
              >
                <button
                  type="submit"
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.active
                      ? "bg-green-100 text-green-800"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {c.active ? "Active" : "Inactive"}
                </button>
              </form>
            </div>
            <form
              action={async (fd) => {
                "use server";
                await reloadGiftCard(fd);
              }}
              className="flex gap-2"
            >
              <input type="hidden" name="id" value={c.id} />
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="Reload amount"
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="touch-btn shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
              >
                Add
              </button>
            </form>
          </div>
        ))}
        {cards.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            No gift cards yet — issue one to a customer above
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reload</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-stone-50 align-top">
                <td className="px-4 py-3 break-all font-mono font-medium">{c.code}</td>
                <td className="px-4 py-3">
                  {c.customer.name}
                  <span className="block text-xs text-stone-500">
                    {c.customer.phone || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{money(toNumber(c.balance))}</td>
                <td className="px-4 py-3">
                  <form
                    action={async () => {
                      "use server";
                      await toggleGiftCard(c.id, !c.active);
                    }}
                  >
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.active
                          ? "bg-green-100 text-green-800"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {c.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <form
                    action={async (fd) => {
                      "use server";
                      await reloadGiftCard(fd);
                    }}
                    className="flex gap-1"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      placeholder="Amount"
                      className="w-24 rounded border border-stone-300 px-2 py-1 text-sm"
                    />
                    <button type="submit" className="text-sm text-[var(--accent)]">
                      Add
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No gift cards yet — issue one to a customer above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
