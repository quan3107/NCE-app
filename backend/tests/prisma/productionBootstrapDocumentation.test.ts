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
})
