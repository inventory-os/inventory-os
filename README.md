# Inventory OS

Self-hostable, open-source asset management app with QR labels, borrowing, locations, and role-based access.

## Features

- Asset CRUD and category/location management
- Borrow/return flow for team members
- Printable QR labels per asset
- SQLite by default, Postgres-ready via environment variables
- OIDC login flow for app access
- European language support (EU locale set)

## Quick Start

1. Install dependencies:
   - `npm install`
2. Configure env:
   - copy `.env.example` to `.env.local`
3. Start app:
   - `npm run dev`
4. Open app:
   - `http://localhost:3000`

## Testing

- Run all tests (unit + acceptance): `npm test`
- Watch mode (unit): `npm run test:watch`
- Coverage (unit): `npm run test:coverage`
- Run only unit tests: `npm run test:unit`
- Unit watch mode: `npm run test:unit:watch`
- Unit coverage (enforced 89% statements/lines): `npm run test:unit:coverage`
- Run only acceptance tests: `npm run test:acceptance`
- Acceptance watch mode: `npm run test:acceptance:watch`

## Code Quality

- Lint: `npm run lint`
- Format write: `npm run format`
- Format check: `npm run format:check`

## Database Migrations (Drizzle)

- Migrations are stored in `drizzle/sqlite` and `drizzle/pg`
- App startup runs pending migrations automatically before repository access
- Generate SQLite migration: `npm run db:generate:sqlite`
- Generate Postgres migration: `npm run db:generate:pg`
- Run SQLite migrations manually: `npm run db:migrate:sqlite`
- Run Postgres migrations manually: `npm run db:migrate:pg`

### Unit test structure

- `tests/unit/lib/`
  - `api-error.test.ts` → `lib/api-error.ts`
  - `auth-session.test.ts` → `lib/auth-session.ts`
  - `db-runtime.test.ts` → `lib/db.ts`
  - `i18n.test.ts` → `lib/i18n.ts`
  - `intl.test.ts` → `lib/intl.ts`
  - `oidc.test.ts` → `lib/oidc.ts`
  - `qr-payload.test.ts` → `lib/qr-payload.ts`
  - `request-security.test.ts` → `lib/request-security.ts`
  - `security-utils.test.ts` → `lib/security-utils.ts`
- `tests/unit/components/`
  - `app-runtime-provider.test.tsx` → `components/app-runtime-provider.tsx`
  - `data-table-pagination.test.tsx` → `components/ui/data-table-pagination.tsx`
  - `status-badge.test.tsx` → `components/status-badge.tsx`
- `tests/unit/hooks/`
  - `use-current-user.test.tsx` → `hooks/use-current-user.ts`
  - `use-mobile.test.tsx` → `hooks/use-mobile.ts`
    Current test suite includes:

- Unit tests for i18n and API error sanitization
- DB runtime tests covering both SQLite and Postgres client selection/execution paths
- Acceptance tests for authenticated page rendering and runtime behavior

## Authentication (OIDC)

Use in `.env.local`:

- `AUTH_SESSION_SECRET=<long-random-secret-min-32-chars>`
- `OIDC_ISSUER_URL=https://auth.example.com/application/o/inventory-os/`
- `OIDC_CLIENT_ID=inventory-os`
- `OIDC_CLIENT_SECRET=<client-secret>`
- `OIDC_REDIRECT_URI=http://localhost:3000/api/auth/callback`
- `OIDC_SCOPE=openid profile email`
- `OIDC_JIT_CREATE=false`
- `OIDC_ROLE_CLAIM=roles`
- `OIDC_ADMIN_ROLE_VALUE=admin`
- `OIDC_MEMBER_ROLE_VALUE=member`

Role assignment is derived on each login from OIDC claims only:

- If claim contains `OIDC_ADMIN_ROLE_VALUE` → local role `admin`
- Else if claim contains `OIDC_MEMBER_ROLE_VALUE` → local role `member`
- Else local role defaults to `member`

When a user's OIDC claim role changes, the next login updates both local auth role and Team role automatically.

## LDAP User Sync (Settings)

LDAP sync is configured in the app UI instead of environment variables:

- Open `Settings` → `Integrations` → `LDAP User Sync`
- Configure LDAP URL, bind DN/password, base DN, filter, and attribute mapping
- Save settings and run `Sync Users`

Synced users are written to local auth users with source `ldap` and can sign in via OIDC when issuer + subject mapping matches.

## Database Configuration

### SQLite (default)

Use in `.env.local`:

- `DB_CLIENT=sqlite3`
- `SQLITE_FILENAME=./inventory-os.sqlite`

### Postgres

Use in `.env.local`:

- `DB_CLIENT=pg`
- `DATABASE_URL=postgresql://user:password@host:5432/inventory_os`
- `PG_STARTUP_MAX_WAIT_MS=40000` (optional, default 40s)
- `PG_STARTUP_RETRY_INTERVAL_MS=2000` (optional)

## QR URL Configuration

Use in `.env.local`:

- `APP_DOMAIN=https://assets.your-company.com`
- `APP_QR_PATH_TEMPLATE=/assets/{id}`

The QR labels encode a URL using this format: `APP_DOMAIN + APP_QR_PATH_TEMPLATE`.
`{id}` in the path template is replaced with the current asset ID.

## Asset File Storage

Use in `.env.local`:

- `ASSET_STORAGE_DIR=./storage/assets`

This directory stores uploaded asset photos, bills, warranties, and other documents.
Use a persistent volume/path in production.

All app APIs (including asset file open/download URLs) require an authenticated app session.

The app creates schema automatically on startup.

## Open Source / Self Hosting Notes

- No external SaaS dependency is required for core app usage.
- Persist your `.env.local` and database volume in production.
- Use HTTPS and reverse proxy in production environments.
