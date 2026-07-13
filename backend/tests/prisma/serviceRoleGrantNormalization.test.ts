/**
 * File: tests/prisma/serviceRoleGrantNormalization.test.ts
 * Purpose: Lock the hosted service_role privilege normalization contract.
 * Why: Hosted projects may retain broad ACLs on objects created before hardening.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const normalizationMigration = readFileSync(
  resolve(
    process.cwd(),
    'src/prisma/migrations/20260712220000_harden_data_api_runtime_roles/migration.sql',
  ),
  'utf8',
)
const runtimeRoleProbe = readFileSync(
  resolve(process.cwd(), 'tests/prisma/runtimeRoleBoundary.probe.sql'),
  'utf8',
)

describe('service_role grant normalization', () => {
  it('revokes existing grants before applying the reviewed matrix', () => {
    const revokeTables = normalizationMigration.indexOf(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM service_role;',
    )
    const firstReviewedGrant = normalizationMigration.indexOf(
      'GRANT SELECT, INSERT, UPDATE ON public.users TO service_role;',
    )

    expect(revokeTables).toBeGreaterThan(-1)
    expect(firstReviewedGrant).toBeGreaterThan(revokeTables)
    expect(normalizationMigration).toContain(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM service_role;',
    )
    expect(normalizationMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE ON public.identities TO service_role;',
    )
    expect(normalizationMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE ON public.nce_lesson_progress TO service_role;',
    )
    expect(normalizationMigration).toContain(
      'GRANT INSERT, UPDATE, DELETE ON public.nce_lessons TO service_role;',
    )
    expect(runtimeRoleProbe).toContain(
      "has_table_privilege(current_user, 'public.grades', 'SELECT')",
    )
  })

  it('is atomic', () => {
    const executableSql = normalizationMigration.replace(/^--.*$/gm, '').trim()
    expect(executableSql.startsWith('BEGIN;')).toBe(true)
    expect(executableSql.endsWith('COMMIT;')).toBe(true)
  })
})
