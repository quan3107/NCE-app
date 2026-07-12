/**
 * Location: tests/prisma/cmsDraftRevisionMigration.test.ts
 * Purpose: Verify the immutable CMS history converges on Prisma's draft/revision schema.
 * Why: Applied migration bytes stay fixed while forward migrations remove schema drift.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appliedMigration = readFileSync(
  resolve(
    process.cwd(),
    'src/prisma/migrations/20260710100000_add_cms_drafts_revisions/migration.sql',
  ),
  'utf8',
)
const finalMigrationPath = resolve(
  process.cwd(),
  'src/prisma/migrations/20260712100000_finalize_cms_migration_integrity/migration.sql',
)
const finalMigration = existsSync(finalMigrationPath)
  ? readFileSync(finalMigrationPath, 'utf8')
  : ''
const schema = readFileSync(resolve(process.cwd(), 'src/prisma/schema.prisma'), 'utf8')
const revisionBootstraps = [
  '20260710110000_bootstrap_cms_admin_data',
  '20260710110100_bootstrap_cms_homepage',
  '20260710110200_bootstrap_cms_about_page',
].map((name) =>
  readFileSync(
    resolve(process.cwd(), `src/prisma/migrations/${name}/migration.sql`),
    'utf8',
  ),
)

describe('CMS draft and revision migration chain', () => {
  it('ends with Prisma-compatible indexes and referential actions', () => {
    for (const index of [
      'cms_page_revisions_page_id_revision_number_key',
      'cms_page_revisions_page_id_created_at_idx',
      'cms_page_revisions_created_by_id_idx',
      'cms_page_revisions_source_revision_id_idx',
    ]) {
      expect(finalMigration).toContain(`INDEX IF NOT EXISTS ${index}`)
    }
    expect(finalMigration).not.toContain('created_at DESC')

    for (const constraint of [
      'cms_page_drafts_page_id_fkey',
      'cms_page_revisions_page_id_fkey',
      'cms_page_revisions_created_by_id_fkey',
      'cms_page_revisions_source_revision_id_fkey',
    ]) {
      expect(finalMigration).toMatch(
        new RegExp(
          `CONSTRAINT ${constraint}[^;]+ON DELETE (?:CASCADE|SET NULL) ON UPDATE CASCADE`,
          'i',
        ),
      )
    }
  })

  it('uses the deployed UUID default for bootstraps before dropping drifted defaults', () => {
    expect(appliedMigration).toMatch(
      /CREATE TABLE public\.cms_page_revisions[\s\S]*?id UUID PRIMARY KEY DEFAULT/,
    )
    for (const bootstrap of revisionBootstraps) {
      expect(bootstrap).toMatch(/INSERT INTO public\.cms_page_revisions/)
      expect(bootstrap).not.toMatch(/\(\s*id,\s*page_id/)
    }
    expect(finalMigration).toContain('ALTER COLUMN updated_at DROP DEFAULT')
    expect(finalMigration).toContain('ALTER COLUMN id DROP DEFAULT')
  })

  it('maps the rollback-source index in Prisma', () => {
    expect(schema).toMatch(
      /@@index\(\s*\[sourceRevisionId\],\s*map:\s*"cms_page_revisions_source_revision_id_idx"\s*\)/,
    )
  })
})
