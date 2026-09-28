import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";
import { signOutAction } from "@/actions/auth";
import { canAccessAdmin } from "@/lib/permissions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessAdmin(session.user.role)) redirect("/pos");

  return (
    <div className="flex min-h-screen">
      <AdminNav
        role={session.user.role}
        name={session.user.name || "Staff"}
        signOutAction={signOutAction}
      />
      <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
