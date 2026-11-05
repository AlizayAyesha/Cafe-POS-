# Cafe POS

# What The Food — Café POS & Management

Phase 1 POS for **What The Food** (Karachi).

## Architecture

Modular monolith. Business rules live in `src/modules/*/application` use cases; UI and `src/actions` are thin adapters. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Money is calculated in integer **paisa**. Completing a sale, void/return, register open/close, stock adjust/receive, and cash expenses run inside DB transactions with ledger writes.

## Phase 1 capabilities

| Area | Status |
|------|--------|
| POS sale (split tender, hold/resume, discounts) | Engineered — `CompleteSale` / `HoldSale` |
| Void / return with stock + gift restore | Engineered — supervisor use cases |
| Cash register open / close + drawer ledger | Engineered |
| Inventory ledger (sale / receive / adjust / wastage) | Engineered |
| Gift cards (issue, reload, redeem on POS) | Engineered — ledger-backed |
| Customers, expenses (cash → drawer), receivings | Engineered |
| Roles (Cashier / Supervisor / Admin) | Server-enforced |
| Reports / dashboard | Reads from completed orders |
| Unit + workflow integration tests | `npm test` (14 tests) |

## Tech stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Auth.js (NextAuth v5) credentials + bcrypt
- Prisma ORM
- SQLite for local development · PostgreSQL for production on Vercel

## Quick start (local)

Verified with Node 22 and npm 10 (`npm ci`).

```bash
cp .env.example .env
# Set DEMO_SEED_PASSWORD in .env (8+ characters). It is only used to create
# demo users that do not exist yet. It is not printed and not used in production.
npm ci
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The sign-in form is blank.

`npm run db:seed` is explicit and local. It creates missing demo users and missing placeholder items. It does not deactivate the menu, overwrite café settings, or reset passwords. Do not point it at a live database. If `NODE_ENV=production`, the seed refuses to run unless `ALLOW_DEMO_SEED=true`, which is not a live-café switch.

Demo emails, created only when missing: `admin@whatthefood.local`, `supervisor@whatthefood.local`, `cashier@whatthefood.local`. The password is the value you set in `DEMO_SEED_PASSWORD`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Local: `file:./dev.db` · Production: Postgres URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | Same value as `AUTH_SECRET` |
| `AUTH_URL` | App URL (`http://localhost:3000` or production domain) |
| `NEXTAUTH_URL` | Same value as `AUTH_URL` |
| `DEMO_SEED_PASSWORD` | Local seed only. Creates missing demo users. Never resets an existing password. |
| `ENABLE_INITIAL_ADMIN_SETUP` | Set to `true` only to create the first admin on an empty database |
| `SETUP_SECRET` | Header secret for that one-time setup request |
| `INITIAL_ADMIN_EMAIL` | Email for that first admin. Not a shared demo login. |
| `INITIAL_ADMIN_PASSWORD` | 12+ characters. Not returned by the API. |

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production build
- `npm run db:setup` — push schema + seed
- `npm run db:studio` — Prisma Studio
- `npm test` — unit + POS workflow integration tests

## Training

See [docs/TRAINING.md](docs/TRAINING.md).

## Out of scope (Phase 1)

Customer ordering app, payment gateways, IoT, tax engines, loyalty, delivery platforms.
