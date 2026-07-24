/**
 * File: tests/prisma/productionBootstrapDocumentation.test.ts
 * Purpose: Lock production database runbook rendering and demo-mode wording.
 * Why: Operational steps and destructive seed requirements must remain unambiguous.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const backendReadme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')
const bootstrapRunbook = readFileSync(
  resolve(process.cwd(), '../docs/production-database-bootstrap.md'),
  'utf8',
)
const productionSequence = bootstrapRunbook
  .split('## Production sequence')[1]
  ?.split('## Production-like rehearsal checklist')[0]

describe('production bootstrap documentation', () => {
  it('uses stable headings for every production sequence step', () => {
    for (const step of [
      '### 1. Run read-only gates',
      '### 2. Complete hosted preflight',
      '### 3. Enter maintenance mode',
      '### 4. Run owner DDL and bootstrap',
      '### 5. Verify before restoring service',
    ]) {
      expect(productionSequence).toContain(step)
    }
    expect(productionSequence).not.toMatch(/\n\d+\.\s/)
  })

  it('documents the exact allowed demo modes', () => {
    for (const guide of [backendReadme, bootstrapRunbook]) {
      expect(guide).toContain('`NODE_ENV=development` or `NODE_ENV=test`')
      expect(guide).not.toContain('rejects remote hosts and production mode')
    }
  })

  it('classifies expected pre-deploy exit codes without disabling fatal gates', () => {
    expect(productionSequence).toContain('if [ "$status_code" -eq 1 ]')
    expect(productionSequence).toContain('if [ "$diff_code" -eq 2 ]')
    expect(productionSequence).toContain('if [ "$reverse_diff_code" -eq 2 ]')
    expect(productionSequence).toContain('exit "$status_code"')
    expect(productionSequence).toContain('exit "$diff_code"')
    expect(productionSequence).toContain('exit "$reverse_diff_code"')
  })

  it('preflights migration-owner role-management authority', () => {
    expect(bootstrapRunbook).toContain('rolcreaterole')
    expect(bootstrapRunbook).toContain("target_role.rolname = 'anon'")
    expect(bootstrapRunbook).toContain("target_role.rolname = 'authenticated'")
    expect(bootstrapRunbook).toContain('membership.admin_option')
  })
})
