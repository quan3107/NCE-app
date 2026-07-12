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

  it('enables RLS on every public table and preserves legacy backend behavior', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('nce_app_legacy_anon_all')
    expect(migration).toContain('nce_app_legacy_authenticated_all')
  })

  it('hardens helper functions and removes unused GraphQL exposure', () => {
    expect(migration).toContain(
      'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC',
    )
    expect(migration).toContain(
      'ALTER FUNCTION app.current_user_id() SET search_path = pg_catalog',
    )
    expect(migration).toContain('DROP EXTENSION IF EXISTS pg_graphql')
  })
})
