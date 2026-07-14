/**
 * File: tests/prisma/ownerDatabaseWorkflow.test.ts
 * Purpose: Lock owner-only database tooling and request-role normalization.
 * Why: Deployment credentials and elevated request roles must stay out of runtime.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const readBackend = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const readRepo = (path: string) =>
  readFileSync(resolve(process.cwd(), '..', path), 'utf8')

const packageJson = JSON.parse(readBackend('package.json')) as {
  scripts: Record<string, string>
}
const ownerEnvironment = readBackend('.env.local.example')
const ownerJobRunner = readBackend('scripts/runOwnerJob.ts')
const prismaConfig = readBackend('prisma.config.ts')
const runtimeRoleProbe = readBackend('tests/prisma/runtimeRoleBoundary.probe.sql')
const normalizationMigration = readBackend(
  'src/prisma/migrations/20260714100000_normalize_backend_request_roles/migration.sql',
)
const ciWorkflow = readRepo('.github/workflows/ci.yml')
const rootReadme = readRepo('README.md')

describe('owner-only database workflow', () => {
  it('documents every fresh local bootstrap prerequisite in execution order', () => {
    const pgbossInstall = rootReadme.indexOf('npm run pgboss:install')
    const prismaMigrate = rootReadme.indexOf('npm run prisma:migrate')

    expect(rootReadme).toContain('CREATE ROLE nce_runtime LOGIN')
    expect(rootReadme).toContain('CREATE ROLE nce_job_runner LOGIN')
    expect(rootReadme).toContain('GRANT service_role TO nce_runtime')
    expect(rootReadme).toContain('WITH ADMIN FALSE, SET TRUE, INHERIT FALSE')
    expect(rootReadme).toContain('cp backend/.env.local.example backend/.env.local')
    expect(rootReadme).toContain(
      'DATABASE_URL=postgres://nce_runtime:nce_runtime@localhost:5432/nce_app',
    )
    expect(rootReadme).toContain(
      'JOB_DATABASE_URL=postgres://nce_job_runner:nce_job_runner@localhost:5432/nce_app',
    )
    expect(rootReadme).not.toContain(
      'DATABASE_URL=postgres://postgres:postgres@localhost:5432/nce_app\nJOB_DATABASE_URL',
    )
    expect(pgbossInstall).toBeGreaterThan(-1)
    expect(pgbossInstall).toBeLessThan(prismaMigrate)
    expect(rootReadme).not.toContain(
      "`backend/.env.example` still lists Vite's default `5173`",
    )
  })

  it('scopes owner credentials to approved child commands', () => {
    expect(ownerEnvironment).toContain('DIRECT_URL=')
    expect(ownerEnvironment).not.toContain('DATABASE_URL=')
    expect(ownerJobRunner).toContain("resolve(directory, '.env.local')")
    expect(ownerJobRunner).toContain('DIRECT_URL: ownerDatabaseUrl')
    expect(ownerJobRunner).toContain('DATABASE_URL: ownerDatabaseUrl')
    expect(prismaConfig).toContain('DIRECT_URL is required for Prisma migration commands')
    expect(prismaConfig).not.toContain(
      'process.env.DIRECT_URL ?? process.env.DATABASE_URL',
    )
    for (const script of [
      'prisma:migrate',
      'prisma:status',
      'prisma:deploy',
      'prisma:diff',
      'pgboss:install',
      'seed',
      'seed:ielts-config',
      'verify:ielts-config',
      'seed:ielts',
      'seed:ielts-sandbox',
      'seed:cms',
      'seed:nce-content',
      'seed:navigation',
    ]) {
      expect(packageJson.scripts[script]).toContain('scripts/runOwnerJob.ts')
    }
    expect(ciWorkflow).toContain('- name: Seed backend CMS test content')
    expect(ciWorkflow).not.toMatch(
      /- name: Seed backend CMS test content[\s\S]{0,160}DATABASE_URL:/,
    )
  })

  it('normalizes request roles without disturbing owner admin rows', () => {
    const executableSql = normalizationMigration.replace(/^--.*$/gm, '').trim()

    expect(executableSql.startsWith('BEGIN;')).toBe(true)
    expect(executableSql.endsWith('COMMIT;')).toBe(true)
    expect(normalizationMigration).toContain(
      'ALTER ROLE nce_app_anon NOLOGIN NOCREATEDB NOCREATEROLE',
    )
    expect(normalizationMigration).toContain(
      'ALTER ROLE nce_app_authenticated NOLOGIN NOCREATEDB NOCREATEROLE',
    )
    expect(normalizationMigration).toContain('NOREPLICATION NOBYPASSRLS')
    expect(normalizationMigration).toContain(
      "pg_has_role('authenticator', role_name, 'MEMBER')",
    )
    expect(normalizationMigration).toContain('member.rolname = CURRENT_USER')
    expect(normalizationMigration).toContain('membership.admin_option')
    expect(normalizationMigration).toContain('NOT membership.inherit_option')
    expect(normalizationMigration).toContain('NOT membership.set_option')
    expect(normalizationMigration).toContain('IF role_state.rolsuper THEN')
    expect(ciWorkflow).toContain('CREATE ROLE nce_app_anon LOGIN CREATEDB CREATEROLE')
    expect(ciWorkflow).toContain(
      'CREATE ROLE nce_app_authenticated LOGIN CREATEDB CREATEROLE',
    )
    expect(runtimeRoleProbe).toContain('backend request role attributes are unsafe')
    expect(runtimeRoleProbe).toContain('authenticator can assume a backend request role')
  })
})
