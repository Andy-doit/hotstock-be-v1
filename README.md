# HotStock Backend

Backend API cua HotStock duoc xay dung bang NestJS, Fastify, Prisma, PostgreSQL va Redis.

## Requirements

- Node.js 20+
- npm
- Docker Desktop hoac Docker Engine co Docker Compose

## Setup

```bash
npm install
cp .env.example .env
```

Cap nhat cac bien toi thieu trong `.env`:

```env
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

POSTGRES_DB=appdb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=local-postgres-password
DATABASE_URL=postgresql://postgres:local-postgres-password@localhost:5433/appdb?schema=public
DIRECT_URL=postgresql://postgres:local-postgres-password@localhost:5433/appdb?schema=public

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=local-redis-password

JWT_ACCESS_SECRET=replace-with-access-secret-at-least-32-chars
JWT_REFRESH_SECRET=replace-with-refresh-secret-at-least-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

SEED_ADMIN_PASSWORD=replace-with-strong-admin-password
```

Luu y:

- `JWT_ACCESS_SECRET` phai trung voi frontend.
- `JWT_ACCESS_SECRET` va `JWT_REFRESH_SECRET` can toi thieu 32 ky tu.
- Neu can email that, cau hinh them cac bien `SMTP_*`.
- Neu can upload S3 that, cau hinh them cac bien `AWS_*`.

## Development

Chay PostgreSQL, Redis va PgBouncer:

```bash
docker compose up -d postgres redis pgbouncer
```

Generate Prisma client, migrate va seed data:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Chay backend:

```bash
npm run start:dev
```

Kiem tra:

```text
GET http://localhost:3001/api/v1/health
```

## Docker

Chay day du backend stack:

```bash
docker compose up -d --build
```

Backend se listen o:

```text
http://localhost:3001
```

## API

API prefix mac dinh:

```text
/api/v1
```

Health check:

```text
GET /api/v1/health
```

Swagger chi bat khi `NODE_ENV !== production`:

```text
http://localhost:3001/api/docs
```

Khong commit file swagger/postman collection generated vao repo.

## Database

Lenh thuong dung:

```bash
npm run db:generate        # prisma generate
npm run db:migrate         # migrate local development
npm run db:migrate:deploy  # migrate staging/production
npm run db:seed            # seed data
npm run db:studio          # open Prisma Studio
npm run db:reset           # reset local database
```

Reset local database containers va volumes:

```bash
docker compose down -v --remove-orphans
```

## Scripts

```bash
npm run start:dev # run NestJS dev watch
npm run build     # build production bundle
npm run start     # run NestJS
npm run start:prod
npm run lint      # run ESLint
```

## Production Notes

- Dat `NODE_ENV=production`.
- Chay `npm run db:migrate:deploy` truoc khi start app.
- Khong bat Swagger tren production.
- Dat secret JWT manh va khac nhau cho access/refresh token.
- Cau hinh `CORS_ORIGINS` dung domain frontend production.

## Troubleshooting

Neu backend khong ket noi DB:

- Kiem tra Docker dang chay.
- Kiem tra `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_PASSWORD`.
- Kiem tra port `5433` co bi chiem khong.

Neu Redis loi:

- Kiem tra `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- Kiem tra container Redis bang `docker compose ps`.

Neu seed loi password admin:

- Kiem tra `SEED_ADMIN_PASSWORD` trong `.env`.
