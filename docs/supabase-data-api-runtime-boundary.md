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
| `nce_app_anon`          | Backend anonymous reads matching the predecessor `anon` role; no private tables and no login                   |
| `nce_app_authenticated` | Backend signed-in access matching predecessor grants; no auth/session or service-only tables and no login      |
| `service_role`          | Backend auth/session and trusted service operations only; never expose its key to clients                      |
| Migration/runtime login | Shared login selected by both database URLs; SET-only membership in both request roles and `service_role`      |

The first migration creates the backend-only roles and reproduces each
predecessor role's explicit table and column grants. It does not grant either
role schema-wide DML or default privileges. In particular, `nce_app_anon` has no
access to users, grades, auth sessions, identities, attempts, or authoring data;
auth sessions and identities remain `service_role`-only.

The second migration revokes `anon` and `authenticated` from every relation
outside the explicit public allowlist. Tables that already had RLS keep their
policies; a table that did not have RLS receives a compatibility policy only if
an isolated runtime role has an explicit privilege on that table.

All eight approved IELTS reference tables receive explicit browser `SELECT`
grants and RLS policies. Future functions lose the global implicit `PUBLIC`
execute default and require an intentional grant before Data API RPC use. Future
tables, sequences, and functions also receive no automatic `service_role`
access; trusted operations must grant each required object explicitly.

`authenticator` must never be a member of either `nce_app_*` role. One-way role
membership lets the backend roles reuse the matching browser-role policies
without allowing a Supabase token to select a backend role.

This rollout requires `DATABASE_URL` and `DIRECT_URL` to authenticate as the
same database role. Before migration, a role administrator must grant that login
`service_role` membership with `ADMIN FALSE, SET TRUE, INHERIT FALSE`; the
migration asserts both the positive `SET` requirement and the negative `ADMIN`
invariant. The migration then grants `CURRENT_USER` the same SET-only membership
in `nce_app_anon` and `nce_app_authenticated`.

[Supabase recommends a separate database user for each service](https://supabase.com/docs/guides/database/postgres/roles#passwords),
so a dedicated runtime login is the preferred target instead of the
administrative `postgres` login. This rollout still requires one shared identity
for `DATABASE_URL` and `DIRECT_URL`; changing to separate migration and runtime
identities needs an explicit follow-up because the migration grants
`CURRENT_USER`. Do not split the two URLs during this rollout.

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

This is a coordinated maintenance-outage rollout. Do not use a rolling deploy:
the old application requires Data API role grants that the enforcement migration
revokes, while the new application requires roles the preparation migration adds.

1. Confirm the PR-48 migrations and hosted checksums are already reconciled.
2. Run `SELECT current_user` separately through `DATABASE_URL` and `DIRECT_URL`.
   Stop if the values differ; the migration grants memberships only to the
   `DIRECT_URL` identity.
3. As a superuser or role holding ADMIN OPTION on `service_role`, run
   `GRANT service_role TO <shared_login> WITH ADMIN FALSE, SET TRUE, INHERIT FALSE`.
   This updates all three membership options, including an existing production
   membership. Verify `SELECT pg_has_role('<shared_login>', 'service_role', 'SET')`
   returns true and `SELECT pg_has_role('<shared_login>', 'service_role',
   'MEMBER WITH ADMIN OPTION')` returns false.
4. Enter maintenance mode, stop accepting requests, and drain or stop every
   backend instance. Confirm no old application sessions remain.
5. Back up the hosted database, then apply both `20260712220000_harden_data_api_runtime_roles`
   and `20260712221000_enforce_data_api_boundary` through Prisma.
6. Start only the new backend release and exit maintenance mode after its health
   check succeeds.
7. Run the probes below inside transactions and roll them back.
8. Run the Supabase security advisor. The `courses_public` view warning is the
   documented exception; exposed-table RLS errors must be zero.

## Rolled-back hosted probes

Run with a migration-capable connection. Substitute existing UUIDs only inside
the transaction; do not commit probe mutations.

```sql
begin;

do $probe$
begin
  if pg_has_role(current_user, 'service_role', 'MEMBER WITH ADMIN OPTION') then
    raise exception 'shared login retains service_role ADMIN OPTION';
  end if;
end
$probe$;

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
select * from public.users limit 1; -- must fail

reset role;
set local role nce_app_authenticated;
select set_config('app.current_user_id', '00000000-0000-0000-0000-000000000000', true);
select set_config('app.current_user_role', 'student', true);
select count(*) from public.users;
select * from public.auth_sessions limit 1; -- must fail

reset role;
set local role service_role;
select count(*) from public.auth_sessions;

rollback;
```

Run each expected-denial statement separately if the SQL client aborts the
transaction on error. Run the three backend role switches while connected as
the shared `DATABASE_URL`/`DIRECT_URL` identity. Also verify `authenticator` has
no membership in either backend role and that `anon`/`authenticated` have no
privileges on private tables, columns, or sequences. The shared login must have
SET but not ADMIN OPTION on `service_role`.
