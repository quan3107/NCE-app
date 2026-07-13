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
  })

  it('reproduces the hosted grantor split before migration', () => {
    expect(ciWorkflow).toContain(
      'DATABASE_URL: postgresql://nce_runtime:nce_runtime@localhost:5432/nce_test',
    )
    expect(ciWorkflow).toContain(
      'DIRECT_URL: postgresql://postgres:postgres@localhost:5432/nce_test',
    )
    expect(ciWorkflow).toContain('CREATE ROLE supabase_admin')
    expect(ciWorkflow).toContain('SET ROLE supabase_admin;')
    expect(ciWorkflow).toContain('GRANT service_role TO postgres')
    expect(ciWorkflow).toContain('SET ROLE postgres;')
    expect(ciWorkflow).toContain('GRANT service_role TO nce_runtime')
    expect(ciWorkflow).toContain('WITH ADMIN TRUE, SET TRUE, INHERIT TRUE;')
    expect(ciWorkflow).toContain('WITH ADMIN FALSE, SET TRUE, INHERIT FALSE;')
    expect(ciWorkflow.indexOf('GRANT service_role TO nce_runtime')).toBeLessThan(
      ciWorkflow.indexOf('- name: Apply backend migrations'),
    )
    expect(ciWorkflow).toContain("'MEMBER WITH ADMIN OPTION'")
    expect(ciWorkflow).toContain('SET LOCAL ROLE service_role;')
  })

  it('documents the split-login rollout and grantor-aware hosted probe', () => {
    expect(rolloutRunbook).toContain('with admin false, inherit false, set true')
    expect(rolloutRunbook).toContain('grantor_role')
    expect(rolloutRunbook).toContain('dedicated runtime login')
    expect(rolloutRunbook).toContain('`DATABASE_URL` must authenticate as `nce_runtime`')
    expect(rolloutRunbook).toMatch(/`DIRECT_URL` must remain the\s+`postgres`/)
    expect(rootReadme).not.toContain(
      '`DATABASE_URL` and `DIRECT_URL` to authenticate as the same database role',
    )
  })

  it('uses explicit predecessor-equivalent grants instead of schema-wide DML', () => {
    expect(roleMigration).toContain('public.users,')
    expect(roleMigration).toContain('public.grades,')
    expect(roleMigration).toContain('TO nce_app_authenticated;')
    expect(roleMigration).toContain('TO nce_app_anon;')
    expect(roleMigration).not.toContain('ALL TABLES IN SCHEMA public')
    expect(roleMigration).not.toMatch(
      /public\.(auth_sessions|identities)[\s\S]*?TO nce_app_(anon|authenticated)/,
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
    expect(boundaryMigration).toContain(
      'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC',
    )
    expect(boundaryMigration).toContain("to_regprocedure('app.current_user_id()')")
    expect(boundaryMigration).toContain('DROP EXTENSION IF EXISTS pg_graphql')
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
