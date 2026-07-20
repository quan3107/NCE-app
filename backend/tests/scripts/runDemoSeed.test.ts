/**
 * File: tests/scripts/runDemoSeed.test.ts
 * Purpose: Lock the destructive demo seed to an explicitly confirmed local database.
 * Why: Demo fixtures must fail closed before any production-owned data can be deleted.
 */
import { describe, expect, it } from 'vitest'

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
