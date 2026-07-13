<!--
File: docs/supabase-data-api-runtime-boundary.md
Purpose: Document the PR-48A Supabase Data API and backend runtime-role boundary.
Why: Makes the intended grants, exception, rollout, and verification reproducible.
-->

# Supabase Data API Runtime Boundary

## Access matrix

| Principal               | Intended database access                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `anon`                  | Existing column-scoped, RLS-filtered public CMS, IELTS reference, NCE catalog, and `courses_public` reads only |
| `authenticated`         | The same reviewed public/reference surfaces; no private application tables                                     |
| `nce_app_anon`          | Backend anonymous requests; inherits `anon` RLS policies and cannot log in                                     |
| `nce_app_authenticated` | Backend signed-in requests; inherits `authenticated` RLS policies and cannot log in                            |
| `service_role`          | Backend auth/session and trusted service operations only; never expose its key to clients                      |

The migration revokes `anon` and `authenticated` from every relation outside
the explicit public allowlist. It grants the two backend-only roles application
table and sequence access. Tables that already had RLS keep their policies;
tables that did not have RLS receive backend-only compatibility policies before
RLS becomes mandatory.

All eight approved IELTS reference tables receive explicit browser `SELECT`
grants and RLS policies. Future functions lose the global implicit `PUBLIC`
execute default and require an intentional grant before Data API RPC use.

`authenticator` must never be a member of either `nce_app_*` role. One-way role
membership lets the backend roles reuse the matching browser-role policies
without allowing a Supabase token to select a backend role.

The migration/runtime database login receives explicit `SET TRUE` membership
in both backend roles. It remains a non-superuser, and the roles receive only
`SELECT`, `INSERT`, `UPDATE`, and `DELETE` table privileges.

## Intentional view exception

`public.courses_public` remains a narrowly scoped security-definer view. A
security-invoker view would require granting its callers access to the base
`courses` table, contradicting the requirement that Data API clients cannot
query that table directly. The view filters soft-deleted courses and exposes
only its reviewed projection. Its `app` helper functions have fixed search
paths, and implicit `PUBLIC EXECUTE` is revoked.

The product has no GraphQL client, so the migration removes `pg_graphql` rather
than maintaining a second public discovery/query surface.

## Rollout

1. Confirm the PR-48 migrations and hosted checksums are already reconciled.
2. Back up the hosted database and inspect active sessions using the old roles.
3. Deploy `20260712220000_harden_data_api_runtime_roles` through the authoritative Prisma migration path.
4. Restart the backend so new requests select the `nce_app_*` roles.
5. Run the probes below inside a transaction and roll it back.
6. Run the Supabase security advisor. The `courses_public` view warning is the documented exception; exposed-table RLS errors must be zero.

## Rolled-back hosted probes

Run with a migration-capable connection. Substitute existing UUIDs only inside
the transaction; do not commit probe mutations.

```sql
begin;

set local role anon;
select * from public.courses_public limit 1;
select * from public.courses limit 1; -- must fail with permission denied

reset role;
set local role authenticated;
select password_hash from public.users limit 1; -- must fail
update public.grades set score = score; -- must fail

reset role;
set local role nce_app_anon;
select set_config('app.current_user_role', 'anon', true);
select * from public.courses_public limit 1;

reset role;
set local role nce_app_authenticated;
select set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true);
select set_config('app.current_user_role', 'student', true);
select count(*) from public.users;

rollback;
```

Run each expected-denial statement separately if the SQL client aborts the
transaction on error. Also verify `authenticator` has no membership in either
backend role and that `anon`/`authenticated` have no privileges on private
tables, columns, or sequences.
