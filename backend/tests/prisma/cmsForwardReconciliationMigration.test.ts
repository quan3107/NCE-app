/**
 * Location: tests/prisma/cmsForwardReconciliationMigration.test.ts
 * Purpose: Verify the forward CMS migration reconciles databases that ran the original DDL.
 * Why: Applied migration names cannot be replayed after their SQL is corrected in source control.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'src/prisma/migrations/20260711160000_reconcile_cms_draft_schema/migration.sql',
  ),
  'utf8',
)
const deployedRepairPath = resolve(
  process.cwd(),
  'src/prisma/migrations/20260711170000_grant_cms_page_updated_at/migration.sql',
)

describe('CMS forward reconciliation migration', () => {
  it('atomically creates and backfills the draft table before dropping legacy data', () => {
    expect(migration.indexOf('BEGIN;')).toBeLessThan(
      migration.indexOf('CREATE TABLE IF NOT EXISTS'),
    )
    expect(migration.trimEnd()).toMatch(/COMMIT;$/)
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.cms_page_drafts')
    expect(migration).toMatch(
      /INSERT INTO public\.cms_page_drafts[\s\S]+draft_content[\s\S]+DROP COLUMN draft_content/,
    )
  })

  it('reconciles Prisma-compatible defaults, indexes, and foreign keys', () => {
    expect(migration).toContain('ALTER COLUMN updated_at DROP DEFAULT')
    expect(migration).toContain('ALTER COLUMN id DROP DEFAULT')
    expect(migration).toContain(
      'DROP CONSTRAINT IF EXISTS cms_page_revisions_page_revision_key',
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS cms_page_revisions_page_id_revision_number_key',
    )
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS cms_page_revisions_page_id_created_at_idx',
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

  it('enables draft RLS and policies before authenticated write grants', () => {
    const rlsIndex = migration.indexOf(
      'ALTER TABLE public.cms_page_drafts ENABLE ROW LEVEL SECURITY',
    )
    const grantIndex = migration.indexOf(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.cms_page_drafts TO authenticated',
    )

    expect(rlsIndex).toBeGreaterThan(-1)
    expect(grantIndex).toBeGreaterThan(rlsIndex)
    for (const policy of [
      'cms_page_drafts_admin_read',
      'cms_page_drafts_admin_insert',
      'cms_page_drafts_admin_update',
    ]) {
      expect(migration).toContain(`CREATE POLICY ${policy}`)
    }
    expect(migration).not.toMatch(/GRANT[^;]+TO anon/i)
  })

  it('grants every Prisma-managed CMS page update column', () => {
    expect(migration).toMatch(
      /GRANT UPDATE \(draft_version, published_draft_version, published_revision, published_at, updated_at\)\s+ON public\.cms_page_contents TO authenticated;/,
    )
  })

  it('repairs the grant after the reconciliation was already deployed', () => {
    expect(existsSync(deployedRepairPath)).toBe(true)
    if (!existsSync(deployedRepairPath)) return

    const deployedRepair = readFileSync(deployedRepairPath, 'utf8')
    expect(deployedRepair).toMatch(
      /GRANT UPDATE \(draft_version, published_draft_version, published_revision, published_at, updated_at\)\s+ON public\.cms_page_contents TO authenticated;/,
    )
  })
})
