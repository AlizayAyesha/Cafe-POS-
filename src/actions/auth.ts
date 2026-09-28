"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginResult = { ok: false; error: string };

function isNextRedirect(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Signs in and redirects to / (middleware sends Admin → /admin, Cashier → /pos). */
export async function loginAction(
  email: string,
  password: string,
  callbackUrl?: string | null,
): Promise<LoginResult | void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  let redirectTo = "/";
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    redirectTo = callbackUrl;
  }

  try {
    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirectTo,
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuthError) {
      return { ok: false, error: "Invalid email or password" };
    }
    throw error;
  }
}
