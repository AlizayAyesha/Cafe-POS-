import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(canAccessAdmin(session.user.role) ? "/admin" : "/pos");
}
