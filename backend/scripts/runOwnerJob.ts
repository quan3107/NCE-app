/**
 * File: scripts/runOwnerJob.ts
 * Purpose: Run approved database-owner tools with a short-lived child environment.
 * Why: Local migrations and seeds need .env.local without exposing DIRECT_URL to runtime.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'dotenv'

import {
  assertUnconfiguredRemoteSsl,
  isLoopbackDatabaseUrl,
} from './databaseConnectionPolicy.js'

const require = createRequire(import.meta.url)
const scriptPath = fileURLToPath(import.meta.url)
const backendDir = resolve(dirname(scriptPath), '..')
const supportedTools = new Set(['prisma', 'tsx'])

type OwnerEnvironment = NodeJS.ProcessEnv

type OwnerConfig = {
  databaseUrl: string
  certificateAuthorityPath?: string
}

type OwnerTool = 'prisma' | 'tsx'

function assertDirectOwnerEndpoint(url: URL): void {
  if (!url.username || url.pathname.length <= 1) {
    throw new Error('Owner DIRECT_URL must include an explicit user and database.')
  }

  const configuredOverrides = ['host', 'port'].filter((parameter) =>
    url.searchParams.has(parameter),
  )
  if (configuredOverrides.length > 0) {
    throw new Error(
      `Owner DIRECT_URL must not set host or port query overrides: ${configuredOverrides.join(', ')}.`,
    )
  }

  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '')
  const isSupabasePooler = hostname.endsWith('.pooler.supabase.com')
  const isSupabaseDirectHost =
    hostname.startsWith('db.') && hostname.endsWith('.supabase.co')
  const usesUnsupportedDirectPort =
    isSupabaseDirectHost && url.port !== '' && url.port !== '5432'

  if (isSupabasePooler || usesUnsupportedDirectPort) {
    throw new Error(
      'Owner jobs require the direct Supabase database endpoint on port 5432; pooler endpoints are not allowed.',
    )
  }
}

export async function loadOwnerConfig(
  directory = backendDir,
  inheritedEnvironment: OwnerEnvironment = process.env,
): Promise<OwnerConfig> {
  const injectedUrl = inheritedEnvironment.DIRECT_URL?.trim()
  const injectedCertificatePath =
    inheritedEnvironment.DIRECT_DATABASE_CA_CERT_PATH?.trim()
  if (injectedUrl) {
    return {
      databaseUrl: injectedUrl,
      ...(injectedCertificatePath
        ? { certificateAuthorityPath: injectedCertificatePath }
        : {}),
    }
  }

  const ownerEnvPath = resolve(directory, '.env.local')
  let ownerEnvSource: string
  try {
    ownerEnvSource = await readFile(ownerEnvPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    throw new Error(
      'Owner database URL is missing. Copy .env.local.example to .env.local and set DIRECT_URL.',
    )
  }

  const ownerEnvironment = parse(ownerEnvSource)
  const ownerDatabaseUrl = ownerEnvironment.DIRECT_URL?.trim()
  if (!ownerDatabaseUrl) {
    throw new Error(
      'Owner database URL is missing. Set DIRECT_URL in backend/.env.local.',
    )
  }
  const certificateAuthorityPath =
    injectedCertificatePath || ownerEnvironment.DIRECT_DATABASE_CA_CERT_PATH?.trim()
  return {
    databaseUrl: ownerDatabaseUrl,
    ...(certificateAuthorityPath ? { certificateAuthorityPath } : {}),
  }
}

export async function loadOwnerDatabaseUrl(
  directory = backendDir,
  inheritedEnvironment: OwnerEnvironment = process.env,
) {
  return (await loadOwnerConfig(directory, inheritedEnvironment)).databaseUrl
}

export function buildOwnerJobEnvironment(
  inheritedEnvironment: OwnerEnvironment,
  ownerDatabaseUrl: string,
  certificateAuthorityPath?: string,
  tool: OwnerTool = 'tsx',
): OwnerEnvironment {
  const {
    DIRECT_DATABASE_CA_CERT_PATH: ignoredCertificatePath,
    NODE_TLS_REJECT_UNAUTHORIZED: ignoredTlsValidationOverride,
    PGDATABASE: ignoredPgDatabase,
    PGHOST: ignoredPgHost,
    PGPASSWORD: ignoredPgPassword,
    PGPORT: ignoredPgPort,
    PGUSER: ignoredPgUser,
    ...childEnvironment
  } = inheritedEnvironment
  const connectionUrl = buildOwnerConnectionUrl(
    ownerDatabaseUrl,
    certificateAuthorityPath,
    tool,
  )
  return {
    ...childEnvironment,
    DATABASE_URL: connectionUrl,
    DIRECT_URL: connectionUrl,
  }
}

export function buildOwnerConnectionUrl(
  ownerDatabaseUrl: string,
  certificateAuthorityPath: string | undefined,
  tool: OwnerTool,
): string {
  const url = new URL(ownerDatabaseUrl)
  assertDirectOwnerEndpoint(url)
  if (isLoopbackDatabaseUrl(ownerDatabaseUrl)) return ownerDatabaseUrl

  assertUnconfiguredRemoteSsl(url)
  if (!certificateAuthorityPath) {
    throw new Error(
      'Remote owner jobs require DIRECT_DATABASE_CA_CERT_PATH for authenticated TLS.',
    )
  }

  if (tool === 'prisma') {
    // Prisma requires its strict flag in addition to requiring TLS and the root CA.
    url.searchParams.set('sslcert', resolve(certificateAuthorityPath))
    url.searchParams.set('sslmode', 'require')
    url.searchParams.set('sslaccept', 'strict')
  } else {
    // node-postgres explicitly preserves CA and hostname verification in verify-full.
    url.searchParams.set('sslrootcert', resolve(certificateAuthorityPath))
    url.searchParams.set('sslmode', 'verify-full')
  }
  return url.toString()
}

function resolveToolEntrypoint(tool: string) {
  if (!supportedTools.has(tool)) {
    throw new Error(`Unsupported owner job tool: ${tool || '(missing)'}.`)
  }
  const packageName = tool === 'prisma' ? 'prisma' : 'tsx'
  const packagePath = require.resolve(`${packageName}/package.json`)
  const packageJson = require(packagePath) as {
    bin: string | Record<string, string>
  }
  const relativeEntrypoint =
    typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin[tool]
  if (!relativeEntrypoint) throw new Error(`Unable to resolve the ${tool} executable.`)
  return resolve(dirname(packagePath), relativeEntrypoint)
}

export async function runOwnerJob(args = process.argv.slice(2)) {
  const [tool, ...toolArgs] = args
  const ownerConfig = await loadOwnerConfig()
  const childEnvironment = buildOwnerJobEnvironment(
    process.env,
    ownerConfig.databaseUrl,
    ownerConfig.certificateAuthorityPath,
    tool as OwnerTool,
  )
  const entrypoint = resolveToolEntrypoint(tool ?? '')

  return await new Promise<number>((resolveExit, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...toolArgs], {
      cwd: backendDir,
      env: childEnvironment,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Owner job terminated by signal ${signal}.`))
        return
      }
      resolveExit(code ?? 1)
    })
  })
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    process.exitCode = await runOwnerJob()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
