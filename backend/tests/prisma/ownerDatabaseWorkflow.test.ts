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
const rolloutRunbook = readRepo('docs/supabase-data-api-runtime-boundary.md')
const bootstrapRunbook = readRepo('docs/production-database-bootstrap.md')
const migrationGovernance = readRepo('docs/prisma-supabase-migration-governance.md')
const rootReadme = readRepo('README.md')
const backendReadme = readBackend('README.md')
const demoSeed = readBackend('src/prisma/seed.ts')
const ieltsAssignmentSeed = readBackend('src/prisma/seedIeltsAssignments.ts')
const ieltsSandboxSeed = readBackend('src/prisma/seedIeltsSandbox.ts')
const nceContentSeed = readBackend('src/prisma/seedNceContent.ts')
const referenceSeed = readBackend('src/prisma/seedReference.ts')
const ieltsSeed = readBackend('src/prisma/seedIeltsConfig.ts')
const navigationSeed = readBackend('src/prisma/seeds/navigation.seed.ts')

describe('owner-only database workflow', () => {
  it('documents every fresh local bootstrap prerequisite in execution order', () => {
    const pgbossInstall = rootReadme.indexOf('npm run pgboss:install')
    const prismaMigrate = rootReadme.indexOf('npm run prisma:migrate')

    expect(rootReadme).toContain('backend/README.md#local-database-role-bootstrap')
    expect(backendReadme).toContain('CREATE ROLE nce_runtime LOGIN')
    expect(backendReadme).toContain('CREATE ROLE nce_job_runner LOGIN')
    expect(backendReadme).toContain('CREATE ROLE authenticator NOLOGIN')
    expect(backendReadme).toContain('GRANT service_role TO nce_runtime')
    expect(backendReadme).toContain('WITH ADMIN FALSE, SET TRUE, INHERIT FALSE')
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
    expect(ownerEnvironment).toContain('DIRECT_DATABASE_CA_CERT_PATH=')
    expect(ownerEnvironment).not.toContain('DATABASE_URL=')
    expect(ownerJobRunner).toContain("resolve(directory, '.env.local')")
    expect(ownerJobRunner).toContain('DIRECT_URL: connectionUrl')
    expect(ownerJobRunner).toContain('DATABASE_URL: connectionUrl')
    expect(ownerJobRunner).toContain("url.searchParams.set('sslaccept', 'strict')")
    expect(ownerJobRunner).toContain("url.searchParams.set('sslmode', 'verify-full')")
    expect(prismaConfig).toContain('DIRECT_URL is required for Prisma migration commands')
    expect(prismaConfig).not.toContain(
      'process.env.DIRECT_URL ?? process.env.DATABASE_URL',
    )
    for (const script of [
      'prisma:migrate',
      'prisma:status',
      'prisma:deploy',
      'prisma:migrate:deploy',
      'prisma:diff',
      'pgboss:install',
      'seed:demo',
      'seed:reference',
      'seed:ielts-config',
      'seed:demo:ielts-assignments',
      'seed:demo:ielts-sandbox',
      'seed:cms',
      'seed:demo:nce-content',
      'seed:navigation',
    ]) {
      expect(packageJson.scripts[script]).toContain('scripts/runOwnerJob.ts')
    }
    expect(packageJson.scripts['verify:ielts-config']).toBe(
      'tsx src/prisma/verifyIeltsConfig.ts',
    )
    for (const removedScript of [
      'seed:ielts',
      'seed:ielts-sandbox',
      'seed:nce-content',
    ]) {
      expect(packageJson.scripts[removedScript]).toBeUndefined()
    }
    expect(rootReadme).toContain('`verify:ielts-config` reads the runtime `DATABASE_URL`')
    expect(rootReadme).toContain('does not require `DIRECT_URL`')
    expect(rootReadme).toContain('npm --prefix backend run prisma:deploy')
    expect(rootReadme).toContain(
      'The explicit `seed:demo` command creates these local accounts:',
    )
    expect(rootReadme).not.toContain('The main seed')
    expect(rootReadme).not.toContain(
      'npx prisma migrate deploy --config prisma.config.ts',
    )
    expect(ciWorkflow).toContain('- name: Seed backend CMS test content')
    expect(ciWorkflow).toContain('CREATE ROLE authenticator NOLOGIN')
    expect(ciWorkflow).not.toMatch(
      /- name: Seed backend CMS test content[\s\S]{0,160}DATABASE_URL:/,
    )
  })

  it('documents production prerequisites before migration execution', () => {
    const pgbossInstall = bootstrapRunbook.indexOf(
      'npm --prefix backend run pgboss:install',
    )
    const prismaDeploy = bootstrapRunbook.indexOf(
      'npm --prefix backend run prisma:migrate:deploy',
    )

    for (const role of [
      'anon',
      'authenticated',
      'service_role',
      'authenticator',
      'nce_runtime',
      'nce_job_runner',
    ]) {
      expect(bootstrapRunbook).toContain(role)
    }
    for (const attribute of [
      'NOINHERIT',
      'NOSUPERUSER',
      'NOCREATEDB',
      'NOCREATEROLE',
      'NOREPLICATION',
      'NOBYPASSRLS',
    ]) {
      expect(bootstrapRunbook).toContain(attribute)
    }
    expect(bootstrapRunbook).toContain('WITH ADMIN FALSE, SET TRUE, INHERIT FALSE')
    expect(bootstrapRunbook).toContain('Grant `CONNECT`')
    expect(bootstrapRunbook).toContain('backend/README.md#local-database-role-bootstrap')
    expect(bootstrapRunbook).toMatch(/must\s+not have any role memberships/)
    expect(bootstrapRunbook).toMatch(
      /Leave its provider-managed\s+login attributes and password unchanged/,
    )
    expect(bootstrapRunbook).not.toMatch(/provider-managed `authenticator`[^.]*NOLOGIN/)
    expect(bootstrapRunbook).toContain('plain-PostgreSQL rehearsal stub')
    expect(bootstrapRunbook).toContain('db.<project-ref>.supabase.co:5432')
    expect(bootstrapRunbook).toContain('IPv6')
    expect(bootstrapRunbook).toContain('IPv4 add-on')
    for (const guide of [bootstrapRunbook, migrationGovernance]) {
      expect(guide).toContain('db.<project-ref>.supabase.co:5432')
      expect(guide).toContain('IPv6')
      expect(guide).toContain('IPv4 add-on')
      expect(guide).not.toMatch(/direct\/session pooler/i)
      expect(guide).toMatch(/do not use either Supavisor pooler/i)
      expect(guide).toMatch(/session-pooling\s+endpoint/i)
      expect(guide).toMatch(/transaction-pooling\s+endpoint/i)
      expect(guide).toMatch(/transaction-pooling\s+endpoint[^.]*port `6543`/i)
    }
    expect(bootstrapRunbook).toMatch(
      /`DATABASE_URL` and `JOB_DATABASE_URL`[^.]*pooling choices[^.]*separate/i,
    )
    expect(pgbossInstall).toBeGreaterThan(-1)
    expect(pgbossInstall).toBeLessThan(prismaDeploy)
  })

  it('closes the external pool in direct seed commands', () => {
    for (const commandSource of [
      demoSeed,
      ieltsAssignmentSeed,
      ieltsSandboxSeed,
      nceContentSeed,
      referenceSeed,
      ieltsSeed,
      navigationSeed,
    ]) {
      expect(commandSource).toMatch(/shutdownPrisma\(\)|\.finally\(shutdownPrisma\)/)
      expect(commandSource).not.toContain('await basePrisma.$disconnect()')
      expect(commandSource).not.toContain('await prisma.$disconnect()')
    }
  })

  it('gates every executable demo fixture before database access', () => {
    for (const commandSource of [
      demoSeed,
      ieltsAssignmentSeed,
      ieltsSandboxSeed,
      nceContentSeed,
    ]) {
      expect(commandSource).toContain('assertDemoSeedTarget()')
    }
  })

  it('pins the locked reference bootstrap to read committed', () => {
    expect(referenceSeed).toContain(
      'isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted',
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

  it('rejects unreviewed runtime role memberships', () => {
    expect(runtimeRoleProbe).toContain("member.rolname = 'nce_runtime'")
    expect(runtimeRoleProbe).toContain("grantor.rolname = 'postgres'")
    expect(runtimeRoleProbe).toContain(
      'nce_runtime memberships do not match the reviewed SET-only roles',
    )
    expect(ciWorkflow).toContain('CREATE ROLE nce_unreviewed_runtime_role NOLOGIN;')
    expect(ciWorkflow).toContain(
      'runtime role probe accepted an unexpected nce_runtime membership',
    )
    expect(ciWorkflow).toContain('DROP ROLE nce_unreviewed_runtime_role;')
    expect(rolloutRunbook).toContain('exactly three reviewed SET-only memberships')
  })
})
