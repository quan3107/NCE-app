/**
 * File: src/databaseConnectionPolicy.ts
 * Purpose: Classify owner database URLs and reject ambiguous remote TLS settings.
 * Why: Runtime and owner scripts must share one privileged connection boundary.
 */

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const databaseSslOptions = [
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'sslidentity',
  'sslpassword',
  'sslaccept',
] as const

export function isLoopbackDatabaseUrl(connectionString: string): boolean {
  const url = new URL(connectionString)
  if (url.searchParams.has('host')) return false

  return loopbackHosts.has(url.hostname.toLowerCase())
}

export function assertUnconfiguredRemoteSsl(url: URL): void {
  const configuredOptions = databaseSslOptions.filter((option) =>
    url.searchParams.has(option),
  )
  if (configuredOptions.length > 0) {
    throw new Error(
      `Remote DIRECT_URL must not set SSL options; configure DIRECT_DATABASE_CA_CERT_PATH instead: ${configuredOptions.join(', ')}.`,
    )
  }
}
