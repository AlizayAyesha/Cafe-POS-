# Architecture — Modular Monolith

What The Food POS is a **modular monolith**: one Next.js app, one database, clear domain boundaries.

## Non-negotiable rule

> **No business-critical state mutation may bypass an application use case.**

Do **not** write from UI actions or pages:

```ts
await prisma.product.update(...)
await prisma.order.create(...)
await prisma.inventoryItem.update({ data: { quantity: ... } })
```

Ask first: **what business operation is this?** Then call an explicit use case, for example:

```text
completeSale / holdSale / voidSale / returnSale
openRegister / closeRegister
receiveStock / adjustStock
issueGiftCard / reloadGiftCard / setGiftCardActive
createProduct / updateProduct / changeProductPrice
createExpense
```

Allowed direct Prisma in actions/pages: **read-only queries** (lists, lookups) and revalidation. Mutations that change money, stock, orders, register state, gift balances, prices, or roles must go through `modules/*/application`.

## Dependency rule

```text
Presentation (app/, components/)
    → thin adapter (actions / route handlers)
        → Application use cases (modules/*/application/)
            → Domain (modules/*/domain/)
                → Infrastructure (Prisma via core/database)
```

React components **must not** contain business rules (totals, stock, cash, permissions).

## Source of truth

| Concern | Authoritative record |
|---|---|
| What was sold | `Order` + `OrderItem` |
| Money collected | `Payment` (allocations per order) |
| Cash drawer | `CashMovement` ledger (+ `RegisterSession` summary) |
| Inventory | `InventoryTransaction` ledger (`InventoryItem.quantity` is a projection) |
| Gift cards | `GiftCardTransaction` ledger |
| Who did what | `AuditLog` (append-only) |

## Critical use cases

- `modules/sales/application/complete-sale.ts` — CompleteSale / HoldSale (atomic transaction)
- `modules/sales/application/void-return.ts` — Void / Return with stock + cash + gift restore
- `modules/cash/application/register.ts` — Open / close register with cash ledger
- `modules/inventory/application/stock-movements.ts` — Stock ledger writes
- `modules/inventory/application/adjust-stock.ts` — Manual add / reduce / adjust / wastage
- `modules/purchasing/application/receive-stock.ts` — Supplier receiving
- `modules/expenses/application/create-expense.ts` — Expense + optional drawer cash-out
- `modules/catalog/application/products.ts` — Create / update product, price change
- `modules/gift-cards/application/lifecycle.ts` — Issue / reload / activate
- `core/money` — PKR as integer **paisa** for calculations

## Order status machine

```text
OPEN  → HELD | COMPLETED | CANCELLED
HELD  → OPEN | COMPLETED | CANCELLED
COMPLETED → VOIDED | RETURNED
VOIDED / RETURNED / CANCELLED → (terminal)
```

Enforced in `modules/sales/domain/order-status.ts`.

## Modules

```text
src/core/          cross-cutting (money, errors, db, permissions)
src/modules/
  sales/ inventory/ cash/ catalog/ gift-cards/
  purchasing/ expenses/ reporting/ audit/ settings/ identity/
src/actions/       thin Next.js server-action adapters (no business logic)
src/app/           routes / UI only
```

## Honesty bar

Still migrating gradually: some admin list/read queries remain in thin action adapters (allowed). Catalog and gift-card **mutations** now go through modules.

## Tests

```bash
npm test
```

- Unit: money, order transitions, role gates
- Integration (`tests/integration/`): CompleteSale, split payment, void, return, register open/close — against an isolated SQLite test DB
