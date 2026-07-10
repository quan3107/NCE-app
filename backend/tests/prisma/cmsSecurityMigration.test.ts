/**
 * File: tests/prisma/cmsSecurityMigration.test.ts
 * Purpose: Verify CMS draft storage is isolated from publicly readable page rows.
 * Why: Row-level policies cannot hide draft columns from anon or non-admin users.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const backendRoot = resolve(import.meta.dirname, '../..')
const draftMigration = readFileSync(
  resolve(
    backendRoot,
    'src/prisma/migrations/20260710100000_add_cms_drafts_revisions/migration.sql',
  ),
  'utf8',
)
const securityMigration = readFileSync(
  resolve(
    backendRoot,
    'src/prisma/migrations/20260710103000_secure_cms_admin_writes/migration.sql',
  ),
  'utf8',
)

describe('CMS security migrations', () => {
  it('stores draft JSON outside the publicly readable page table', () => {
    expect(draftMigration).not.toMatch(/ADD COLUMN draft_content/i)
    expect(draftMigration).toMatch(/CREATE TABLE public\.cms_page_drafts/i)
    expect(draftMigration).toMatch(/content_json JSONB NOT NULL/i)
    expect(draftMigration).toMatch(
      /GRANT UPDATE \([^)]*updated_at[^)]*\)\s+ON public\.cms_page_contents/i,
    )
  })

  it('restricts the draft table to authenticated application administrators', () => {
    expect(securityMigration).toMatch(
      /ALTER TABLE public\.cms_page_drafts ENABLE ROW LEVEL SECURITY/i,
    )
    expect(securityMigration).toMatch(
      /cms_page_drafts_admin_read[\s\S]*TO authenticated[\s\S]*current_setting\('app\.current_user_role', true\) = 'admin'/i,
    )
    expect(securityMigration).not.toMatch(
      /(?:GRANT[^;]*ON public\.cms_page_drafts[^;]*TO anon|ON public\.cms_page_drafts[^;]*TO anon)/i,
    )
  })
})
