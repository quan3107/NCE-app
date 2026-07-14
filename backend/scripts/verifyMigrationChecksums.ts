/**
 * File: backend/scripts/verifyMigrationChecksums.ts
 * Purpose: Verify normalized migration content and optional deployed Prisma checksums.
 * Why: Line-ending changes must not hide edits to migration files already applied anywhere.
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { Client } from 'pg'

type ChecksumManifest = {
  algorithm: 'sha256'
  lineEndings: 'lf'
  migrations: Record<string, string>
}

type DeployedMigration = {
  migration_name: string
  checksum: string
}

const backendRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(backendRoot, '..')
const migrationsRoot = path.join(backendRoot, 'src', 'prisma', 'migrations')
const manifestPath = path.join(
  backendRoot,
  'src',
  'prisma',
  'applied-migration-checksums.json',
)

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n')
}

async function loadManifest(): Promise<ChecksumManifest> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ChecksumManifest
  if (manifest.algorithm !== 'sha256' || manifest.lineEndings !== 'lf') {
    throw new Error('Migration checksum manifest must use sha256 with LF normalization.')
  }
  return manifest
}

async function loadMigrationFiles(): Promise<Map<string, Buffer>> {
  const entries = await readdir(migrationsRoot, { withFileTypes: true })
  const migrations = new Map<string, Buffer>()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const migrationPath = path.join(migrationsRoot, entry.name, 'migration.sql')
    migrations.set(entry.name, await readFile(migrationPath))
  }
  return migrations
}

function verifyManifest(
  manifest: ChecksumManifest,
  migrations: Map<string, Buffer>,
): void {
  const manifestNames = Object.keys(manifest.migrations).sort()
  const migrationNames = [...migrations.keys()].sort()
  if (JSON.stringify(manifestNames) !== JSON.stringify(migrationNames)) {
    throw new Error(
      'Migration checksum manifest entries do not match migration directories.',
    )
  }

  for (const [name, bytes] of migrations) {
    const normalizedChecksum = sha256(normalizeLineEndings(bytes.toString('utf8')))
    if (normalizedChecksum !== manifest.migrations[name]) {
      throw new Error(`Applied migration content changed: ${name}`)
    }
  }
}

function verifyBaseHistory(baseRef: string): void {
  const migrationPath = 'backend/src/prisma/migrations'
  const output = execFileSync(
    'git',
    ['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`, '--', migrationPath],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )

  const changedHistory = output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.startsWith('A\t'))

  if (changedHistory.length > 0) {
    throw new Error(
      `Existing migration history changed relative to ${baseRef}:\n${changedHistory.join('\n')}`,
    )
  }
}

function databaseSsl(connectionString: string): false | { rejectUnauthorized: false } {
  const host = new URL(connectionString).hostname
  return host === 'localhost' || host === '127.0.0.1'
    ? false
    : { rejectUnauthorized: false }
}

async function loadDeployedMigrations(
  connectionString: string,
): Promise<DeployedMigration[]> {
  const client = new Client({
    connectionString,
    ssl: databaseSsl(connectionString),
  })
  await client.connect()
  try {
    const result = await client.query<DeployedMigration>(`
      SELECT DISTINCT ON (migration_name) migration_name, checksum
      FROM public._prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name, finished_at DESC
    `)
    return result.rows
  } finally {
    await client.end()
  }
}

function verifyDeployedChecksums(
  deployed: DeployedMigration[],
  migrations: Map<string, Buffer>,
): void {
  if (deployed.length !== migrations.size) {
    throw new Error(
      `Database has ${deployed.length} applied migrations; repository has ${migrations.size}.`,
    )
  }

  for (const row of deployed) {
    const bytes = migrations.get(row.migration_name)
    if (!bytes) throw new Error(`Database has unknown migration: ${row.migration_name}`)

    const text = bytes.toString('utf8')
    const lf = normalizeLineEndings(text)
    const accepted = new Set([
      sha256(bytes),
      sha256(lf),
      sha256(lf.replace(/\n/g, '\r\n')),
    ])
    if (!accepted.has(row.checksum)) {
      throw new Error(`Deployed migration checksum differs: ${row.migration_name}`)
    }
  }
}

async function main(): Promise<void> {
  const manifest = await loadManifest()
  const migrations = await loadMigrationFiles()
  verifyManifest(manifest, migrations)

  const baseArgument = process.argv.indexOf('--git-base')
  if (baseArgument >= 0) {
    const baseRef = process.argv[baseArgument + 1]
    if (!baseRef) throw new Error('--git-base requires a Git ref or SHA.')
    verifyBaseHistory(baseRef)
  }

  if (process.argv.includes('--database')) {
    const connectionString = process.env.DIRECT_URL
    if (!connectionString) throw new Error('DIRECT_URL is required with --database.')
    verifyDeployedChecksums(await loadDeployedMigrations(connectionString), migrations)
  }

  console.log(`Verified ${migrations.size} normalized migration checksums.`)
}

await main()
