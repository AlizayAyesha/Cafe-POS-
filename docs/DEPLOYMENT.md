# Production deployment checklist

## Required Vercel env vars (Production)

| Name | Value |
|------|--------|
| `DATABASE_URL` | Postgres URL with `?sslmode=require` (Neon / Prisma Postgres) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Same as `AUTH_SECRET` |
| `AUTH_URL` | `https://cafe-pos-inky-zeta.vercel.app` |
| `NEXTAUTH_URL` | `https://cafe-pos-inky-zeta.vercel.app` |

Do **not** set `DATABASE_URL` to `file:./dev.db` on Vercel.

## Database setup

Create the empty schema only. Do not seed demo users or the placeholder menu into production.

```bash
export DATABASE_URL="postgresql://.../?sslmode=require"
npx prisma db push
```

Then create the first admin with the setup route below, or skip that route when staff accounts already exist. A production build does not connect to the database to seed it.

## First admin on an empty database

`/api/setup` does not run the demo seed. It is disabled unless all of the following are set, and it creates one admin only when the database has zero users. It does not change an existing menu, settings, balances, or passwords. The response does not include the password.

| Name | Purpose |
|------|---------|
| `ENABLE_INITIAL_ADMIN_SETUP` | `true` only for this request, then remove it |
| `SETUP_SECRET` | Long random string sent as `x-setup-secret` |
| `INITIAL_ADMIN_EMAIL` | The owner's email |
| `INITIAL_ADMIN_PASSWORD` | 12+ characters. Do not reuse a password that was published with the old demo login. |

```bash
curl -X POST https://cafe-pos-inky-zeta.vercel.app/api/setup \
  -H "x-setup-secret: $SETUP_SECRET"
```

Then set `ENABLE_INITIAL_ADMIN_SETUP` back to empty and redeploy so the route stays closed.

Do not run `npm run db:seed` against the production database. A normal build does not seed.

## Existing deployments — password rotation is a separate step

This change does not reset live account passwords. The previous login page showed a demo password in public HTML. If that deployment is still using those accounts, rotating them is a live operational step the owner must approve and perform (Staff screen, or a direct database update). Do not treat this release as having rotated them.

## Local vs production Prisma

- **Vercel / production:** `prisma/schema.prisma` → PostgreSQL (`npm run build`)
- **Local without Docker:** `npm run dev` uses `prisma/schema.sqlite.prisma` + `file:./dev.db`
