import Link from "next/link";
import {
  listCategories,
  listProducts,
  deleteProduct,
  toggleProductActive,
  upsertCategory,
} from "@/actions/products";
import { formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { ProductForm } from "@/components/product-form";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const sp = await searchParams;
  const [products, categories, settings] = await Promise.all([
    listProducts(),
    listCategories(true),
    getSettings(),
  ]);
  const editing = products.find((p) => p.id === sp.edit);

  const { listInventory } = await import("@/actions/inventory");
  let invItems: { id: string; name: string }[] = [];
  try {
    invItems = (await listInventory()).map((i) => ({ id: i.id, name: i.name }));
  } catch {
    /* */
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl tracking-tight">Menu</h1>
        <p className="text-sm text-[var(--muted)]">
          Categories and items in one place — add photos for POS
        </p>
      </div>

      <section className="card-surface p-5">
        <h2 className="font-semibold mb-3">Categories</h2>
        <form
          action={async (fd) => {
            "use server";
            await upsertCategory(fd);
          }}
          className="flex flex-wrap gap-2 mb-4"
        >
          <input
            name="name"
            required
            placeholder="New category name"
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            Add category
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                c.active
                  ? "bg-[var(--accent-soft)] text-[var(--accent-dark)]"
                  : "bg-stone-100 text-stone-500"
              }`}
            >
              {c.name}
            </span>
          ))}
        </div>
      </section>

      <ProductForm
        categories={categories}
        inventoryItems={invItems}
        product={editing || null}
        redirectTo="/admin/menu"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="card-surface overflow-hidden">
            <div className="aspect-[4/3] bg-[var(--accent-soft)]">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  Add photo
                </div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">{p.category.name}</p>
                </div>
                <p className="font-bold text-[var(--accent)]">
                  {formatMoney(toNumber(p.price), settings.currencySymbol)}
                </p>
              </div>
              {p.description && (
                <p className="text-xs text-[var(--muted)] line-clamp-2">
                  {p.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1 text-sm">
                <Link
                  href={`/admin/menu?edit=${p.id}`}
                  className="font-medium text-[var(--accent)]"
                >
                  Edit
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await toggleProductActive(p.id, !p.isActive);
                  }}
                >
                  <button type="submit" className="text-[var(--muted)]">
                    {p.isActive ? "Hide" : "Show"}
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await deleteProduct(p.id);
                  }}
                >
                  <button type="submit" className="text-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
