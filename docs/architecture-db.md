# Database Architecture and Verification

This project uses Prisma migrations against PostgreSQL. `backend/prisma.config.ts`
loads `backend/.env` and uses `DIRECT_URL` for Prisma CLI operations, falling
back to `DATABASE_URL` only when `DIRECT_URL` is unset.

## Environment Check

Before running migrations, identify the active database without printing
credentials:

```powershell
node -e "require('./backend/node_modules/dotenv').config({ path: 'backend/.env' }); for (const key of ['DATABASE_URL','DIRECT_URL']) { const value = process.env[key]; if (!value) { console.log(key + '=unset'); continue; } const url = new URL(value); console.log(key + '=' + url.protocol + '//' + url.hostname + '/' + url.pathname.slice(1)); }"
```

`backend/.env.example` documents a localhost PostgreSQL database for local
development. The working `backend/.env` in a developer checkout may point to a
hosted Supabase database instead. Treat a Supabase host as a shared hosted
database, not as the local database, even when commands are run from this repo.

## Migration Verification Sequence

Run these commands from the repository root:

```powershell
npm --prefix backend run prisma:generate
npx --prefix backend prisma migrate status --config backend/prisma.config.ts
npx --prefix backend prisma migrate deploy --config backend/prisma.config.ts
npx --prefix backend prisma migrate diff --config backend/prisma.config.ts --from-schema=backend/src/prisma/schema.prisma --to-config-datasource --exit-code
```

For `prisma migrate diff --exit-code`, exit code `0` means Prisma found no
schema diff. Exit code `2` means drift exists. Review drift before applying more
schema changes; do not treat drift as a successful clean check.

## Notification Retry Check

After deploying migrations, run this read-only SQL against the same database:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
  AND column_name IN (
    'attempt_count',
    'max_attempts',
    'next_attempt_at',
    'last_attempt_at',
    'failure_reason',
    'dead_lettered_at'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notifications'
  AND indexname IN (
    'notifications_status_deletedAt_nextAttemptAt_idx',
    'notifications_status_deletedAt_createdAt_idx'
  )
ORDER BY indexname;
```

Expected result: all six retry/recovery columns exist, and the due-retry status
lookup index on `status`, `"deletedAt"`, and `next_attempt_at` exists. Admin
resend uses these fields to clear retry and dead-letter state; regular
notification responses must continue to omit retry and failure metadata.

## Obsolete Assignment Backup Table

PR-46A includes a guarded migration for
`public.assignments_backup_20260204`. The migration skips missing tables, drops
the table when it is empty, and raises an exception when it contains rows.

Use this read-only check before deployment when the target database is shared or
hosted:

```sql
SELECT to_regclass('public.assignments_backup_20260204') AS backup_table;
```

If `backup_table` is `NULL`, the backup table is already absent and there is no
row count to check. Only run this count after `backup_table` is non-null:

```sql
SELECT count(*) AS backup_rows
FROM public.assignments_backup_20260204;
```

If the table exists and `backup_rows` is greater than `0`, stop and decide where
to export or archive the data before deploying the drop migration.

## Known Follow-Ups

This runbook intentionally does not resolve all historical schema drift.

| Area | Owner | Risk | Notes |
| --- | --- | --- | --- |
| Prisma schema drift outside notification retry recovery | Backend/database | Future migrations may mix intentional changes with historical default, nullability, foreign-key, and index drift. | Review the full `prisma migrate diff --exit-code` output before adding schema work. Keep fixes grouped by domain instead of folding them into notification retry cleanup. |
| Non-retry notification list/read indexes | Backend/database | List and unread queries may lose expected query plans if index drift is applied accidentally. | The PR-46A check is limited to the due-retry index on `status`, `"deletedAt"`, and `next_attempt_at`. |
| Supabase RLS policy design | Backend/security | Runtime access may rely on grants and app context that are broader than the eventual policy model. | Design policy coverage separately with endpoint-level authorization tests. |
| Supabase Data API exposure | Backend/security | Tables may be exposed through Supabase APIs before grants and policies are deliberately tightened. | Audit Data API exposure as a separate security follow-up. |
