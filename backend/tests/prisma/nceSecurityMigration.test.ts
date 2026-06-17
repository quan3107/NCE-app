/**
 * File: tests/prisma/nceSecurityMigration.test.ts
 * Purpose: Lock down the Data API access contract for NCE content tables.
 * Why: Authenticated Supabase clients must not receive answer keys, drafts, archived content, or course mappings.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(testDir, '../..')

function readBackend(relativePath: string): string {
  return readFileSync(resolve(backendRoot, relativePath), 'utf8')
}

describe('NCE Data API security migration', () => {
  const migration = readBackend(
    'src/prisma/migrations/20260617140000_secure_nce_content_access/migration.sql',
  )
  const denyPolicyMigration = readBackend(
    'src/prisma/migrations/20260617141000_deny_nce_course_assignment_client_reads/migration.sql',
  )
  const helperFunctionMigration = readBackend(
    'src/prisma/migrations/20260617142000_use_nce_rls_helper_functions/migration.sql',
  )
  const privateHelperMigration = readBackend(
    'src/prisma/migrations/20260617143000_move_nce_rls_helpers_to_app_schema/migration.sql',
  )
  const inlinePolicyMigration = readBackend(
    'src/prisma/migrations/20260617144000_inline_nce_rls_publish_checks/migration.sql',
  )
  const securityMigrations = `${migration}\n${denyPolicyMigration}\n${helperFunctionMigration}\n${privateHelperMigration}\n${inlinePolicyMigration}`

  it('enables and forces RLS on every NCE table', () => {
    for (const table of [
      'nce_books',
      'nce_units',
      'nce_lessons',
      'nce_objectives',
      'nce_exercises',
      'nce_course_lesson_assignments',
    ]) {
      expect(securityMigrations).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      )
      expect(securityMigrations).toContain(
        `ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`,
      )
    }
  })

  it('revokes broad NCE table reads and exposes only student-safe columns', () => {
    expect(migration).toContain(
      'REVOKE SELECT ON public.nce_exercises FROM authenticated;',
    )
    expect(migration).toContain(
      'REVOKE SELECT ON public.nce_course_lesson_assignments FROM authenticated;',
    )
    expect(migration).toContain('GRANT SELECT (')
    expect(migration).toContain('ON public.nce_exercises TO authenticated;')
    expect(migration).not.toMatch(
      /GRANT\s+SELECT\s*\([^)]*answer_key[^)]*\)\s+ON\s+public\.nce_exercises/is,
    )
  })

  it('limits authenticated reads to published, non-deleted content chains', () => {
    expect(migration).toContain('CREATE POLICY nce_books_select_published')
    expect(migration).toContain('CREATE POLICY nce_units_select_published')
    expect(migration).toContain('CREATE POLICY nce_lessons_select_published')
    expect(migration).toContain('CREATE POLICY nce_objectives_select_published')
    expect(migration).toContain('CREATE POLICY nce_exercises_select_published')
    expect(inlinePolicyMigration).toContain('CREATE POLICY nce_units_select_published')
    expect(inlinePolicyMigration).toContain('CREATE POLICY nce_lessons_select_published')
    expect(inlinePolicyMigration).toContain('CREATE POLICY nce_objectives_select_published')
    expect(inlinePolicyMigration).toContain('CREATE POLICY nce_exercises_select_published')
    expect(inlinePolicyMigration).toContain('EXISTS (')
    expect(denyPolicyMigration).toContain(
      'CREATE POLICY nce_course_lesson_assignments_deny_authenticated_select',
    )
    expect(denyPolicyMigration).toContain('AS RESTRICTIVE')
    expect(denyPolicyMigration).toContain('USING (false)')
    expect(migration).toContain("status = 'published'")
    expect(migration).toContain('deleted_at IS NULL')
  })

  it('removes NCE security-definer RLS helpers from callable schemas', () => {
    for (const schema of ['public', 'app']) {
      expect(inlinePolicyMigration).toContain(
        `REVOKE ALL ON FUNCTION ${schema}.nce_book_is_published(UUID) FROM PUBLIC;`,
      )
      expect(inlinePolicyMigration).toContain(
        `REVOKE ALL ON FUNCTION ${schema}.nce_unit_is_published(UUID) FROM PUBLIC;`,
      )
      expect(inlinePolicyMigration).toContain(
        `REVOKE ALL ON FUNCTION ${schema}.nce_lesson_is_published(UUID) FROM PUBLIC;`,
      )
      expect(inlinePolicyMigration).toContain(
        `DROP FUNCTION IF EXISTS ${schema}.nce_book_is_published(UUID);`,
      )
      expect(inlinePolicyMigration).toContain(
        `DROP FUNCTION IF EXISTS ${schema}.nce_unit_is_published(UUID);`,
      )
      expect(inlinePolicyMigration).toContain(
        `DROP FUNCTION IF EXISTS ${schema}.nce_lesson_is_published(UUID);`,
      )
    }
    expect(inlinePolicyMigration).not.toContain('SECURITY DEFINER')
    expect(inlinePolicyMigration).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(public|app)\.nce_\w+\(UUID\)\s+TO\s+authenticated/i,
    )
    expect(privateHelperMigration).toContain(
      'DROP FUNCTION IF EXISTS public.nce_book_is_published(UUID);',
    )
  })
})
