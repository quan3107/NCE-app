/**
 * File: tests/prisma/dataApiRuntimeBoundaryMigration.test.ts
 * Purpose: Lock the database role and Data API hardening contract.
 * Why: Future migrations must not restore browser access or broaden request roles.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const readMigration = (name: string) =>
  readFileSync(
    resolve(process.cwd(), 'src/prisma/migrations', name, 'migration.sql'),
    'utf8',
  )

const roleMigration = readMigration('20260712220000_harden_data_api_runtime_roles')
const boundaryMigration = readMigration('20260712221000_enforce_data_api_boundary')
const ciWorkflow = readFileSync(
  resolve(process.cwd(), '../.github/workflows/ci.yml'),
  'utf8',
)
const rolloutRunbook = readFileSync(
  resolve(process.cwd(), '../docs/supabase-data-api-runtime-boundary.md'),
  'utf8',
)
const rootReadme = readFileSync(resolve(process.cwd(), '../README.md'), 'utf8')
const runtimePrismaClient = readFileSync(
  resolve(process.cwd(), 'src/prisma/client.ts'),
  'utf8',
)
const backendEnvExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')
const databaseTestClient = readFileSync(
  resolve(process.cwd(), 'tests/prisma/databaseTestClient.ts'),
  'utf8',
)
const runtimeRoleProbe = readFileSync(
  resolve(process.cwd(), 'tests/prisma/runtimeRoleBoundary.probe.sql'),
  'utf8',
)
const runtimeRoleServerTest = readFileSync(
  resolve(process.cwd(), 'tests/server.runtimeRoles.database.test.ts'),
  'utf8',
)
const databaseUpgradeTests = [
  'cmsBootstrapUpgrade.database.test.ts',
  'cmsKeylessStatsRevisionRepair.database.test.ts',
].map((name) => readFileSync(resolve(process.cwd(), 'tests/prisma', name), 'utf8'))

describe('Data API runtime boundary migrations', () => {
  it('binds SET-only memberships to the dedicated runtime login', () => {
    expect(roleMigration).toContain('CREATE ROLE nce_app_anon NOLOGIN')
    expect(roleMigration).toContain('CREATE ROLE nce_app_authenticated NOLOGIN')
    expect(roleMigration).toContain("member.rolname = 'nce_runtime'")
    expect(roleMigration).toContain('grantor.rolname = CURRENT_USER')
    expect(roleMigration).toContain(
      'GRANT nce_app_anon, nce_app_authenticated TO nce_runtime',
    )
    expect(roleMigration).toContain('WITH ADMIN FALSE, SET TRUE, INHERIT FALSE')
    expect(roleMigration).not.toMatch(/GRANT\s+service_role\s+TO\s+CURRENT_USER/i)
    expect(roleMigration).not.toMatch(
      /GRANT\s+nce_app_(anon|authenticated)\s+TO\s+authenticator/i,
    )
    expect(roleMigration).toContain("rolname = 'nce_job_runner'")
    expect(roleMigration).toContain('GRANT USAGE ON SCHEMA pgboss TO nce_job_runner')
    expect(roleMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss',
    )
    expect(roleMigration).toContain(
      'GRANT SELECT, UPDATE ON\n  public.ai_feedback_drafts, public.ai_objective_explanations\nTO service_role;',
    )
    expect(roleMigration).toContain(
      'GRANT SELECT (id), INSERT ON public.audit_logs TO service_role;',
    )
    expect(roleMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE ON public.notifications TO service_role;',
    )
    expect(roleMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE ON public.auth_sessions TO service_role;',
    )
    for (const privilegeCheck of [
      "has_table_privilege(current_user, 'public.ai_feedback_drafts', 'SELECT')",
      "has_table_privilege(current_user, 'public.ai_feedback_drafts', 'UPDATE')",
      "has_table_privilege(current_user, 'public.ai_objective_explanations', 'SELECT')",
      "has_table_privilege(current_user, 'public.ai_objective_explanations', 'UPDATE')",
      "has_table_privilege(current_user, 'public.notifications', 'SELECT')",
      "has_table_privilege(current_user, 'public.notifications', 'INSERT')",
      "has_table_privilege(current_user, 'public.notifications', 'UPDATE')",
      "has_table_privilege(current_user, 'public.auth_sessions', 'SELECT')",
      "has_table_privilege(current_user, 'public.auth_sessions', 'INSERT')",
      "has_table_privilege(current_user, 'public.auth_sessions', 'UPDATE')",
    ]) {
      expect(runtimeRoleProbe).toContain(privilegeCheck)
    }
    expect(runtimeRoleProbe).not.toMatch(
      /current_user, 'public\.(?:ai_feedback_drafts|ai_objective_explanations|notifications|auth_sessions)', '[^']*,[^']*'/,
    )
  })

  it('reproduces the hosted grantor split before migration', () => {
    expect(ciWorkflow).toContain(
      'DATABASE_URL: postgresql://nce_runtime:nce_runtime@localhost:5432/nce_test',
    )
    expect(ciWorkflow).toContain(
      'DIRECT_URL: postgresql://postgres:postgres@localhost:5432/nce_test',
    )
    expect(ciWorkflow).toContain(
      'JOB_DATABASE_URL: postgresql://nce_job_runner:nce_job_runner@localhost:5432/nce_test',
    )
    expect(ciWorkflow).toContain('CREATE ROLE supabase_admin')
    expect(ciWorkflow).toContain('SET ROLE supabase_admin;')
    expect(ciWorkflow).toContain('GRANT service_role TO postgres')
    expect(ciWorkflow).toContain('SET ROLE postgres;')
    expect(ciWorkflow).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;',
    )
    expect(ciWorkflow).toContain(
      'GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;',
    )
    expect(ciWorkflow).toContain('GRANT service_role TO nce_runtime')
    expect(ciWorkflow).toContain('WITH ADMIN TRUE, SET TRUE, INHERIT TRUE;')
    expect(ciWorkflow).toContain('WITH ADMIN FALSE, SET TRUE, INHERIT FALSE;')
    expect(ciWorkflow.indexOf('GRANT service_role TO nce_runtime')).toBeLessThan(
      ciWorkflow.indexOf('- name: Apply backend migrations'),
    )
    expect(ciWorkflow.indexOf('- name: Install or upgrade pg-boss')).toBeLessThan(
      ciWorkflow.indexOf('- name: Apply backend migrations'),
    )
    expect(ciWorkflow).toContain("'MEMBER WITH ADMIN OPTION'")
    expect(ciWorkflow).toContain('SET LOCAL ROLE service_role;')
    expect(runtimeRoleServerTest).toContain('boss.send(DUE_SOON_JOB_NAME')
    expect(runtimeRoleServerTest).toContain('ownerPrisma.notification.count')
  })

  it('documents the split-login rollout and grantor-aware hosted probe', () => {
    const backup = rolloutRunbook.indexOf('Back up the hosted database')
    const disableGraphql = rolloutRunbook.indexOf('Disable `pg_graphql`')
    const applyMigrations = rolloutRunbook.indexOf(
      '`20260712220000_harden_data_api_runtime_roles`',
    )

    expect(rolloutRunbook).toContain('with admin false, inherit false, set true')
    expect(rolloutRunbook).toContain('grantor_role')
    expect(rolloutRunbook).toContain('dedicated runtime login')
    expect(rolloutRunbook).toContain('Database > Extensions')
    expect(backup).toBeGreaterThan(-1)
    expect(backup).toBeLessThan(disableGraphql)
    expect(disableGraphql).toBeGreaterThan(-1)
    expect(disableGraphql).toBeLessThan(applyMigrations)
    expect(rolloutRunbook).toContain('`DATABASE_URL` must authenticate as `nce_runtime`')
    expect(rolloutRunbook).toContain(
      '`JOB_DATABASE_URL` must authenticate as `nce_job_runner`',
    )
    expect(rolloutRunbook).toMatch(
      /`DIRECT_URL` is a\s+deployment-only input[\s\S]*`postgres` migration owner/,
    )
    expect(rootReadme).not.toContain(
      '`DATABASE_URL` and `DIRECT_URL` to authenticate as the same database role',
    )
  })

  it('runs administrative database fixtures through the direct login', () => {
    expect(databaseTestClient).toContain(
      'process.env.DIRECT_URL ?? process.env.DATABASE_URL',
    )
    for (const databaseUpgradeTest of databaseUpgradeTests) {
      expect(databaseUpgradeTest).toContain("from './databaseTestClient.js'")
      expect(databaseUpgradeTest).not.toContain("from '../../src/prisma/client.js'")
    }
  })

  it('keeps the migration credential out of the running backend', () => {
    expect(runtimePrismaClient).toContain('const databaseUrl = process.env.DATABASE_URL')
    expect(runtimePrismaClient).not.toContain(
      'process.env.DATABASE_URL ?? process.env.DIRECT_URL',
    )
    expect(backendEnvExample).not.toContain('DIRECT_URL=')
    expect(backendEnvExample).toContain('JOB_DATABASE_URL=')
    expect(rolloutRunbook).toContain('Do not provide `DIRECT_URL` to the running backend')
    expect(rolloutRunbook).toMatch(
      /provide `DIRECT_URL` only to the\s+migration, pg-boss installation, and seed job/,
    )
  })

  it('keeps maintenance enabled through every security gate', () => {
    const backendStart = rolloutRunbook.indexOf('While maintenance remains enabled')
    const probes = rolloutRunbook.indexOf('Run the probes below')
    const advisor = rolloutRunbook.indexOf('Run the Supabase security advisor')
    const reopen = rolloutRunbook.indexOf('Exit maintenance mode')

    expect(backendStart).toBeGreaterThan(-1)
    expect(probes).toBeGreaterThan(backendStart)
    expect(advisor).toBeGreaterThan(probes)
    expect(reopen).toBeGreaterThan(advisor)
    expect(rolloutRunbook).toContain(
      'Run the browser-role probes with an owner PostgreSQL connection',
    )
    expect(rolloutRunbook).not.toContain('PostgREST connection')
    expect(rolloutRunbook).toContain(
      'Run the backend-role probes with the dedicated `nce_runtime` `DATABASE_URL`',
    )
    expect(rolloutRunbook).not.toContain(
      'Run with the dedicated `nce_runtime` `DATABASE_URL`',
    )
    expect(rolloutRunbook).not.toContain('Run with a migration-capable connection')
    expect(
      rolloutRunbook.match(/exception when insufficient_privilege then null;/gi),
    ).toHaveLength(5)
    expect(rolloutRunbook).not.toContain('Run each expected-denial statement separately')
    expect(rolloutRunbook).toContain('final_score = final_score')
    expect(rolloutRunbook).not.toMatch(/update public\.grades set score = score/i)
  })

  it('uses explicit predecessor-equivalent grants instead of schema-wide DML', () => {
    expect(roleMigration).toContain('public.users,')
    expect(roleMigration).toContain('public.grades,')
    expect(roleMigration).toContain('TO nce_app_authenticated;')
    expect(roleMigration).toContain('TO nce_app_anon;')
    expect(roleMigration).not.toMatch(
      /GRANT[^;]*ALL TABLES IN SCHEMA public[^;]*TO service_role/i,
    )
    expect(roleMigration).not.toMatch(
      /GRANT[^;]*public\.(auth_sessions|identities)[^;]*TO nce_app_(anon|authenticated);/,
    )
    expect(boundaryMigration).not.toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nce_app_anon',
    )
  })

  it('adds compatibility policies only to explicitly granted tables', () => {
    expect(boundaryMigration).toContain("has_table_privilege(\n        'nce_app_anon'")
    expect(boundaryMigration).toContain(
      "has_any_column_privilege(\n        'nce_app_authenticated'",
    )
    expect(boundaryMigration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(boundaryMigration).not.toContain('nce_app_legacy_anon_all')
  })

  it('revokes browser roles from non-approved relations', () => {
    expect(boundaryMigration).toContain('REVOKE ALL PRIVILEGES ON TABLE')
    expect(boundaryMigration).toContain('FROM anon, authenticated')
    expect(boundaryMigration).toContain("'courses_public'")
    expect(boundaryMigration).toContain("'cms_page_contents'")
    expect(boundaryMigration).toContain("'nce_books'")
  })

  it('keeps every approved IELTS reference table browser-readable', () => {
    for (const table of [
      'ielts_config_versions',
      'ielts_question_options',
      'ielts_assignment_types',
      'ielts_question_types',
      'ielts_writing_task_types',
      'ielts_speaking_part_types',
      'ielts_completion_formats',
      'ielts_sample_timing_options',
    ]) {
      expect(boundaryMigration).toContain(`'${table}'`)
    }
    expect(boundaryMigration).toContain('ielts_reference_browser_select')
    expect(boundaryMigration).toContain('FOR SELECT TO anon, authenticated USING (true)')
  })

  it('hardens helpers without granting future runtime-role DML', () => {
    for (const migration of [roleMigration, boundaryMigration]) {
      const executableSql = migration.replace(/^--.*$/gm, '').trim()
      expect(executableSql.startsWith('BEGIN;')).toBe(true)
      expect(executableSql.endsWith('COMMIT;')).toBe(true)
    }
    expect(boundaryMigration).toContain(
      'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC',
    )
    expect(boundaryMigration).toContain("to_regprocedure('app.current_user_id()')")
    expect(boundaryMigration).not.toMatch(/\bDROP\s+EXTENSION\b/i)
    expect(boundaryMigration).toContain(
      'ALTER DEFAULT PRIVILEGES\n  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
    )
    expect(boundaryMigration).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role',
    )
    expect(boundaryMigration).toContain(
      'REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated, service_role',
    )
    expect(boundaryMigration).toContain(
      'REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role',
    )
    expect(boundaryMigration).not.toMatch(
      /ALTER DEFAULT PRIVILEGES[\s\S]{0,100}GRANT[\s\S]{0,100}nce_app_/,
    )
  })
})
