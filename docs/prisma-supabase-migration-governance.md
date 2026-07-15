<!--
File: docs/prisma-supabase-migration-governance.md
Purpose: Define the single-owner schema workflow and safe hosted reconciliation runbook.
Why: Prisma and Supabase migration ledgers must not compete or hide application-schema drift.
-->

# Prisma and Supabase Migration Governance

## Ownership

Prisma migrations are authoritative for every application-owned object in
`public`. Add application DDL only under `backend/src/prisma/migrations`, deploy
it with `npm run prisma:deploy`, and never edit a migration after it has been
applied. `backend/src/prisma/schema.prisma` is the client-facing structural
contract and must converge with a clean migration replay.

The trusted Git base is the immutable repository-history boundary. Every
`migration.sql` blob already present there must remain byte-for-byte identical;
only a new directory ordered after the base history may add a migration.
Prisma's `_prisma_migrations` table is read-only deployed execution evidence,
including the native checksum Prisma recorded when it applied each migration.

`supabase_migrations.schema_migrations` is retained as historical metadata for
the four Supabase CLI migrations that predate this policy. Do not repair,
rewrite, append application DDL to, or deploy from that ledger. Supabase
platform-managed schemas remain owned by Supabase. This project follows the
official principle that migrations are sequential version-controlled schema
changes, while using Prisma as its one ORM owner:
<https://supabase.com/docs/guides/deployment/database-migrations>.

## Diff classification

The 2026-07-14 hosted-to-Prisma review classified the complete Prisma diff:

| Class            | Resolution                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actionable drift | Enforce proven CMS/IELTS `NOT NULL` contracts and add missing application and foreign-key indexes in the forward reconciliation migration.                                                   |
| Representation   | Model the hosted `gen_random_uuid()` and timestamp defaults, composite IELTS keys, explicit `ON UPDATE NO ACTION`, and deliberate cascade actions in Prisma.                                 |
| Database-only    | Preserve roles, grants, RLS policies, views, functions, Supabase schemas/extensions, pg-boss objects, and the partial navigation-parent index. The SQL probe checks the required exceptions. |
| Obsolete         | Drop only strict-prefix duplicate indexes after wider replacements exist. Do not drop advisor-reported unused indexes without workload evidence.                                             |

Generated diff SQL is review evidence, not a deployment artifact. Never apply
it wholesale because it cannot express the PR-48A runtime-role and policy
boundary and may replace valid constraints only to change representation.

## Migration history and line endings

`.gitattributes` checks out migration SQL with LF endings so Git blob identity
and Prisma's native checksums remain deterministic across platforms.
`npm run prisma:migrations:verify -- --git-base <ref>` compares every base
migration with its exact Git blob and accepts only new forward directories.
`npm run prisma:migrations:verify:pending` validates every deployed migration
and allows only a gap-free prefix of repository history.
`npm run prisma:migrations:verify:exact` additionally requires identical names,
order, count, and native Prisma checksums. Database verification accepts exact
deployed bytes plus LF/CRLF variants to account for historical Windows
checkouts; Git blob verification still rejects any repository content change.

When a deployed checksum does not match those variants, stop. Restore the file
from the deployed source or repository history. Put every correction in a new
forward migration. All hosted verification is read-only: never update, repair,
resolve, insert into, or delete from `_prisma_migrations` or
`supabase_migrations.schema_migrations` to conceal drift.

## Connection boundaries

- `DATABASE_URL` uses the dedicated `nce_runtime` login through the application
  pooler on port `5432`.
- `JOB_DATABASE_URL` uses only `nce_job_runner` through port `5432`.
- `DIRECT_URL` is deployment-only and authenticates as the `postgres` owner.
  Use the direct/session pooler on port `5432` for Prisma migrations. Do not use
  transaction-pooling port `6543` for migrations, advisory locks, or DDL.
