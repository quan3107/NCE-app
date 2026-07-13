/**
 * File: tests/prisma/dataApiRuntimeBoundaryMigration.test.ts
 * Purpose: Lock the PR-48A database role and Data API hardening contract.
 * Why: Prevents future migrations from restoring browser access to private tables.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'src/prisma/migrations/20260712220000_harden_data_api_runtime_roles/migration.sql',
  ),
  'utf8',
)

describe('PR-48A Data API runtime boundary migration', () => {
  it('creates backend-only roles that PostgREST cannot assume', () => {
    expect(migration).toContain('CREATE ROLE nce_app_anon NOLOGIN')
    expect(migration).toContain('CREATE ROLE nce_app_authenticated NOLOGIN')
    expect(migration).toContain('GRANT anon TO nce_app_anon')
    expect(migration).toContain('GRANT authenticated TO nce_app_authenticated')
    expect(migration).toContain(
      'GRANT nce_app_anon, nce_app_authenticated TO CURRENT_USER WITH SET TRUE',
    )
    expect(migration).not.toMatch(
      /GRANT\s+nce_app_(anon|authenticated)\s+TO\s+authenticator/i,
    )
  })

  it('revokes browser roles from non-approved relations', () => {
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE')
    expect(migration).toContain('FROM anon, authenticated')
    expect(migration).toContain("'courses_public'")
    expect(migration).toContain("'cms_page_contents'")
    expect(migration).toContain("'nce_books'")
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
      expect(migration).toContain(`'${table}'`)
    }
    expect(migration).toContain('ielts_reference_browser_select')
    expect(migration).toContain('FOR SELECT TO anon, authenticated USING (true)')
    expect(migration).toContain('GRANT SELECT ON TABLE')
  })

  it('limits backend table grants to RLS-governed DML', () => {
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public',
    )
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nce_app_anon, nce_app_authenticated',
    )
    expect(migration).not.toContain('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public')
    expect(migration).not.toContain(
      'GRANT ALL PRIVILEGES ON TABLES TO nce_app_anon, nce_app_authenticated',
    )
  })

  it('enables RLS on every public table and preserves legacy backend behavior', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('nce_app_legacy_anon_all')
    expect(migration).toContain('nce_app_legacy_authenticated_all')
  })

  it('hardens helper functions and removes unused GraphQL exposure', () => {
    expect(migration).toContain(
      'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC',
    )
    expect(migration).toContain("to_regprocedure('app.current_user_id()')")
    expect(migration).toContain("to_regprocedure('app.current_user_role()')")
    expect(migration).toContain("to_regprocedure('app.is_admin()')")
    expect(migration).toContain(
      'ALTER FUNCTION app.current_user_id() SET search_path = pg_catalog',
    )
    expect(migration).toContain('DROP EXTENSION IF EXISTS pg_graphql')
    expect(migration).toContain(
      'ALTER DEFAULT PRIVILEGES\n  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
    )
    expect(migration).not.toContain(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public\n  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
    )
  })
})
