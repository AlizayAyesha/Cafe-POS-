import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { hasMinRole } from "@/lib/permissions";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Unauthorized");
  }
  return session;
}

export async function requireRole(minRole: Role) {
  const session = await requireSession();
  if (!hasMinRole(session.user.role, minRole as "CASHIER" | "SUPERVISOR" | "ADMIN")) {
    throw new AuthError("Forbidden");
  }
  return session;
}
