/**
 * File: tests/prisma/notificationRetryMigration.test.ts
 * Purpose: Validate notification retry follow-up migration safety.
 * Why: The obsolete assignment backup table must not be dropped silently when it still contains data.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const backendRoot = resolve(__dirname, '../..')

const readBackend = (path: string) => readFileSync(resolve(backendRoot, path), 'utf8')

describe('notification retry migration follow-up', () => {
  it('drops the obsolete assignment backup table only after an empty-table guard', () => {
    const migration = readBackend(
      'src/prisma/migrations/20260704170000_drop_obsolete_assignment_backup/migration.sql',
    )

    expect(migration).toContain('assignments_backup_20260204')
    expect(migration).toContain('SELECT count(*)')
    expect(migration).toContain('RAISE EXCEPTION')
    expect(migration).toContain('DROP TABLE IF EXISTS public.assignments_backup_20260204')
  })
})
