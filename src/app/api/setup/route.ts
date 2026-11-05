import { bootstrapInitialAdmin } from "@/modules/identity/application/bootstrap-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Optional one-time bootstrap for an empty production database.
 * Off unless ENABLE_INITIAL_ADMIN_SETUP=true.
 * Does not import or run the demo seed.
 */
export async function POST(req: Request) {
  const { prisma } = await import("@/core/database");
  const result = await bootstrapInitialAdmin(
    {
      enabled: process.env.ENABLE_INITIAL_ADMIN_SETUP,
      setupSecret: process.env.SETUP_SECRET,
      providedSecret: req.headers.get("x-setup-secret"),
      email: process.env.INITIAL_ADMIN_EMAIL,
      password: process.env.INITIAL_ADMIN_PASSWORD,
    },
    prisma
  );
  return Response.json(result.body, { status: result.status });
}
