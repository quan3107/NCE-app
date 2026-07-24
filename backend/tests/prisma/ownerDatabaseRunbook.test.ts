/**
 * File: tests/prisma/ownerDatabaseRunbook.test.ts
 * Purpose: Verify production database runbook prerequisites and command ordering.
 * Why: Keeping documentation contracts separate makes owner workflow tests maintainable.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const readRepo = (path: string) =>
  readFileSync(resolve(process.cwd(), '..', path), 'utf8')

const bootstrapRunbook = readRepo('docs/production-database-bootstrap.md')
const migrationGovernance = readRepo('docs/prisma-supabase-migration-governance.md')

describe('owner database runbooks', () => {
  it('documents production prerequisites before migration execution', () => {
    const productionSequence = bootstrapRunbook
      .split('## Production sequence')[1]
      ?.split('## Production-like rehearsal checklist')[0]
    const rehearsalChecklist = bootstrapRunbook.split(
      '## Production-like rehearsal checklist',
    )[1]
    const productionGenerate = productionSequence?.indexOf(
      'npm --prefix backend run prisma:generate',
    )
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
    expect(productionGenerate).toBeGreaterThan(-1)
    expect(productionGenerate).toBeLessThan(
      productionSequence?.indexOf('npm --prefix backend run pgboss:install'),
    )
    for (const gate of [
      'npm --prefix backend run prisma:status',
      'npm --prefix backend run prisma:migrations:verify:pending',
      'npm --prefix backend run prisma:diff',
      'Enter maintenance mode',
      'hosted preflight',
    ]) {
      expect(productionSequence?.indexOf(gate)).toBeGreaterThan(-1)
      expect(productionSequence?.indexOf(gate)).toBeLessThan(
        productionSequence?.indexOf('npm --prefix backend run pgboss:install'),
      )
    }
    expect(
      rehearsalChecklist?.indexOf('npm --prefix backend run prisma:generate'),
    ).toBeGreaterThan(-1)
    expect(
      rehearsalChecklist?.indexOf('npm --prefix backend run prisma:generate'),
    ).toBeLessThan(rehearsalChecklist?.indexOf('npm --prefix backend run pgboss:install'))
    expect(pgbossInstall).toBeGreaterThan(-1)
    expect(pgbossInstall).toBeLessThan(prismaDeploy)
    expect(migrationGovernance).toContain(
      'https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql',
    )
    expect(migrationGovernance).not.toContain(
      'https://www.prisma.io/docs/orm/overview/databases/postgresql',
    )
  })
})
