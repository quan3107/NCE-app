/**
 * File: tests/prisma/cmsSecurityMigration.test.ts
 * Purpose: Verify CMS draft storage is isolated from publicly readable page rows.
 * Why: Row-level policies cannot hide draft columns from anon or non-admin users.
 */
import { existsSync, readFileSync } from 'node:fs'
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
const bootstrapMigrationPath = resolve(
  backendRoot,
  'src/prisma/migrations/20260710110000_bootstrap_cms_admin_data/migration.sql',
)
const bootstrapMigration = existsSync(bootstrapMigrationPath)
  ? readFileSync(bootstrapMigrationPath, 'utf8')
  : ''
const hierarchyMigrationPath = resolve(
  backendRoot,
  'src/prisma/migrations/20260710111000_harden_cms_public_hierarchy/migration.sql',
)
const hierarchyMigration = existsSync(hierarchyMigrationPath)
  ? readFileSync(hierarchyMigrationPath, 'utf8')
  : ''
const corePageMigrations = [
  '20260710110100_bootstrap_cms_homepage',
  '20260710110200_bootstrap_cms_about_page',
].map((name) => {
  const migrationPath = resolve(
    backendRoot,
    `src/prisma/migrations/${name}/migration.sql`,
  )
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
}).join('\n')

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

  it('bootstraps required CMS data without replacing managed rows', () => {
    expect(bootstrapMigration).toMatch(/INSERT INTO public\.cms_page_contents/i)
    expect(bootstrapMigration).toMatch(/page_key[\s\S]*'contact'/i)
    expect(bootstrapMigration).toMatch(/WHERE NOT EXISTS[\s\S]*page_key = 'contact'/i)
    expect(bootstrapMigration).toMatch(/'cms:manage'[\s\S]*ON CONFLICT/i)
    expect(bootstrapMigration).not.toMatch(/ON CONFLICT \(key\) DO UPDATE/i)
    expect(bootstrapMigration).toMatch(/INSERT INTO public\.role_permissions[\s\S]*'admin'/i)
    expect(bootstrapMigration).toMatch(
      /INSERT INTO public\.navigation_items[\s\S]*'\/admin\/content'[\s\S]*WHERE NOT EXISTS/i,
    )
    expect(bootstrapMigration).not.toMatch(/DELETE FROM/i)
  })

  it('captures ordered baseline revisions only when history is absent', () => {
    expect(bootstrapMigration).toMatch(/INSERT INTO public\.cms_page_revisions/i)
    expect(bootstrapMigration).toMatch(/jsonb_agg\([\s\S]*ORDER BY/i)
    expect(bootstrapMigration).toMatch(
      /NOT EXISTS[\s\S]*FROM public\.cms_page_revisions/i,
    )
    expect(bootstrapMigration).toMatch(/SET published_revision = 1/i)
  })

  it('bootstraps missing core pages with their own baseline revisions', () => {
    expect(corePageMigrations).toMatch(/page_key[\s\S]*'homepage'/i)
    expect(corePageMigrations).toMatch(/page_key[\s\S]*'about'/i)
    expect(corePageMigrations.match(/INSERT INTO public\.cms_page_revisions/gi)).toHaveLength(2)
    expect(corePageMigrations.match(/WHERE NOT EXISTS/gi)?.length).toBeGreaterThanOrEqual(4)
    expect(corePageMigrations).not.toMatch(/DELETE FROM/i)
  })

  it('requires active ancestors when public roles read CMS children', () => {
    expect(hierarchyMigration).toMatch(
      /DROP POLICY(?: IF EXISTS)? cms_sections_public_read/i,
    )
    expect(hierarchyMigration).toMatch(
      /DROP POLICY(?: IF EXISTS)? cms_content_items_public_read/i,
    )
    expect(hierarchyMigration).toMatch(
      /cms_sections_public_read[\s\S]*EXISTS[\s\S]*cms_page_contents[\s\S]*page\.is_active = TRUE/i,
    )
    expect(hierarchyMigration).toMatch(
      /cms_content_items_public_read[\s\S]*EXISTS[\s\S]*cms_sections[\s\S]*cms_page_contents[\s\S]*section\.is_active = TRUE[\s\S]*page\.is_active = TRUE/i,
    )
  })
})
