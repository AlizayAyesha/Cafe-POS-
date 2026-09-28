import {
  listInventory,
  listSuppliers,
  listInventoryHistory,
  upsertInventoryItem,
  upsertSupplier,
} from "@/actions/inventory";
import { toNumber } from "@/lib/money";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";

export default async function InventoryPage() {
  const [items, suppliers, history] = await Promise.all([
    listInventory(),
    listSuppliers(),
    listInventoryHistory(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-stone-600">
          Stock levels, adjustments, suppliers, history
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          action={async (fd) => {
            "use server";
            await upsertInventoryItem(fd);
          }}
          className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-semibold">Add inventory item</h2>
          <input
            name="name"
            required
            placeholder="Name"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="sku"
              placeholder="SKU"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              name="unit"
              defaultValue="pcs"
              placeholder="Unit"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              name="quantity"
              type="number"
              step="0.001"
              defaultValue={0}
              placeholder="Opening qty"
              title="Opening stock is recorded as an ADD ledger movement"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              name="minThreshold"
              type="number"
              step="0.001"
              defaultValue={0}
              placeholder="Low stock"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <select
            name="supplierId"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Create item
          </button>
        </form>

        <form
          action={async (fd) => {
            "use server";
            await upsertSupplier(fd);
          }}
          className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <h2 className="font-semibold">Add supplier</h2>
          <input
            name="name"
            required
            placeholder="Supplier name"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            name="contact"
            placeholder="Contact"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            placeholder="Notes / log"
            rows={2}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Save supplier
          </button>
        </form>
      </div>

      <InventoryAdjustForm
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: toNumber(i.quantity),
        }))}
      />

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Min</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const qty = toNumber(i.quantity);
              const min = toNumber(i.minThreshold);
              const low = qty <= min;
              return (
                <tr key={i.id} className="border-b border-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-stone-500">{i.sku || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {qty} {i.unit}
                  </td>
                  <td className="px-4 py-3">{min}</td>
                  <td className="px-4 py-3">{i.supplier?.name || "—"}</td>
                  <td className="px-4 py-3">
                    {low ? (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-dark)]">
                        Low stock
                      </span>
                    ) : (
                      <span className="text-xs text-green-700">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Inventory history</h2>
        <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
          {history.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap justify-between gap-2 border-b border-stone-50 py-2"
            >
              <span>
                <strong>{h.item.name}</strong> · {h.type} · {toNumber(h.quantity)}
                {h.reason ? ` · ${h.reason}` : ""}
              </span>
              <span className="text-stone-500">
                {h.user?.name || "System"} · {h.createdAt.toLocaleString()}
              </span>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-stone-500">No transactions yet</p>
          )}
        </div>
      </section>
    </div>
  );
}
