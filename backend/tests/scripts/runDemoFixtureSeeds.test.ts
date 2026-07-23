/**
 * File: tests/scripts/runDemoFixtureSeeds.test.ts
 * Purpose: Prove every supplemental demo fixture seed fails closed.
 * Why: Direct and npm entrypoints must reject unsafe targets before database access.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const tsxCli = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs')
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('npm_execpath is required for npm entrypoint tests.')
const fixtureSeeds = [
  {
    command: 'seed:demo:ielts-assignments',
    source: 'src/prisma/seedIeltsAssignments.ts',
    success: 'IELTS assignments seed complete',
  },
  {
    command: 'seed:demo:ielts-sandbox',
    source: 'src/prisma/seedIeltsSandbox.ts',
    success: 'IELTS sandbox seed complete',
  },
  {
    command: 'seed:demo:nce-content',
    source: 'src/prisma/seedNceContent.ts',
    success: 'NCE content seed complete',
  },
] as const
const unsafeTargets = [
  {
    label: 'remote',
    databaseUrl: 'postgresql://owner:secret@127.0.0.2:1/nce_demo',
    error: /loopback database/,
  },
  {
    label: 'unconfirmed loopback',
    databaseUrl: 'postgresql://owner:secret@127.0.0.1:1/nce_demo',
    error: /DEMO_SEED_CONFIRM_DATABASE=nce_demo/,
  },
] as const

function environment(databaseUrl: string, npmEntrypoint: boolean) {
  const childEnvironment = { ...process.env }
  delete childEnvironment.DATABASE_URL
  delete childEnvironment.DEMO_SEED_CONFIRM_DATABASE
  childEnvironment.NODE_ENV = 'development'
  childEnvironment.DIRECT_DATABASE_CA_CERT_PATH = resolve('tests/fixtures/demo-ca.pem')
  childEnvironment[npmEntrypoint ? 'DIRECT_URL' : 'DATABASE_URL'] = databaseUrl
  if (!npmEntrypoint) delete childEnvironment.DIRECT_URL
  return childEnvironment
}

function assertFailedBeforeDatabase(
  result: ReturnType<typeof spawnSync>,
  error: RegExp,
  success: string,
) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  expect(result.status).not.toBe(0)
  expect(output).toMatch(error)
  expect(output).not.toContain(success)
  expect(output).not.toMatch(/Can't reach database server|ECONNREFUSED|P1001/)
}

describe('supplemental demo fixture seed policy', () => {
  for (const fixture of fixtureSeeds) {
    for (const target of unsafeTargets) {
      it(`rejects a ${target.label} target through ${fixture.command}`, () => {
        const result = spawnSync(
          process.execPath,
          [npmCli, 'run', fixture.command, '--silent'],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: environment(target.databaseUrl, true),
            timeout: 8_000,
          },
        )

        assertFailedBeforeDatabase(result, target.error, fixture.success)
      })

      it(`rejects a ${target.label} target through ${fixture.source}`, () => {
        const result = spawnSync(process.execPath, [tsxCli, fixture.source], {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: environment(target.databaseUrl, false),
          timeout: 8_000,
        })

        assertFailedBeforeDatabase(result, target.error, fixture.success)
      })
    }
  }
})
