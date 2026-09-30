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
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AdminNav
        role={session.user.role}
        name={session.user.name || "Staff"}
        signOutAction={signOutAction}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
