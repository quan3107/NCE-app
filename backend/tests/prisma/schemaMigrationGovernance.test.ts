/**
 * File: backend/tests/prisma/schemaMigrationGovernance.test.ts
 * Purpose: Lock the schema-reconciliation migration, checksum gate, and CI replay contract.
 * Why: Applied migrations and hosted schema drift must fail deterministically before deployment.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')

async function readRepositoryFile(relativePath: string): Promise<string> {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8')
}

describe('schema and migration governance', () => {
  it('pins migration line endings and normalized applied checksums', async () => {
    const attributes = await readRepositoryFile('.gitattributes')
    const manifest = JSON.parse(
      await readRepositoryFile('backend/src/prisma/applied-migration-checksums.json'),
    ) as { algorithm: string; lineEndings: string; migrations: Record<string, string> }

    expect(attributes).toContain(
      'backend/src/prisma/migrations/**/migration.sql text eol=lf',
    )
    expect(manifest.algorithm).toBe('sha256')
    expect(manifest.lineEndings).toBe('lf')
    expect(Object.keys(manifest.migrations)).toContain('20251008120500_init')
    expect(Object.keys(manifest.migrations)).toContain(
      '20260714153000_reconcile_application_schema',
    )
  })

  it('exposes checksum and two-way schema checks as package commands', async () => {
    const packageJson = JSON.parse(await readRepositoryFile('backend/package.json')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts['prisma:checksums']).toContain('verifyMigrationChecksums')
    expect(packageJson.scripts['prisma:checksums:database']).toContain('--database')
    expect(packageJson.scripts['prisma:checksums:database:exact']).toContain(
      '--database-exact',
    )
    expect(packageJson.scripts['prisma:diff']).toContain('--from-schema')
    expect(packageJson.scripts['prisma:diff:reverse']).toContain(
      '--from-config-datasource',
    )
  })

  it('guards nullable contract columns before enforcing them', async () => {
    const migration = await readRepositoryFile(
      'backend/src/prisma/migrations/20260714153000_reconcile_application_schema/migration.sql',
    )

    expect(migration).toContain("SET lock_timeout = '5s'")
    expect(migration).toContain('cms_content_items_required_fields_check')
    expect(migration).toContain('ielts_assignment_types_required_fields_check')
    expect(migration).toMatch(/VALIDATE CONSTRAINT[\s\S]*SET NOT NULL/)
    expect(migration).toContain(
      'CREATE INDEX "cms_content_items_section_id_sort_order_is_active_idx"',
    )
    expect(migration).toContain('CREATE INDEX "nce_exercise_attempts_student_id_idx"')
    expect(migration).toContain(
      'CREATE INDEX "user_dashboard_widget_preferences_widget_definition_id_idx"',
    )
  })

  it('keeps hosted defaults, keys, foreign-key actions, and useful indexes explicit', async () => {
    const schema = await readRepositoryFile('backend/src/prisma/schema.prisma')

    expect(schema).toContain('@default(dbgenerated("gen_random_uuid()"))')
    expect(schema).toMatch(
      /model IeltsAssignmentType[\s\S]*@@id\(\[id, configVersion\]\)/,
    )
    expect(schema).toMatch(
      /permission\s+Permission\s+@relation\([^\n]*onDelete: Cascade, onUpdate: NoAction\)/,
    )
    expect(schema).toContain(
      '@@unique([policyId, acceptToken], map: "file_upload_allowed_types_policy_token_key")',
    )
    expect(schema).toContain(
      '@@index([pageId, sortOrder], map: "idx_cms_sections_page_id_sort")',
    )
  })

  it('runs disposable replay, checksums, probes, and both schema diff directions in CI', async () => {
    const workflow = await readRepositoryFile('.github/workflows/ci.yml')

    expect(workflow).toContain('npm run prisma:checksums:database')
    expect(workflow).toContain('fetch-depth: 0')
    expect(workflow).toContain('npm run prisma:checksums -- --git-base')
    expect(workflow).toContain('github.event.repository.default_branch')
    expect(workflow).not.toContain("if: github.event_name != 'workflow_dispatch'")
    expect(workflow).toContain('npm run prisma:checksums:database:exact')
    expect(workflow).toContain('npm run prisma:diff:reverse')
    expect(workflow).toContain('schemaGovernance.probe.sql')
  })

  it('proves CMS revision history starts at one and remains contiguous', async () => {
    const probe = await readRepositoryFile(
      'backend/tests/prisma/schemaGovernance.probe.sql',
    )

    expect(probe).toContain('ARRAY[2, 3]')
    expect(probe).toContain('ARRAY[1, 2, 3]')
    expect(probe).toContain('revision_number <> expected_revision')
  })

  it('documents the single-owner workflow and safe recovery procedure', async () => {
    const runbook = await readRepositoryFile(
      'docs/prisma-supabase-migration-governance.md',
    )

    expect(runbook).toContain('Prisma migrations are authoritative')
    expect(runbook).toContain('supabase_migrations.schema_migrations')
    expect(runbook).toContain('Pre-deploy backup')
    expect(runbook).toContain('Roll forward')
    expect(runbook).toContain('port `5432`')
    expect(runbook).toContain('port `6543`')
  })
})
