# Production deployment checklist

## Why Vercel was broken

1. **SQLite cannot run on Vercel** — need PostgreSQL (`DATABASE_URL`).
2. **Auth needs secrets** — without `AUTH_SECRET` + `AUTH_URL` you get
   “There is a problem with the server configuration.”

## Vercel → Settings → Environment Variables

Add these for **Production** (and Preview if you use it):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Your Neon/Postgres URL ending with `?sslmode=require` |
| `AUTH_SECRET` | Output of `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | **Same** as `AUTH_SECRET` |
| `AUTH_URL` | `https://YOUR-APP.vercel.app` (no trailing slash) |
| `NEXTAUTH_URL` | **Same** as `AUTH_URL` |

Do **not** set `DATABASE_URL` to `file:./dev.db` on Vercel.

## One-time database setup

1. Create a free DB at [neon.tech](https://neon.tech) → copy connection string.
2. Paste it as `DATABASE_URL` on Vercel.
3. From your laptop (schema is PostgreSQL):

```bash
export DATABASE_URL="postgresql://...neon.../neondb?sslmode=require"
npx prisma db push
npm run db:seed
```

4. Redeploy on Vercel (Deployments → … → Redeploy).

## Login after seed

- `admin@whatthefood.local` / `password123`
