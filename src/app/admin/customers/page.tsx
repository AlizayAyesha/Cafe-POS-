import { listCustomers, upsertCustomer } from "@/actions/ospos";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const customers = await listCustomers(sp.q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Customers</h1>
        <p className="text-sm text-stone-600">
          Customer database (OSPOS-style) — attach to POS sales
        </p>
      </div>

      <form className="flex w-full gap-2">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Search name / phone"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="touch-btn shrink-0 rounded-lg bg-stone-900 px-3 py-2.5 text-sm text-white"
        >
          Search
        </button>
      </form>

      <form
        action={async (fd) => {
          "use server";
          await upsertCustomer(fd);
        }}
        className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5 md:grid-cols-2"
      >
        <h2 className="font-semibold md:col-span-2">Add customer</h2>
        <input
          name="name"
          required
          placeholder="Name"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="phone"
          placeholder="Phone"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="address"
          placeholder="Address"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="landmark"
          placeholder="Landmark"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <input
          name="notes"
          placeholder="Notes"
          className="w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="touch-btn w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white md:col-span-2 sm:w-fit"
        >
          Save customer
        </button>
      </form>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {customers.map((c) => (
          <div key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="font-semibold">{c.name}</p>
            <p className="text-sm text-stone-600">{c.phone || "No phone"}</p>
            {c.address && (
              <p className="mt-1 break-words text-sm text-stone-500">{c.address}</p>
            )}
            {c.notes && (
              <p className="mt-1 break-words text-xs text-stone-400">{c.notes}</p>
            )}
          </div>
        ))}
        {customers.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            No customers yet
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-stone-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.phone || "—"}</td>
                <td className="max-w-[14rem] truncate px-4 py-3" title={c.address || undefined}>
                  {c.address || "—"}
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3" title={c.notes || undefined}>
                  {c.notes || "—"}
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                  No customers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
