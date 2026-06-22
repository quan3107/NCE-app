/**
 * File: tests/prisma/navigationGrants.test.ts
 * Purpose: Lock down table-level grants for navigation and runtime config reads.
 * Why: /me hydrates navigation under runtime roles, and RLS cannot run without table privileges.
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

describe('navigation Data API grants', () => {
  it('grants runtime roles read access to navigation and config tables', () => {
    const migration = readBackend(
      'src/prisma/migrations/20260622152000_grant_navigation_runtime_reads/migration.sql',
    )
    const tables = [
      'navigation_items',
      'permissions',
      'role_permissions',
      'feature_flags',
      'feature_flag_roles',
    ]

    for (const table of tables) {
      expect(migration).toContain(
        `GRANT SELECT ON public.${table} TO authenticated, service_role;`,
      )
    }
  })
})
