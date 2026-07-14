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

Copy `.env.local.example` to the gitignored `.env.local` and set its owner-only
`DIRECT_URL`. For every hosted owner command, also set
`DIRECT_DATABASE_CA_CERT_PATH` to the project Server root certificate downloaded
from Supabase Database Settings using an absolute path. The launcher converts
the bare owner URL into a consumer-specific, CA-backed authenticated TLS URL.
The `prisma:status`, `prisma:migrate`, `prisma:deploy`,
`prisma:diff`, `prisma:diff:reverse`, `prisma:checksums:database`,
`prisma:checksums:database:exact`,
`pgboss:install`, and seed scripts load that file only inside a
short-lived child process. Raw Prisma migration commands fail when `DIRECT_URL`
is absent instead of silently using the `nce_runtime` URL from `.env`.
The launcher consumes only these approved owner settings from `.env.local`;
arbitrary local values are not copied into the child environment. Remote owner
URLs with preconfigured or weakening SSL options are rejected.

CI and deployment jobs may inject `DIRECT_URL` directly instead of creating
`.env.local`; remote jobs must inject `DIRECT_DATABASE_CA_CERT_PATH` with it.
The launcher scopes these settings to owner-only Prisma, pg-boss installation,
and seed processes. The running backend loads only `.env`, using the
least-privilege `DATABASE_URL` plus a pgboss-only `JOB_DATABASE_URL`.

The `verify:ielts-config` command is different: it is a runtime-readiness check,
so it reads `DATABASE_URL` directly and does not require `DIRECT_URL`.

### Local database role bootstrap

After creating the local `nce_app` database, create every migration-prerequisite
role as the same `postgres` owner used by `DIRECT_URL`. The boundary migrations
create and normalize the two non-login `nce_app_*` request roles.

```bash
psql postgresql://postgres:postgres@localhost:5432/postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nce_runtime') THEN
    CREATE ROLE nce_runtime LOGIN PASSWORD 'nce_runtime'
      NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nce_job_runner') THEN
    CREATE ROLE nce_job_runner LOGIN PASSWORD 'nce_job_runner'
      NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;
GRANT service_role TO nce_runtime
  WITH ADMIN FALSE, SET TRUE, INHERIT FALSE;
SQL
```

Use `../docs/architecture-db.md` for the migration status/deploy/diff sequence,
the notification retry column and index check, the guarded
`assignments_backup_20260204` cleanup check, and the expected Prisma diff exit
codes.

Prisma migrations are the sole application-schema history. Use
`../docs/prisma-supabase-migration-governance.md` for normalized checksum
verification, disposable replay, hosted preflight, backup, lock review, and
forward recovery. The historical Supabase migration ledger is retained but is
not an application deployment source.

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
