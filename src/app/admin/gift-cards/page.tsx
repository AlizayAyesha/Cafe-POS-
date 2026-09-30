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
        className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <h2 className="md:col-span-2 font-semibold">Issue gift card to customer</h2>
        <select
          name="customerId"
          required
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
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
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          name="code"
          placeholder="Code (auto if blank) e.g. TIS-AB12-CD34"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          name="expiresAt"
          type="date"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <input
          name="notes"
          placeholder="Notes"
          className="md:col-span-2 rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-fit rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Issue card
        </button>
      </form>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Search code / customer"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
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
                <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                <td className="px-4 py-3">
                  {c.customer.name}
                  <span className="block text-xs text-stone-500">
                    {c.customer.phone || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">{money(toNumber(c.balance))}</td>
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
                    <button type="submit" className="text-[var(--accent)] text-sm">
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
