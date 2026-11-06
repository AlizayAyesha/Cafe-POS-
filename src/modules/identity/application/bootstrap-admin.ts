import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/core/database";

const MIN_PASSWORD_LENGTH = 12;

/**
 * Passwords that were published with the demo login.
 * Rejected so a fresh bootstrap cannot put that password back.
 */
const BLOCKED_PASSWORDS = new Set(["password123"]);

export type BootstrapBody = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export type BootstrapResult = {
  status: 200 | 401 | 404 | 409 | 503;
  body: BootstrapBody;
};

export type BootstrapEnv = {
  enabled?: string;
  setupSecret?: string;
  providedSecret?: string | null;
  email?: string;
  password?: string;
};

/**
 * One-time initial admin for an empty database.
 * Disabled unless ENABLE_INITIAL_ADMIN_SETUP=true.
 * Never resets an existing user, menu row, setting, balance, or order.
 * The response never includes the password.
 */
export async function bootstrapInitialAdmin(
  env: BootstrapEnv,
  db: PrismaClient = defaultPrisma
): Promise<BootstrapResult> {
  if (env.enabled !== "true") {
    return {
      status: 404,
      body: { error: "Initial admin setup is disabled." },
    };
  }

  const setupSecret = env.setupSecret?.trim() ?? "";
  if (!setupSecret || env.providedSecret !== setupSecret) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const email = env.email?.trim().toLowerCase() ?? "";
  const password = env.password ?? "";
  if (!email.includes("@") || password.length < MIN_PASSWORD_LENGTH || BLOCKED_PASSWORDS.has(password)) {
    return {
      status: 503,
      body: {
        error:
          "Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters, not a previously published demo password) on the server. This API does not return that password.",
      },
    };
  }

  const existingUsers = await db.user.count();
  if (existingUsers > 0) {
    return {
      status: 409,
      body: {
        error: "Setup already completed. Existing accounts, menu, and settings were not changed.",
      },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.create({
    data: {
      email,
      name: "Admin",
      role: "ADMIN",
      active: true,
      passwordHash,
    },
  });

  return {
    status: 200,
    body: {
      ok: true,
      message:
        "Initial admin created. Sign in with INITIAL_ADMIN_EMAIL, then turn ENABLE_INITIAL_ADMIN_SETUP off. No menu rows or existing accounts were changed. The password is not included in this response.",
    },
  };
}
