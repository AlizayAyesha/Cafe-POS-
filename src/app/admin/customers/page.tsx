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
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-stone-600">
          Customer database (OSPOS-style) — attach to POS sales
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={sp.q || ""}
          placeholder="Search name / phone"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white">
          Search
        </button>
      </form>

      <form
        action={async (fd) => {
          "use server";
          await upsertCustomer(fd);
        }}
        className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <h2 className="md:col-span-2 font-semibold">Add customer</h2>
        <input name="name" required placeholder="Name" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="phone" placeholder="Phone" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="address" placeholder="Address" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="landmark" placeholder="Landmark" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input name="notes" placeholder="Notes" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white md:col-span-2 w-fit">
          Save customer
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
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
                <td className="px-4 py-3">{c.address || "—"}</td>
                <td className="px-4 py-3">{c.notes || "—"}</td>
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
