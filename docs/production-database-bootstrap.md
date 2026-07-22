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
- Browser roles `anon` and `authenticated`, plus `service_role NOLOGIN BYPASSRLS`,
  must already exist.
- The provider-managed `authenticator` role must exist. Leave its provider-managed
  login attributes and password unchanged; it must not be a member of either NCE
  backend request role.
- `nce_runtime` must be a login with `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`,
  `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`. The migration owner must
  grant `service_role` to it using `WITH ADMIN FALSE, SET TRUE, INHERIT FALSE`;
  no other `service_role -> nce_runtime` membership row is permitted.
- `nce_job_runner` must have the same least-privilege login attributes and must
  not have any role memberships. The dedicated runtime URLs use these two logins.
- Grant `CONNECT` on the target database to `nce_runtime` and `nce_job_runner`.
- The migration owner must install pg-boss before Prisma migrations so the
  owner-controlled `pgboss` schema already exists. Follow the exact hosted steps
  in [the runtime boundary runbook](supabase-data-api-runtime-boundary.md), or the
  executable [local role bootstrap](../backend/README.md#local-database-role-bootstrap)
  for an empty rehearsal database. Prisma creates the `nce_app_*` request roles.
- The linked plain-PostgreSQL rehearsal stub uses `authenticator NOLOGIN` only because
  it does not run PostgREST. It is not a production or Supabase role template.
- Node.js 20 or newer and backend dependencies installed with
  `npm --prefix backend ci`.

## Environment

Set these only in the deployment job or `backend/.env.local`; do not expose owner
credentials to the running API:

- `DIRECT_URL`: PostgreSQL owner URL for the actual direct database endpoint. Required
  by migration and bootstrap. For Supabase, use
  `db.<project-ref>.supabase.co:5432`. Do not use either Supavisor pooler for owner
  migration or bootstrap jobs: this excludes the transaction-pooling endpoint on
  port `6543` and the session-pooling endpoint. The direct endpoint is IPv6 by
  default, so the deployment runner needs IPv6 reachability or the project needs the
  Supabase IPv4 add-on.
- `DIRECT_DATABASE_CA_CERT_PATH`: trusted CA certificate path, required for remote
  owner jobs. Loopback rehearsal databases do not require it.
- `DATABASE_URL`: least-privilege `nce_runtime` URL for the deployed API. The owner
  job temporarily supplies its scoped connection to Prisma/seed child processes.
- `JOB_DATABASE_URL`: dedicated pg-boss runtime URL when background jobs are enabled.

`DATABASE_URL` and `JOB_DATABASE_URL` runtime pooling choices remain separate from
the direct migration endpoint requirement above.

## Production sequence

From the repository root:

```sh
npm --prefix backend run pgboss:install
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run seed:reference
npm --prefix backend run prisma:status
```

`prisma:migrate:deploy` and the existing `prisma:deploy` CI command are identical
owner-scoped aliases for `prisma migrate deploy --config prisma.config.ts`.

Expected success signals:

- Prisma reports every migration applied and `Database schema is up to date`.
- Bootstrap prints `Production reference bootstrap complete.`
- A second `seed:reference` run also succeeds without increasing reference counts.
- Existing managed reference values and CMS pages remain unchanged.
- No users, courses, assignments, enrollments, submissions, or grades are created.

`seed:reference` only creates missing rows for permissions/role grants, navigation,
notification types, dashboard widgets, upload policies/types, IELTS configuration,
and CMS baseline pages. It never resets or truncates tables and does not update
existing mutable configuration. A transaction-scoped advisory lock serializes
overlapping runs. If IELTS v1 is missing while another version is active, v1 is
restored inactive; the existing active version remains authoritative. The standalone
`seed:ielts-config` command uses the same outer-transaction boundary. Demo content is
available through `seed:demo`. That command always rejects remote database hosts,
rejects `NODE_ENV=production`, and requires `DEMO_SEED_CONFIRM_DATABASE` to exactly
match the node-postgres driver database name in the loopback owner URL before loading
destructive code. The underlying `src/prisma/seed.ts` program enforces the same gate,
so direct execution cannot bypass it; `seed:demo` remains the supported entrypoint.
Reserved escapes and extra leading slashes remain part of that name.

## Production-like rehearsal checklist

Use a disposable PostgreSQL database restored from a recent production snapshot or
created empty for clean replay. Never rehearse destructive setup against production.

1. Record database identity and counts for `users`, `courses`, and `assignments`.
2. On an empty database, execute the linked local role bootstrap; on a restored
   snapshot, verify every role, attribute, membership, and grant listed above.
3. Configure rehearsal-only `DIRECT_URL` and, for remote TLS, the CA path.
4. Run `npm --prefix backend run pgboss:install` as the migration owner.
5. Run `npm --prefix backend run prisma:migrate:deploy`.
6. Run `npm --prefix backend run seed:reference` twice.
7. Run `npm --prefix backend test -- prisma` with `RUN_DATABASE_TESTS=true`,
   `DIRECT_URL` pointing at the disposable owner database, and `DATABASE_URL`
   pointing at its least-privilege runtime login.
8. Run `npm --prefix backend run prisma:status` and confirm no pending migration.
9. Recheck the three demo-table counts and confirm they match step 1.
10. Verify application readiness and representative anonymous/authenticated reads.

Remote database-test clients derive their administrative pool URL from the raw
`DIRECT_URL` and `DIRECT_DATABASE_CA_CERT_PATH` through the same CA-backed
`verify-full` policy as owner jobs. The exact `seed:reference` subprocess instead
receives the raw URL and CA variable so its owner launcher applies that policy once.

The restoration database tests delete representative rows only inside transactions
that always roll back. The separate overlap test makes no reference-data changes: it
holds the advisory lock, proves two independent entrypoints wait, then releases them.
Its fail-closed CI-only suite first prepares the disposable target through the exact
`seed:reference` command and verifies prompt pool shutdown. Ordinary database rehearsal
does not enable this entrypoint suite.

## Failure and rollback expectations

Stop rollout if migration, bootstrap, status, role probes, or application readiness
fails. Do not run `prisma migrate reset`, truncate tables, or use the demo seed.
Bootstrap is transactional, so a failure rolls back that bootstrap attempt. Prisma
migrations are forward-only: prefer a reviewed corrective migration. If data or
availability is compromised, keep the application in maintenance mode and restore
the pre-migration backup/recovery point according to the provider procedure. Record
the failed migration name and logs before recovery.
