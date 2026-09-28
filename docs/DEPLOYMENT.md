# Production deployment checklist

## Before deploy

- [ ] Change all seed user passwords (or recreate staff accounts)
- [ ] Generate strong `AUTH_SECRET` (`openssl rand -base64 32`)
- [ ] Provision Postgres (Neon recommended for Vercel)
- [ ] Set `provider = "postgresql"` in `prisma/schema.prisma`
- [ ] Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` in Vercel
- [ ] Run `prisma db push` + seed (or migrate) on production DB
- [ ] Verify Admin / Supervisor / Cashier login
- [ ] Complete one POS sale with split tender + receipt
- [ ] Confirm inventory decrements after sale
- [ ] Attach custom domain in Vercel (HTTPS automatic)

## After launch

- [ ] Train cashiers with `docs/TRAINING.md`
- [ ] Monitor Vercel logs for errors
- [ ] Keep Neon automated backups enabled
- [ ] 30-day warranty window starts at client sign-off
