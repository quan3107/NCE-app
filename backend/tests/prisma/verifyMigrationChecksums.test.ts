/**
 * File: backend/tests/prisma/verifyMigrationChecksums.test.ts
 * Purpose: Exercise deployed-history modes and owner-connection TLS policy.
 * Why: Pre-deploy checks may allow only trailing pending migrations without weakening trust.
 */

import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  databaseSsl,
  verifyDeployedChecksums,
} from '../../scripts/verifyMigrationChecksums.js'

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

const migrations = new Map<string, Buffer>([
  ['001_first', Buffer.from('SELECT 1;\n')],
  ['002_second', Buffer.from('SELECT 2;\n')],
])

const firstDeployed = [{ migration_name: '001_first', checksum: checksum('SELECT 1;\n') }]

describe('deployed migration checksum policy', () => {
  it('allows a trailing repository-only migration only in pending mode', () => {
    expect(() => verifyDeployedChecksums(firstDeployed, migrations, false)).not.toThrow()
    expect(() => verifyDeployedChecksums(firstDeployed, migrations, true)).toThrow(
      /exactly 2 applied migrations/,
    )
  })

  it('rejects an unknown deployed migration', () => {
    expect(() =>
      verifyDeployedChecksums(
        [{ migration_name: '999_unknown', checksum: checksum('SELECT 9;\n') }],
        migrations,
        false,
      ),
    ).toThrow(/unknown migration/)
  })

  it('rejects a deployed checksum mismatch', () => {
    expect(() =>
      verifyDeployedChecksums(
        [{ migration_name: '001_first', checksum: checksum('changed') }],
        migrations,
        false,
      ),
    ).toThrow(/checksum differs/)
  })

  it('accepts exact equal histories', () => {
    expect(() =>
      verifyDeployedChecksums(
        [
          ...firstDeployed,
          { migration_name: '002_second', checksum: checksum('SELECT 2;\n') },
        ],
        migrations,
        true,
      ),
    ).not.toThrow()
  })
})

describe('database SSL policy', () => {
  it('disables TLS only for loopback and verifies remote certificates', () => {
    expect(databaseSsl('postgresql://user:pass@localhost:5432/database')).toBe(false)
    expect(databaseSsl('postgresql://user:pass@127.0.0.1:5432/database')).toBe(false)
    expect(databaseSsl('postgresql://user:pass@[::1]:5432/database')).toBe(false)
    expect(
      databaseSsl('postgresql://user:pass@db.example.com:5432/database', 'trusted-ca'),
    ).toEqual({ ca: 'trusted-ca', rejectUnauthorized: true })
    expect(() =>
      databaseSsl('postgresql://user:pass@db.example.com:5432/database'),
    ).toThrow(/DIRECT_DATABASE_CA_CERT_PATH/)
    expect(
      databaseSsl(
        'postgresql://user:pass@db.example.com:5432/database?sslmode=verify-full&sslrootcert=%2Fpath%2Fca.crt',
      ),
    ).toBeUndefined()
    expect(() =>
      databaseSsl(
        'postgresql://user:pass@db.example.com:5432/database?sslmode=verify-full',
        'trusted-ca',
      ),
    ).toThrow(/Do not combine/)
    expect(() =>
      databaseSsl('postgresql://user:pass@db.example.com:5432/database?sslmode=require'),
    ).toThrow(/DIRECT_DATABASE_CA_CERT_PATH/)
  })
})
