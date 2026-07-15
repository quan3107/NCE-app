/**
 * File: backend/tests/prisma/verifyMigrationHistory.test.ts
 * Purpose: Exercise trusted-base migration history and deployed-ledger contracts.
 * Why: Git protects repository history while Prisma records what the database ran.
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  databaseSsl,
  verifyBaseMigrationHistory,
  verifyDeployedMigrationHistory,
} from '../../scripts/verifyMigrationHistory.js'

const temporaryRepositories: string[] = []

function git(repository: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim()
}

async function createRepository(): Promise<string> {
  const repository = await mkdtemp(path.join(tmpdir(), 'nce-migration-history-'))
  temporaryRepositories.push(repository)
  git(repository, 'init', '--quiet')
  git(repository, 'config', 'user.email', 'tests@example.com')
  git(repository, 'config', 'user.name', 'Migration History Tests')

  await writeMigration(repository, '001_first', 'SELECT 1;\n')
  await writeMigration(repository, '002_second', 'SELECT 2;\n')
  git(repository, 'add', '.')
  git(repository, 'commit', '--quiet', '-m', 'base migrations')
  git(repository, 'branch', '-M', 'main')
  return repository
}

async function writeMigration(
  repository: string,
  name: string,
  content: string,
): Promise<void> {
  const directory = path.join(repository, 'backend/src/prisma/migrations', name)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'migration.sql'), content)
}

afterEach(async () => {
  await Promise.all(
    temporaryRepositories
      .splice(0)
      .map((repository) => rm(repository, { recursive: true, force: true })),
  )
})

describe('trusted Git base migration history', () => {
  it.each([
    {
      name: 'modified',
      mutate: (repository: string) =>
        writeMigration(repository, '001_first', 'SELECT 9;\n'),
    },
    {
      name: 'replaced',
      mutate: (repository: string) =>
        writeMigration(repository, '001_first', 'SELECT 2;\n'),
    },
    {
      name: 'deleted',
      mutate: (repository: string) =>
        rm(path.join(repository, 'backend/src/prisma/migrations/001_first'), {
          recursive: true,
        }),
    },
    {
      name: 'renamed',
      mutate: (repository: string) =>
        rename(
          path.join(repository, 'backend/src/prisma/migrations/001_first'),
          path.join(repository, 'backend/src/prisma/migrations/003_renamed'),
        ),
    },
  ])('rejects a $name base migration', async ({ mutate }) => {
    const repository = await createRepository()
    await mutate(repository)

    expect(() => verifyBaseMigrationHistory('main', repository)).toThrow(
      /Existing migration history changed relative to main/,
    )
  })

  it('allows one new forward migration directory', async () => {
    const repository = await createRepository()
    await writeMigration(repository, '003_forward', 'SELECT 3;\n')

    expect(() => verifyBaseMigrationHistory('main', repository)).not.toThrow()
  })

  it('rejects a migration inserted before the end of base history', async () => {
    const repository = await createRepository()
    await writeMigration(repository, '001_late_insert', 'SELECT 3;\n')

    expect(() => verifyBaseMigrationHistory('main', repository)).toThrow(
      /not a new forward migration/,
    )
  })

  it('does not let line-ending normalization hide changed content', async () => {
    const repository = await createRepository()
    await writeMigration(repository, '001_first', 'SELECT 9;\r\n')

    expect(() => verifyBaseMigrationHistory('main', repository)).toThrow(
      /Existing migration history changed relative to main/,
    )
  })
})

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

const migrations = new Map<string, Buffer>([
  ['001_first', Buffer.from('SELECT 1;\n')],
  ['002_second', Buffer.from('SELECT 2;\n')],
])

const firstDeployed = [{ migration_name: '001_first', checksum: checksum('SELECT 1;\n') }]

describe('deployed Prisma migration history', () => {
  it('allows only a gap-free prefix in pending mode', () => {
    expect(() =>
      verifyDeployedMigrationHistory(firstDeployed, migrations, false),
    ).not.toThrow()
    expect(() =>
      verifyDeployedMigrationHistory(
        [{ migration_name: '002_second', checksum: checksum('SELECT 2;\n') }],
        migrations,
        false,
      ),
    ).toThrow(/complete prefix/)
  })

  it('requires full ordered convergence in exact mode', () => {
    expect(() => verifyDeployedMigrationHistory(firstDeployed, migrations, true)).toThrow(
      /exactly 2 applied migrations/,
    )
    expect(() =>
      verifyDeployedMigrationHistory(
        [
          { migration_name: '002_second', checksum: checksum('SELECT 2;\n') },
          ...firstDeployed,
        ],
        migrations,
        true,
      ),
    ).toThrow(/complete prefix/)
    expect(() =>
      verifyDeployedMigrationHistory(
        [
          ...firstDeployed,
          { migration_name: '002_second', checksum: checksum('SELECT 2;\n') },
        ],
        migrations,
        true,
      ),
    ).not.toThrow()
  })

  it('rejects unknown names and native checksum mismatches', () => {
    expect(() =>
      verifyDeployedMigrationHistory(
        [{ migration_name: '999_unknown', checksum: checksum('SELECT 9;\n') }],
        migrations,
        false,
      ),
    ).toThrow(/unknown migration/)
    expect(() =>
      verifyDeployedMigrationHistory(
        [{ migration_name: '001_first', checksum: checksum('changed') }],
        migrations,
        false,
      ),
    ).toThrow(/checksum differs/)
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
  })
})
