<!--
File: docs/production-database-bootstrap.md
Purpose: Rehearse and operate the production migration and reference bootstrap path.
Why: Production initialization needs explicit prerequisites, signals, and recovery boundaries.
-->

# Production Database Migration and Bootstrap

This runbook covers an existing PostgreSQL database. It does not provision hosting,
create a managed database, or configure backups/PITR.

## Prerequisites

- PostgreSQL 17-compatible service reachable by an owner-scoped connection.
- A current, restorable backup or provider recovery point created before migration.
- The `citext` extension available to the migration owner. The first migration runs
  `CREATE EXTENSION IF NOT EXISTS citext`; provider-enable it first if the owner
  cannot create extensions.
- Supabase-compatible browser roles `anon`, `authenticated`, and `service_role`.
  They are non-application-login roles used by grants and RLS policies. Follow
  [the runtime boundary runbook](supabase-data-api-runtime-boundary.md) for the
  separate `nce_runtime`, `nce_app_anon`, and `nce_app_authenticated` role chain.
- Node.js 20 or newer and backend dependencies installed with
  `npm --prefix backend ci`.

## Environment

Set these only in the deployment job or `backend/.env.local`; do not expose owner
credentials to the running API:

- `DIRECT_URL`: PostgreSQL owner/migration URL. Required by migration and bootstrap.
- `DIRECT_DATABASE_CA_CERT_PATH`: trusted CA certificate path, required for remote
  owner jobs. Loopback rehearsal databases do not require it.
- `DATABASE_URL`: least-privilege `nce_runtime` URL for the deployed API. The owner
  job temporarily supplies its scoped connection to Prisma/seed child processes.
- `JOB_DATABASE_URL`: dedicated pg-boss runtime URL when background jobs are enabled.

## Production sequence

From the repository root:

```sh
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run seed:reference
npm --prefix backend run prisma:status
```

Expected success signals:

- Prisma reports every migration applied and `Database schema is up to date`.
- Bootstrap prints `Production reference bootstrap complete.`
- A second `seed:reference` run also succeeds without increasing reference counts.
- Existing managed reference values and CMS pages remain unchanged.
- No users, courses, assignments, enrollments, submissions, or grades are created.

`seed:reference` only creates missing rows for permissions/role grants, navigation,
notification types, dashboard widgets, upload policies/types, IELTS configuration,
and CMS baseline pages. It never resets or truncates tables and does not update
existing mutable configuration. Demo users, courses, and assignments are only
available through `npm --prefix backend run seed:demo`, which refuses production.

## Production-like rehearsal checklist

Use a disposable PostgreSQL database restored from a recent production snapshot or
created empty for clean replay. Never rehearse destructive setup against production.

1. Record database identity and counts for `users`, `courses`, and `assignments`.
2. Configure rehearsal-only `DIRECT_URL` and, for remote TLS, the CA path.
3. Run `npm --prefix backend run prisma:migrate:deploy`.
4. Run `npm --prefix backend run seed:reference` twice.
5. Run `npm --prefix backend test -- prisma` with `RUN_DATABASE_TESTS=true`,
   `DIRECT_URL` pointing at the disposable owner database, and `DATABASE_URL`
   pointing at its least-privilege runtime login.
6. Run `npm --prefix backend run prisma:status` and confirm no pending migration.
7. Recheck the three demo-table counts and confirm they match step 1.
8. Verify application readiness and representative anonymous/authenticated reads.

The bootstrap database test deletes representative reference rows only inside a
transaction that always rolls back, runs bootstrap twice, checks stable counts,
preserves a modified configuration label, and asserts demo-table counts do not move.

## Failure and rollback expectations

Stop rollout if migration, bootstrap, status, role probes, or application readiness
fails. Do not run `prisma migrate reset`, truncate tables, or use the demo seed.
Bootstrap is transactional, so a failure rolls back that bootstrap attempt. Prisma
migrations are forward-only: prefer a reviewed corrective migration. If data or
availability is compromised, keep the application in maintenance mode and restore
the pre-migration backup/recovery point according to the provider procedure. Record
the failed migration name and logs before recovery.
