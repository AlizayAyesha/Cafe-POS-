import { updateSettingsAction } from "@/actions/admin";
import { getSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Café settings</h1>
        <p className="text-sm text-[var(--muted)]">
          Name on receipts, address, and currency shown on POS
        </p>
      </div>

      <form
        action={async (fd) => {
          "use server";
          await updateSettingsAction(fd);
        }}
        className="card-surface space-y-4 p-5"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Café name (receipts & header)</span>
          <input
            name="cafeName"
            defaultValue={settings.cafeName}
            required
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Address printed on receipt</span>
          <input
            name="address"
            defaultValue={settings.address}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Currency</span>
            <input
              name="currency"
              defaultValue={settings.currency}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Symbol</span>
            <input
              name="currencySymbol"
              defaultValue={settings.currencySymbol}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Receipt footer message</span>
          <textarea
            name="receiptFooter"
            rows={3}
            defaultValue={settings.receiptFooter}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          />
        </label>
        <button type="submit" className="btn-primary px-5 py-2.5">
          Save
        </button>
      </form>

      <div className="card-surface p-4 text-sm text-[var(--muted)] space-y-2">
        <p>
          <strong className="text-[var(--ink)]">Payroll / salary:</strong> track staff on{" "}
          <em>Staff &amp; pay</em>. Drawer cash taken by each cashier is on{" "}
          <em>Cash drawer</em>.
        </p>
        <p>
          <strong className="text-[var(--ink)]">Rollover:</strong> after cash-up, use counted
          cash as next shift&apos;s opening float.
        </p>
      </div>
    </div>
  );
}
