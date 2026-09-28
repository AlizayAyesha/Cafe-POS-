import { seedDatabase } from "../../../../prisma/seed";

export const maxDuration = 60;

/** One-time production bootstrap: seed demo users/menu (schema must already exist). */
export async function POST(req: Request) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return Response.json(
      { error: "SETUP_SECRET is not configured on this deployment." },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-setup-secret");
  if (provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await seedDatabase();
    return Response.json({
      ok: true,
      message: "Seed data created.",
      login: {
        email: "admin@whatthefood.local",
        password: "password123",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
