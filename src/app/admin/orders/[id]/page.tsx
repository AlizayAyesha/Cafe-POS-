import { getOrder, voidOrder, returnOrder, setOrderFulfillment } from "@/actions/orders";
import { getSettings } from "@/lib/settings";
import { formatMoney, toNumber } from "@/lib/money";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasMinRole } from "@/lib/permissions";
import {
  fulfillmentChipClass,
  fulfillmentLabel,
} from "@/modules/sales/application/fulfillment";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const [order, settings] = await Promise.all([getOrder(id), getSettings()]);
  if (!order) notFound();
  const money = (n: number) =>
    formatMoney(n, settings.currencySymbol, settings.currency);
  const canVoid = hasMinRole(session?.user?.role, "SUPERVISOR");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/orders" className="text-sm text-[var(--accent)]">
        ← Orders
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
        <p className="text-sm text-[var(--muted)]">
          {order.createdAt.toLocaleString()} · {order.createdBy.name} · paid ·{" "}
          {order.orderType.replace("_", "-")}
        </p>
        {order.status === "COMPLETED" && (
          <p className="mt-2">
            <span className={fulfillmentChipClass(order.fulfillmentStatus)}>
              {fulfillmentLabel(order.fulfillmentStatus)}
            </span>
          </p>
        )}
        {order.customer && (
          <p className="text-sm text-[var(--muted)]">
            Customer: {order.customer.name}
            {order.customer.phone ? ` · ${order.customer.phone}` : ""}
          </p>
        )}
      </div>

      {order.status === "COMPLETED" && (
        <div className="flex flex-wrap gap-2">
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
                await setOrderFulfillment(id, value);
              }}
            >
              <button
                type="submit"
                className={`rounded-lg px-3 py-2 text-sm font-medium border ${
                  order.fulfillmentStatus === value
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                {label}
              </button>
            </form>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <ul className="space-y-2 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4">
              <span>
                {i.quantity}× {i.productName}
                {i.notes ? ` (${i.notes})` : ""}
              </span>
              <span>{money(toNumber(i.lineTotal))}</span>
            </li>
          ))}
        </ul>
        <hr className="my-4" />
        <div className="flex justify-between text-sm text-stone-600">
          <span>Subtotal</span>
          <span>{money(toNumber(order.subtotal))}</span>
        </div>
        {toNumber(order.discountAmount) > 0 && (
          <div className="flex justify-between text-sm text-green-700">
            <span>Discount</span>
            <span>−{money(toNumber(order.discountAmount))}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between font-bold">
          <span>Total</span>
          <span>{money(toNumber(order.total))}</span>
        </div>
        <div className="mt-3 space-y-1 text-sm text-stone-600">
          {order.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{p.method}</span>
              <span>{money(toNumber(p.amount))}</span>
            </div>
          ))}
        </div>
        {order.notes && (
          <p className="mt-4 text-sm text-stone-600">Notes: {order.notes}</p>
        )}
        {order.voidReason && (
          <p className="mt-2 text-sm text-red-700">
            {order.status}: {order.voidReason}
            {order.voidedBy ? ` · by ${order.voidedBy.name}` : ""}
          </p>
        )}
      </div>

      {canVoid && order.status === "COMPLETED" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <form
            action={async (fd) => {
              "use server";
              await voidOrder(id, String(fd.get("reason") || ""));
            }}
            className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4"
          >
            <h3 className="font-semibold text-red-900">Void sale</h3>
            <input
              name="reason"
              required
              placeholder="Reason required"
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-red-800 px-3 py-2 text-sm text-white"
            >
              Void & restore stock
            </button>
          </form>
          <form
            action={async (fd) => {
              "use server";
              await returnOrder(id, String(fd.get("reason") || ""));
            }}
            className="space-y-2 rounded-2xl border border-emerald-200 bg-[var(--accent-soft)] p-4"
          >
            <h3 className="font-semibold text-[var(--accent-dark)]">Return sale</h3>
            <input
              name="reason"
              required
              placeholder="Reason required"
              className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white"
            >
              Return & restore stock
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
