/**
 * File: tests/scripts/runDemoSeed.test.ts
 * Purpose: Lock the destructive demo seed to an explicitly confirmed local database.
 * Why: Demo fixtures must fail closed before any production-owned data can be deleted.
 */
import { describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { assertDemoSeedTarget } from '../../scripts/runDemoSeed.js'

describe('demo seed target policy', () => {
  it.each([undefined, 'development'])(
    'rejects a remote database when NODE_ENV is %s',
    (nodeEnv) => {
      expect(() =>
        assertDemoSeedTarget({
          DATABASE_URL: 'postgresql://owner:secret@db.example.com:5432/nce',
          DEMO_SEED_CONFIRM_DATABASE: 'nce',
          ...(nodeEnv ? { NODE_ENV: nodeEnv } : {}),
        }),
      ).toThrow(/loopback database/)
    },
  )

  it('rejects a local database without exact name confirmation', () => {
    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL: 'postgresql://owner:secret@localhost:5432/nce_demo',
      }),
    ).toThrow(/DEMO_SEED_CONFIRM_DATABASE=nce_demo/)
  })

  it('rejects a remote driver host override on a local authority', () => {
    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL:
          'postgresql://owner:secret@localhost:5432/nce_demo?host=db.example.com',
        DEMO_SEED_CONFIRM_DATABASE: 'nce_demo',
        NODE_ENV: 'development',
      }),
    ).toThrow(/loopback database/)
  })

  it('confirms the driver-preserved reserved escape exactly', () => {
    const databaseUrl = 'postgresql://owner:secret@localhost:5432/nce%2Fprod'
    expect(new Client({ connectionString: databaseUrl }).database).toBe('nce%2Fprod')

    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL: databaseUrl,
        DEMO_SEED_CONFIRM_DATABASE: 'nce/prod',
        NODE_ENV: 'development',
      }),
    ).toThrow(/DEMO_SEED_CONFIRM_DATABASE=nce%2Fprod/)
    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL: databaseUrl,
        DEMO_SEED_CONFIRM_DATABASE: 'nce%2Fprod',
        NODE_ENV: 'development',
      }),
    ).not.toThrow()
  })

  it('confirms a driver-preserved extra leading slash exactly', () => {
    const databaseUrl = 'postgresql://owner:secret@localhost:5432//prod'
    expect(new Client({ connectionString: databaseUrl }).database).toBe('/prod')

    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL: databaseUrl,
        DEMO_SEED_CONFIRM_DATABASE: 'prod',
        NODE_ENV: 'development',
      }),
    ).toThrow(/DEMO_SEED_CONFIRM_DATABASE=\/prod/)
    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL: databaseUrl,
        DEMO_SEED_CONFIRM_DATABASE: '/prod',
        NODE_ENV: 'development',
      }),
    ).not.toThrow()
  })

  it('accepts an exactly confirmed local disposable database', () => {
    expect(() =>
      assertDemoSeedTarget({
        DATABASE_URL: 'postgresql://owner:secret@127.0.0.1:5432/nce_demo',
        DEMO_SEED_CONFIRM_DATABASE: 'nce_demo',
        NODE_ENV: 'development',
      }),
    ).not.toThrow()
  })
})