- `DIRECT_DATABASE_CA_CERT_PATH` points to the project Server root certificate
  downloaded from the dashboard's SSL Configuration panel, using an absolute
  path. Every remote owner command requires it. The launcher consumes the CA
  setting and supplies consumer-specific authenticated TLS parameters: Prisma
  receives `sslmode=require`, the root CA through `sslcert`, and
  `sslaccept=strict`; node-postgres/tsx children receive `sslmode=verify-full`
  plus `sslrootcert`. Keep all
  URL-level SSL parameters out of `DIRECT_URL`; conflicting or weakening modes
  are rejected. See the
  [Prisma PostgreSQL TLS parameters](https://www.prisma.io/docs/orm/overview/databases/postgresql)
  and Supabase's recommendation to use
  [`verify-full` with the project CA](https://supabase.com/docs/guides/platform/ssl-enforcement).
- Never provide `DIRECT_URL` to the long-running backend or print any URL.

## Pre-deploy backup and lock review

1. Take a Supabase PITR/manual backup or a tested logical backup before DDL.
   Record its time and restore target outside the repository; do not commit data.
2. Confirm no migration is failed or pending unexpectedly with
   `npm run prisma:status`. Run `npm run prisma:migrations:verify:pending` to verify
   every deployed migration while allowing only trailing repository migrations
   that are awaiting deployment.
3. Run the null, orphan, duplicate, invalid-index, unvalidated-constraint, CMS
   revision, rollback-source, and publication-version queries below.
4. Review table sizes and active sessions for every `ALTER TABLE` target. The
   reconciliation migration uses a five-second `lock_timeout`; schedule a quiet
   window instead of increasing it during contention.
5. Review the exact migration and schema diff. Confirm the PR-48A roles, RLS,
   views, functions, grants, and runtime memberships are unchanged.

The reconciliation migration first validates temporary `CHECK` constraints,
then applies `NOT NULL`, allowing PostgreSQL to reuse the validation proof. Its
ordinary indexes briefly lock writes; use a separately reviewed concurrent
rollout if future table size makes that unacceptable.

## Hosted preflight

Run only aggregate checks; do not select user payloads:

```sql
SELECT count(*) FILTER (WHERE sort_order IS NULL) AS sort_order_nulls,
       count(*) FILTER (WHERE is_active IS NULL) AS active_nulls,
       count(*) FILTER (WHERE created_at IS NULL) AS created_nulls,
       count(*) FILTER (WHERE updated_at IS NULL) AS updated_nulls
FROM public.cms_content_items;

SELECT count(*) AS invalid_indexes
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND (NOT i.indisvalid OR NOT i.indisready);

SELECT count(*) AS unvalidated_constraints
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND NOT c.convalidated;
```

Repeat the null check for every CMS/IELTS table named in the forward migration.
Run `backend/tests/prisma/schemaGovernance.probe.sql` through the owner
connection for the complete structural and CMS integrity set. Expected issue
counts are zero.

Any mutation probe against hosted data must roll back:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Run the smallest insert/update/delete or role probe needed for verification.
ROLLBACK;
```

## Deploy and verify

From the repository root:

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:migrations:verify -- --git-base origin/main
npm --prefix backend run prisma:migrations:verify:pending
npm --prefix backend run prisma:status
npm --prefix backend run prisma:deploy
npm --prefix backend run prisma:status
npm --prefix backend run prisma:migrations:verify:exact
npm --prefix backend run prisma:diff
npm --prefix backend run prisma:diff:reverse
```

Exit code `0` is required for both diff directions. Then run the SQL probe, the
PR-48A rolled-back role probes for `anon`, `authenticated`, `nce_runtime`, and
`service_role`, and Supabase security and performance advisors. Add justified
indexes; do not remove an index solely because a low-traffic advisor marks it
unused.

CI starts PostgreSQL 17 from empty, creates required roles, replays all Prisma
migrations, requires exact deployed-ledger convergence, checks both diff
directions, rejects any modification/deletion/rename of migration SQL already
in the Git base, and runs the database-only/integrity probe. Only a newly added
forward migration is accepted.

## Advisor baseline

The hosted advisor review on 2026-07-14 found no missing index on an
application-owned foreign key. The remaining findings were classified rather
than folded into this reconciliation:

- `courses_public` is the existing PR-48A public view and is intentionally left
  unchanged here; changing its security mode would alter that reviewed access
  boundary and requires a separate policy review.
- pg-boss function search paths and pg-boss foreign-key indexes are owned by
  the job-queue extension, not the application schema.
- the historical `citext` placement and private tables with RLS but no public
  policy predate this change and do not represent application-schema drift.
- RLS initialization-plan and multiple-permissive-policy findings belong to the
  PR-48A policy boundary. Optimize them only with equivalence tests for every
  runtime role.
- newly created and low-traffic indexes may appear as unused immediately after
  deployment. Retain them until representative workload evidence supports a
  separate removal.

Re-run both advisors after each hosted migration and record newly introduced
application-owned errors or warnings as release blockers. Existing findings
must remain explicitly classified; an unchanged warning is not proof that it is
safe.

## Recovery

Do not roll an applied migration backward in place.

- Before commit: fix the new, unapplied migration and rerun the disposable replay.
- After any environment applied it: create another forward migration. Make it
  idempotent only where environment variance is expected, preflight data, and
  preserve PR-48A grants and policies.
- If deployment times out before Prisma records completion, inspect the schema
  and `_prisma_migrations` without changing either. Use Prisma's documented
  failed-migration recovery only after proving exactly which statements ran.
- If data or availability is unsafe, stop writes and restore the pre-deploy
  backup to a new recovery target. Compare it before redirecting traffic.

Roll forward is the normal recovery path. Every corrective migration receives
the same replay, two-way diff, migration-history, hosted integrity, and advisor
checks.
