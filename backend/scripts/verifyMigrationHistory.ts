/**
 * File: backend/scripts/verifyMigrationHistory.ts
 * Purpose: Verify immutable Git migration history and Prisma's deployed ledger.
 * Why: Git is the repository trust boundary; the database proves what Prisma ran.
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { Client } from 'pg'

import { databaseSslOptions, isLoopbackDatabaseUrl } from './databaseConnectionPolicy.js'

type DeployedMigration = {
  migration_name: string
  checksum: string
}

export const deployedMigrationsQuery = `
  SELECT migration_name, checksum
  FROM public._prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  ORDER BY finished_at, migration_name
`

const backendRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(backendRoot, '..')
const migrationRelativeRoot = 'backend/src/prisma/migrations'
const migrationsRoot = path.join(repositoryRoot, migrationRelativeRoot)

function git(repository: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function resolveBaseCommit(baseRef: string, repository: string): string {
  try {
    return git(repository, [
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${baseRef}^{commit}`,
    ]).trim()
  } catch {
    throw new Error(`Unable to resolve trusted Git base: ${baseRef}`)
  }
}

function loadBaseMigrationBlobs(
  baseRef: string,
  repository: string,
): Map<string, string> {
  const baseCommit = resolveBaseCommit(baseRef, repository)
  const output = git(repository, [
    'ls-tree',
    '-r',
    baseCommit,
    '--',
    migrationRelativeRoot,
  ])
  const blobs = new Map<string, string>()
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/)
    if (!match?.[1] || !match[2]?.endsWith('/migration.sql')) continue
    blobs.set(match[2], match[1])
  }
  if (blobs.size === 0) {
    throw new Error(`Trusted Git base ${baseRef} contains no Prisma migrations.`)
  }
  return blobs
}

function migrationName(relativeFile: string): string {
  return relativeFile.slice(migrationRelativeRoot.length + 1).split('/')[0] ?? ''
}

export function verifyBaseMigrationHistory(
  baseRef: string,
  repository = repositoryRoot,
): void {
  const baseBlobs = loadBaseMigrationBlobs(baseRef, repository)
  const baseNames = [...baseBlobs.keys()].map(migrationName).sort()
  const latestBaseName = baseNames.at(-1) ?? ''
  const changed: string[] = []

  for (const [relativeFile, expectedBlob] of baseBlobs) {
    const absoluteFile = path.join(repository, ...relativeFile.split('/'))
    if (!existsSync(absoluteFile)) {
      changed.push(`missing ${relativeFile}`)
      continue
    }
    const actualBlob = git(repository, [
      'hash-object',
      '--no-filters',
      '--',
      relativeFile,
    ]).trim()
    if (actualBlob !== expectedBlob) changed.push(`modified ${relativeFile}`)
  }

  if (changed.length > 0) {
    throw new Error(
      `Existing migration history changed relative to ${baseRef}:\n${changed.join('\n')}`,
    )
  }

  const currentNames = readdirSyncDirectories(
    path.join(repository, migrationRelativeRoot),
  )
  for (const name of currentNames.filter((entry) => !baseNames.includes(entry))) {
    const migrationFile = path.join(
      repository,
      migrationRelativeRoot,
      name,
      'migration.sql',
    )
    if (name <= latestBaseName || !existsSync(migrationFile)) {
      throw new Error(`${name} is not a new forward migration relative to ${baseRef}.`)
    }
  }
}

function readdirSyncDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n')
}

async function loadMigrationFiles(): Promise<Map<string, Buffer>> {
  const entries = await readdir(migrationsRoot, { withFileTypes: true })
  const migrations = new Map<string, Buffer>()
  for (const entry of entries
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const migrationPath = path.join(migrationsRoot, entry.name, 'migration.sql')
    migrations.set(entry.name, await readFile(migrationPath))
  }
  return migrations
}

export function databaseSsl(
  connectionString: string,
  certificateAuthority?: string,
): false | undefined | { ca: string; rejectUnauthorized: true } {
  const url = new URL(connectionString)
  if (isLoopbackDatabaseUrl(connectionString)) return false

  const sslMode = url.searchParams.get('sslmode')
  const urlSslOptions = databaseSslOptions.filter((option) =>
    url.searchParams.has(option),
  )
  if (certificateAuthority && urlSslOptions.length > 0) {
    throw new Error(
      'Do not combine DIRECT_DATABASE_CA_CERT_PATH with URL-level SSL options.',
    )
  }
  if (certificateAuthority) {
    return { ca: certificateAuthority, rejectUnauthorized: true }
  }
  if (sslMode === 'verify-full' && url.searchParams.has('sslrootcert')) {
    return undefined
  }
  throw new Error(
    'Remote migration history verification requires DIRECT_DATABASE_CA_CERT_PATH.',
  )
}

async function loadDeployedMigrations(
  connectionString: string,
): Promise<DeployedMigration[]> {
  if (isLoopbackDatabaseUrl(connectionString)) {
    return await queryDeployedMigrations(connectionString, false)
  }
  const certificatePath = process.env.DIRECT_DATABASE_CA_CERT_PATH
  const certificateAuthority = certificatePath
    ? await readFile(path.resolve(certificatePath), 'utf8')
    : undefined
  return await queryDeployedMigrations(
    connectionString,
    databaseSsl(connectionString, certificateAuthority),
  )
}

async function queryDeployedMigrations(
  connectionString: string,
  ssl: false | undefined | { ca: string; rejectUnauthorized: true },
): Promise<DeployedMigration[]> {
  const client = new Client({ connectionString, ...(ssl === undefined ? {} : { ssl }) })
  await client.connect()
  try {
    const result = await client.query<DeployedMigration>(deployedMigrationsQuery)
    return result.rows
  } finally {
    await client.end()
  }
}

export function verifyDeployedMigrationHistory(
  deployed: DeployedMigration[],
  migrations: Map<string, Buffer>,
  requireExact: boolean,
): void {
  for (const row of deployed) {
    const bytes = migrations.get(row.migration_name)
    if (!bytes) throw new Error(`Database has unknown migration: ${row.migration_name}`)
    const lf = normalizeLineEndings(bytes.toString('utf8'))
    const accepted = new Set([
      sha256(bytes),
      sha256(lf),
      sha256(lf.replace(/\n/g, '\r\n')),
    ])
    if (!accepted.has(row.checksum)) {
      throw new Error(`Deployed migration checksum differs: ${row.migration_name}`)
    }
  }

  const repositoryNames = [...migrations.keys()].sort()
  const deployedNames = deployed.map((row) => row.migration_name)
  const expectedPrefix = repositoryNames.slice(0, deployedNames.length)
  if (JSON.stringify(deployedNames) !== JSON.stringify(expectedPrefix)) {
    throw new Error(
      'Deployed migration history is not a complete prefix of repository history.',
    )
  }
  if (requireExact && deployed.length !== migrations.size) {
    throw new Error(
      `Exact mode requires exactly ${migrations.size} applied migrations; database has ${deployed.length}.`,
    )
  }
}

async function main(): Promise<void> {
  const migrations = await loadMigrationFiles()
  const baseArgument = process.argv.indexOf('--git-base')
  const pendingDatabase = process.argv.includes('--database-pending')
  const exactDatabase = process.argv.includes('--database-exact')
  if (baseArgument < 0 && !pendingDatabase && !exactDatabase) {
    throw new Error(
      'Migration history verification requires --git-base or a database mode.',
    )
  }
  if (baseArgument >= 0) {
    const baseRef = process.argv[baseArgument + 1]
    if (!baseRef) throw new Error('--git-base requires a Git ref or SHA.')
    verifyBaseMigrationHistory(baseRef)
  }

  if (pendingDatabase || exactDatabase) {
    const connectionString = process.env.DIRECT_URL
    if (!connectionString) throw new Error('DIRECT_URL is required with a database mode.')
    verifyDeployedMigrationHistory(
      await loadDeployedMigrations(connectionString),
      migrations,
      exactDatabase,
    )
  }
  console.log(`Verified ${migrations.size} migrations against authoritative history.`)
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) await main()
