import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listCategories, listProducts } from "@/actions/products";
import { getSettings } from "@/lib/settings";
import { PosClient } from "@/components/pos-client";
import { signOutAction } from "@/actions/auth";
import { canAccessAdmin, hasMinRole } from "@/lib/permissions";
import { toNumber } from "@/lib/money";
import { getOpenRegister, listCustomers, listHeldOrders } from "@/actions/ospos";

export default async function PosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [categories, products, settings, register, customers, heldOrders] =
    await Promise.all([
      listCategories(),
      listProducts({ forPos: true }),
      getSettings(),
      getOpenRegister(),
      listCustomers(),
      listHeldOrders(),
    ]);

  return (
    <PosClient
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: toNumber(p.price),
        categoryId: p.categoryId,
        sku: p.sku,
        imageUrl: p.imageUrl,
      }))}
      settings={settings}
      staffName={session.user.name || "Staff"}
      showAdminLink={canAccessAdmin(session.user.role)}
      canCloseRegister={hasMinRole(session.user.role, "SUPERVISOR")}
      signOutAction={signOutAction}
      register={
        register
          ? {
              id: register.id,
              openingFloat: toNumber(register.openingFloat),
              openedAt: register.openedAt.toISOString(),
              openedBy: register.openedBy.name,
            }
          : null
      }
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
      }))}
      heldOrders={heldOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: toNumber(o.total),
        orderType: o.orderType,
        discountType: o.discountType,
        discountValue: toNumber(o.discountValue),
        notes: o.notes,
        customerId: o.customerId,
        items: o.items.map((i) => ({
          productId: i.productId || "",
          name: i.productName,
          unitPrice: toNumber(i.unitPrice),
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
      }))}
    />
  );
}
