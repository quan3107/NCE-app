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
| `nce_runtime`           | Dedicated `DATABASE_URL` login; SET-only membership in both request roles and `service_role`                   |
| `postgres`              | Migration owner selected only by `DIRECT_URL`; never used by the running application                           |

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

This rollout deliberately separates migration and runtime identities.
`DATABASE_URL` must authenticate as `nce_runtime`. `DIRECT_URL` is a
deployment-only input for the short-lived migration process and must use the
`postgres` migration owner. Do not provide `DIRECT_URL` to the running backend.
The migration verifies the exact
`service_role -> nce_runtime` membership row, including its grantor, and grants
the request roles to `nce_runtime` rather than `CURRENT_USER`.

Hosted PostgreSQL 16+ can store multiple membership rows for the same role and
member when their grantors differ. Supabase's existing
`service_role -> postgres` row is granted by `supabase_admin`, so a `GRANT`
issued as non-superuser `postgres` cannot alter that row. The rollout leaves the
Supabase-managed administrative membership unchanged and instead creates a new
SET-only row from `postgres` to the dedicated runtime login. This follows
[Supabase's recommendation to use a separate database user per service](https://supabase.com/docs/guides/database/postgres/roles#passwords).

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
2. Connect as `postgres` and inspect the existing hosted membership. Do not try
   to rewrite or revoke the `supabase_admin`-granted row.

   ```sql
   select granted.rolname as granted_role,
          member.rolname as member_role,
          grantor.rolname as grantor_role,
          membership.admin_option,
          membership.inherit_option,
          membership.set_option
   from pg_catalog.pg_auth_members membership
   join pg_catalog.pg_roles granted on granted.oid = membership.roleid
   join pg_catalog.pg_roles member on member.oid = membership.member
   join pg_catalog.pg_roles grantor on grantor.oid = membership.grantor
   where granted.rolname = 'service_role'
     and member.rolname in ('postgres', 'nce_runtime')
   order by member.rolname, grantor.rolname;
   ```

3. Still connected as `postgres`, create a fresh dedicated login with a
   generated secret and grant only connect plus SET-only service membership.
   Stop and inspect instead if `nce_runtime` already exists.

   ```sql
   create role nce_runtime login password '<generated-secret>'
     noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
   grant connect on database postgres to nce_runtime;
   grant service_role to nce_runtime
     with admin false, inherit false, set true;
   ```

4. Repeat the query from step 2. It must show the existing
   `supabase_admin -> postgres` row and exactly one `postgres -> nce_runtime` row
   with `admin_option=false`, `inherit_option=false`, and `set_option=true`.
5. Configure the deployment tooling to provide `DIRECT_URL` only to the
   migration and seed job, using the `postgres` owner. If a seed command reads
   `DATABASE_URL`, override that variable with the owner URL only for the seed
   process. Do not provide `DIRECT_URL` to the running backend, and never place
   the `postgres` credentials in its `DATABASE_URL`. The long-running backend
   environment must contain only `DATABASE_URL` using `nce_runtime`.
6. Enter maintenance mode, stop accepting requests, and drain or stop every
   backend instance. Confirm no old application sessions remain.
7. Back up the hosted database, then apply both `20260712220000_harden_data_api_runtime_roles`
   and `20260712221000_enforce_data_api_boundary` through Prisma. Run any
   required deployment seed in the same privileged job, then destroy its
   environment and credentials.
8. Confirm `DIRECT_URL` is absent, start only the new backend release with the
   `nce_runtime` `DATABASE_URL`, and exit maintenance mode after its health check
   succeeds.
9. Run the probes below inside transactions and roll them back.
10. Run the Supabase security advisor. The `courses_public` view warning is the
    documented exception; exposed-table RLS errors must be zero.

## Rolled-back hosted probes

Run with a migration-capable connection. Substitute existing UUIDs only inside
the transaction; do not commit probe mutations.

```sql
begin;

do $probe$
begin
  if current_user <> 'nce_runtime' then
    raise exception 'probe must use the dedicated runtime login';
  end if;
  if not pg_has_role(current_user, 'service_role', 'SET') or
     pg_has_role(current_user, 'service_role', 'USAGE') or
     pg_has_role(current_user, 'service_role', 'MEMBER WITH ADMIN OPTION') then
    raise exception 'runtime service_role membership is not SET-only';
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
the dedicated `DATABASE_URL` identity. Also verify `authenticator` has no
membership in either backend role and that `anon`/`authenticated` have no
privileges on private tables, columns, or sequences. The migration's catalog
check rejects any unexpected `service_role -> nce_runtime` grantor or membership
options before changing application grants.
