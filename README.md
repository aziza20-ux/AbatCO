# AbatCO Bicycle Records

A full-stack monorepo for a neutral bicycle transaction record-keeping system used by field agents and administrators in Rwanda. Field agents register bicycles and record ownership transfers (sales/transfers) — including while offline. Data queues locally and syncs automatically when connectivity returns.

---

## Workspaces

| App | Description | Port |
|---|---|---|
| `apps/web` | Public React/Vite marketing website (bilingual: English + Kinyarwanda) | 5173 |
| `apps/app` | Authenticated Field Agent/Admin React/Vite PWA with Dexie offline stores | 5174 |
| `apps/api` | Express/TypeScript REST API with Prisma and PostgreSQL | 4000 |

---

## Tech Stack

**Frontend (apps/app)**
- React 19, Vite, TypeScript
- TanStack React Query (server state)
- Dexie (IndexedDB offline queue)
- vite-plugin-pwa + Workbox (service worker, installable PWA)
- Tailwind CSS, Lucide icons

**Frontend (apps/web)**
- React 19, Vite, TypeScript
- Bilingual i18n (English / Kinyarwanda)
- Tailwind CSS, Lucide icons

**Backend (apps/api)**
- Express 5, TypeScript
- Prisma ORM + PostgreSQL
- JWT access tokens + HttpOnly refresh token cookies
- Zod validation, bcrypt, Helmet, CORS, rate limiting
- Cloudinary (photo uploads), Brevo (OTP emails)
- ExcelJS (XLSX exports), docx (Word exports)

---

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:validate
```

Set real values in `.env` before using the database or authentication.

```powershell
# Run database migrations
npm run prisma:migrate

# Seed the initial admin user
npm run db:seed

# Start all three apps concurrently
npm run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 32 characters) |
| `API_PORT` | Port for the API server (default: 4000) |
| `WEB_ORIGIN` | Allowed CORS origin for the public website |
| `APP_ORIGIN` | Allowed CORS origin for the PWA |
| `BREVO_API_KEY` | Brevo API key for sending OTP emails |
| `BREVO_SENDER_NAME` | Sender name for OTP emails |
| `BREVO_SENDER_EMAIL` | Sender email for OTP emails |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for photo uploads |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start all three apps concurrently |
| `npm run build` | Build all three apps |
| `npm run test` | Run API tests (Vitest) |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format all files with Prettier |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:validate` | Validate Prisma schema |
| `npm run prisma:migrate` | Run database migrations (dev) |
| `npm run prisma:deploy` | Deploy migrations (production) |
| `npm run db:seed` | Seed the initial admin user |

---

## Architecture Overview

```
User
 │
 ├── Public Website (apps/web)
 │    └── Marketing, bilingual, no auth
 │
 └── PWA (apps/app)
      ├── Login / Auth screens
      ├── Field Agent screens (register bicycle, record transaction, search, activity)
      ├── Admin screens (dashboard, transactions, agents, conflicts, exports)
      ├── Dexie (IndexedDB) — offline write queue
      ├── Service Worker — app shell cache (installable)
      └── Sync Worker — flushes queue when online
           │
           ▼
      REST API (apps/api :4000)
           ├── /api/auth      — login, refresh, logout, password reset (OTP)
           ├── /api/people    — person registry
           ├── /api/bicycles  — bicycle registry
           ├── /api/transactions — ownership transactions
           ├── /api/registrations — initial bicycle registrations
           ├── /api/sync      — batch offline operation sync (idempotent)
           ├── /api/admin     — dashboard, agent management, conflict resolution
           ├── /api/exports   — XLSX and DOCX exports
           ├── /api/uploads   — Cloudinary photo uploads
           └── /api/audit     — audit log
                │
                ▼
           PostgreSQL (via Prisma)
           User, Person, Bicycle, Transaction, Registration,
           RefreshToken, SyncOperation, AuditLog
```

---

## Offline-First Behavior

1. Agent fills in a transaction or registration form.
2. Data is saved to **IndexedDB** (Dexie) immediately with a `clientOperationId`.
3. The sync worker attempts to flush the queue to `/api/sync` right away.
4. If offline, data stays queued. When `navigator.onLine` fires, the sync worker retries.
5. The server applies operations idempotently — replaying the same `clientOperationId` is safe.
6. If a conflict is detected (e.g., bicycle ownership changed while offline), the operation is preserved and flagged for admin review.

---

## Roles & Permissions

| Role | Access |
|---|---|
| `ADMIN` | Full access — dashboard, all transactions, agent management, conflict resolution, exports |
| `AGENT` | Own transactions and registrations, search, activity feed |

Agents also have fine-grained JSON permissions: `canRegister`, `canTransfer`, `canFlag`, `canOverride`.

---

## Database Migrations

Migration history is in `prisma/migrations/`. Migrations are applied in order:

1. `20260826100033_initial` — base schema
2. `20260827082508_add_agent_permissions` — JSON permissions on User
3. `20260827082725_backfill_agent_default_permissions` — default values
4. `20260827105353_add_reset_otp` — OTP fields for password reset
5. `20260827123226_forgot_password1` — forgot password flow
6. `20260903101638_add_national_id_photo_url` — national ID photo on Person
7. `20260903111545_refresh_token_session_expiry` — session expiry on RefreshToken
8. `20260904000000_add_ownership_status` — ownershipStatus on Transaction
