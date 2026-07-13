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

## Database Verification

`prisma.config.ts` loads this package's `.env` and uses `DIRECT_URL` for Prisma
CLI commands, falling back to `DATABASE_URL` only when `DIRECT_URL` is unset.
Check the active host before running migration commands: this checkout's
`backend/.env` may point at hosted Supabase, while `.env.example` documents a
localhost PostgreSQL database for local development.

In production, inject `DIRECT_URL` only into the short-lived Prisma migration
process. The running backend must receive only the least-privilege
`DATABASE_URL`; seed processes that use the application Prisma client may
receive an owner URL as their job-local `DATABASE_URL`, which must be discarded
before application startup.

Use `../docs/architecture-db.md` for the migration status/deploy/diff sequence,
the notification retry column and index check, the guarded
`assignments_backup_20260204` cleanup check, and the expected Prisma diff exit
codes.

PR-48A separates backend request roles from Supabase Data API roles. Read
`../docs/supabase-data-api-runtime-boundary.md` before deploying the role/grant
migration or running hosted role probes.

## Tests & Quality

- `npm test` - runs Vitest in the Node environment.
- `npm run lint` - applies ESLint checks.
- `npm run format` - verifies Prettier formatting.

## AI Feedback Operations

AI feedback is disabled by default with `AI_FEEDBACK_ENABLED=false`. Hosted
OpenAI-compatible generation runs only on the backend, using `AI_API_KEY`,
`AI_BASE_URL`, route model IDs, reasoning efforts, timeout limits, and image
capability flags from `.env`.

The default routes are `low_cost` (`gpt-5.4-nano`, medium reasoning) and
`premium` (`gpt-5.4-mini`, high reasoning). Verify the configured model IDs and
image-input support for the provider account before enabling visual IELTS
Writing Task 1 feedback. Admins can inspect redacted provider readiness at
`GET /api/v1/ai-feedback/health`.

See `../docs/ai-feedback-setup.md` for setup, disable/fallback behavior, budget
controls, image policy, and live-provider readiness guidance. See
`../docs/ai-feedback-prompts.md` for prompt contracts, criteria versioning,
parser failure policy, and provider-free harness behavior.

## Cleanup and Retention Jobs

The pg-boss runner schedules `cleanup.retention` daily at 03:17. The job
soft-deletes expired or otherwise unusable auth sessions older than
`CLEANUP_AUTH_SESSION_RETENTION_DAYS` and clears stale failure metadata from
failed or dead-letter notification rows older than
`CLEANUP_NOTIFICATION_METADATA_RETENTION_DAYS`. Defaults are conservative:
30 days for auth sessions and 90 days for notification failure metadata.
Execute mode selects IDs in bounded batches before mutating rows. Tune
`CLEANUP_RETENTION_BATCH_SIZE` and `CLEANUP_RETENTION_MAX_BATCHES` if a backlog
needs a slower or faster drain.

Dry-run mode is available through `runCleanupRetentionJob({ mode: 'dry-run' })`
for operational checks. Execute mode returns processed counts for that bounded
run, logs the cleanup totals, and writes a redacted audit entry. If
`reachedBatchLimit` is true, more eligible rows may remain for a later run.
Cleanup does not delete remote object storage data; storage retention should be
handled by a documented provider lifecycle policy.

The cleanup index migration uses ordinary `CREATE INDEX` statements to match the
repository's existing migration style. For large production `auth_sessions` or
`notifications` tables, schedule the migration during low traffic or use a
separate concurrent-index rollout.

## Structure

- `src/app.ts` - Express app factory with core middleware, versioned routing, and error handling.
- `src/server.ts` - HTTP bootstrapper that reads validated env config and exposes the Express app.
- `src/config/` - Environment parsing (`env.ts`) and shared logger configuration (`logger.ts`).
- `src/middleware/` - Shared HTTP middleware stubs (`authGuard`, `roleGuard`, `errorHandler`).
- `src/modules/` - Feature modules (auth, users, courses, assignments, submissions, grades, notifications) with Zod schemas, controllers, and routers returning `501 Not Implemented` placeholders.
- `src/modules/router.ts` - Composes feature routers under `/api/v1`.
- `src/utils/` - Domain-agnostic helpers (date utilities).
- `src/jobs/` - pg-boss workers for notifications, AI feedback, and cleanup.
- `src/prisma/` - Prisma schema and migrations.
- `tests/` - Vitest + Supertest suites (pending coverage for new modules).

## Current API Scaffolding

- All feature routes mount under `/api/v1` with resource-oriented prefixes (e.g. `/users`, `/courses/:courseId/assignments`).
- Controllers validate input via module-local Zod schemas and emit `501` responses until domain logic arrives.
- Error handling is centralized via `middleware/errorHandler.ts`; authentication and authorization guards currently pass through.
- Environment variables are validated at startup; review `src/config/env.ts` for required keys before running locally.
