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

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed logins (change in production)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@whatthefood.local` | `password123` |
| Supervisor | `supervisor@whatthefood.local` | `password123` |
| Cashier | `cashier@whatthefood.local` | `password123` |

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Local: `file:./dev.db` · Production: Postgres URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | App URL (`http://localhost:3000` or production domain) |

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
