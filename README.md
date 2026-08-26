# AbatCO Bicycle Records

Initial monorepo foundation for a neutral bicycle transaction record-keeping system.

## Workspaces

- `apps/web`: public React/Vite website.
- `apps/app`: authenticated Field Agent/Admin React/Vite PWA with Dexie offline stores.
- `apps/api`: Express/TypeScript API with Prisma and PostgreSQL.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:validate
```

Set real values in `.env` before using the database or authentication. Start all applications with `npm run dev`.

This initial setup intentionally does not include business CRUD, synchronization, conflict resolution, user creation, or complete UI workflows.