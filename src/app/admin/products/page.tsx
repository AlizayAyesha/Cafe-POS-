import { redirect } from "next/navigation";

export default async function ProductsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const sp = await searchParams;
  redirect(sp.edit ? `/admin/menu?edit=${sp.edit}` : "/admin/menu");
}
