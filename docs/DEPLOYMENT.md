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

After `DATABASE_URL` is set:

```bash
export DATABASE_URL="postgresql://.../?sslmode=require"
npx prisma db push
npm run db:seed
```

Then redeploy on Vercel.

Optional re-seed from the live site (requires `SETUP_SECRET` env):

```bash
curl -X POST https://cafe-pos-inky-zeta.vercel.app/api/setup \
  -H "x-setup-secret: YOUR_SETUP_SECRET"
```

## Login

- `admin@whatthefood.local` / `password123`

## Local vs production Prisma

- **Vercel / production:** `prisma/schema.prisma` → PostgreSQL (`npm run build`)
- **Local without Docker:** `npm run dev` uses `prisma/schema.sqlite.prisma` + `file:./dev.db`
