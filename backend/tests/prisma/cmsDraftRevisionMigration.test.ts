/**
 * Location: tests/prisma/cmsDraftRevisionMigration.test.ts
 * Purpose: Verify the handwritten CMS draft/revision migration matches Prisma's schema.
 * Why: Schema drift would make the next generated migration rewrite fresh CMS objects.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'src/prisma/migrations/20260710100000_add_cms_drafts_revisions/migration.sql',
  ),
  'utf8',
)

describe('CMS draft and revision migration', () => {
  it('uses Prisma-compatible indexes and referential actions', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX cms_page_revisions_page_id_revision_number_key',
    )
    expect(migration).toContain(
      'CREATE INDEX cms_page_revisions_page_id_created_at_idx\n  ON public.cms_page_revisions(page_id, created_at);',
    )
    expect(migration).toContain(
      'CREATE INDEX cms_page_revisions_created_by_id_idx',
    )
    expect(migration).not.toContain('created_at DESC')

    for (const constraint of [
      'cms_page_drafts_page_id_fkey',
      'cms_page_revisions_page_id_fkey',
      'cms_page_revisions_created_by_id_fkey',
      'cms_page_revisions_source_revision_id_fkey',
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `CONSTRAINT ${constraint}[^;]+ON DELETE (?:CASCADE|SET NULL) ON UPDATE CASCADE`,
          'i',
        ),
      )
    }
  })
})
