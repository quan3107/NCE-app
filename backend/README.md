

# English Education Backend

Node.js 20 + Express 5 + TypeScript scaffold providing REST APIs for the English education platform.

## Setup
```bash
npm install
npm run prisma:generate
```

Create a `.env` based on `.env.example`, then start the dev server:
```bash
npm run dev
```

To produce production-ready output run:
```bash
npm run build
npm start
```

## Database Seeding
1. Confirm `NODE_ENV` is not set to `production` and the database URL points to a disposable environment.
2. Run `npm run seed` to reset the schema and load representative users, courses, and assignment fixtures.
3. Review the per-table summary log to verify the seed executed successfully.
> Note: The seed script skips .env loading if the optional "dotenv" dependency is absent, so CI environments must export the required variables upfront.

## Tests & Quality
- `npm test` - runs Vitest in the Node environment.
- `npm run lint` - applies ESLint checks.
- `npm run format` - verifies Prettier formatting.

## Structure
- `src/app.ts` - Express app factory with core middleware, versioned routing, and error handling.
- `src/server.ts` - HTTP bootstrapper that reads validated env config and exposes the Express app.
- `src/config/` - Environment parsing (`env.ts`) and shared logger configuration (`logger.ts`).
- `src/middleware/` - Shared HTTP middleware stubs (`authGuard`, `roleGuard`, `errorHandler`).
- `src/modules/` - Feature modules (auth, users, courses, assignments, submissions, grades, notifications) with Zod schemas, controllers, and routers returning `501 Not Implemented` placeholders.
- `src/modules/router.ts` - Composes feature routers under `/api/v1`.
- `src/utils/` - Domain-agnostic helpers (date utilities).
- `src/jobs/` - pg-boss worker placeholders for notifications and cleanup.
- `src/prisma/` - Prisma schema and migrations.
- `tests/` - Vitest + Supertest suites (pending coverage for new modules).

## Current API Scaffolding
- All feature routes mount under `/api/v1` with resource-oriented prefixes (e.g. `/users`, `/courses/:courseId/assignments`).
- Controllers validate input via module-local Zod schemas and emit `501` responses until domain logic arrives.
- Error handling is centralized via `middleware/errorHandler.ts`; authentication and authorization guards currently pass through.
- Environment variables are validated at startup; review `src/config/env.ts` for required keys before running locally.

