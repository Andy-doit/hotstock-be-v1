# Backend Deployment Checklist

## Prisma Migrations

Run production migrations with:

```bash
npm run db:migrate:deploy
```

The migration `20260716000000_add_query_performance_indexes` has PostgreSQL deployment requirements:

| Requirement | Why it matters |
|---|---|
| Database role can run `CREATE EXTENSION IF NOT EXISTS "pg_trgm"` | The admin user search indexes use `gin_trgm_ops`. |
| Migration runner must not wrap this migration in an explicit transaction | `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. |
| Deploy during a low-traffic window when possible | Concurrent index creation reduces write blocking, but still uses database resources. |
| Confirm `pg_trgm` is allowed on the managed database plan | Some managed PostgreSQL providers restrict extension creation to privileged roles. |

If the production migration role cannot create extensions, create `pg_trgm` once with a privileged role before running Prisma deploy:

```sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

## Prisma Config

Prisma config lives in `prisma.config.ts`. Do not reintroduce `package.json#prisma`; Prisma 7 removes that deprecated config path.

## Seed Policy

Seeding is intentionally separate from `npm run db:migrate:deploy`. Production containers start with migrations only:

```bash
npx prisma migrate deploy
```

Run production seed only once when bootstrapping a fresh database, or run it manually later only when you intentionally want to refresh seed-managed data. Normal code deployments should not run seed again; they should run migrations and start the app.

The seed script creates the base plan/portfolio data and one admin account:

```text
HotstockAdmin@gmail.com
```

Set the admin password with `SEED_ADMIN_PASSWORD` before running seed. If production seed data is required, build the application image first and run the production-safe seed command after the image has compiled `prisma/seed.ts`:

```bash
npm run db:seed:prod
```

Local development can continue using:

```bash
npm run db:seed
```

`prisma.config.ts` selects the seed command by environment: `NODE_ENV=production` uses `node dist/prisma/seed.js`; local development uses `ts-node prisma/seed.ts`. Do not require `ts-node` in the production runtime image.
