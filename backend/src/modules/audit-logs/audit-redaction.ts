/**
 * File: src/modules/audit-logs/audit-redaction.ts
 * Purpose: Classify sensitive audit keys, content fields, and credential values.
 * Why: One semantic boundary prevents representation-specific audit data leaks.
 */
type JsonRecord = Record<string, unknown>

const secretNamePattern =
  /(authorization|codeverifier|cookie|credentials?|hash|oauth|password|privatepem|secret|signature|token)/i
const credentialFamilyPattern =
  /(?:session|jwt|bearer)|auth(?:entication)?(?:context|credential|data|header|id|info|value)?$/
const sensitivePathOrUrlNamePattern =
  /paths?$|(?:file|object|storage).*paths?|(?:presigned|signed).*(?:uri|url)/
const authorizationValuePattern =
  /^\s*(?:(?:basic|bearer|digest|negotiate)|[a-z0-9._~-]*(?:auth|hmac|jwt|key|oauth|signature|token)[a-z0-9._~-]*)\s+\S+/i
const sensitiveUrlParameterNames = new Set(['code', 'sig'])
const sensitiveValueKeyTokens = new Set([
  'body',
  'content',
  'essay',
  'feedback',
  'payload',
  'prompt',
  'response',
  'submission',
  'text',
])
// These exact Phase 5 identifiers are operational labels, never credential keys.
const benignOperationalIdentifierNames = new Set([
  'itemKey',
  'pageKey',
  'sectionKey',
  'widgetKey',
])

function normalizedKeyName(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function keyNameTokens(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((token) => token.toLowerCase())
}

export function isSensitiveKeyName(key: string): boolean {
  if (benignOperationalIdentifierNames.has(key)) {
    return false
  }
  const normalized = normalizedKeyName(key)
  return (
    credentialFamilyPattern.test(normalized) ||
    secretNamePattern.test(normalized) ||
    normalized.includes('key') ||
    sensitivePathOrUrlNamePattern.test(normalized)
  )
}

export function isSensitiveValueKeyName(key: string): boolean {
  return keyNameTokens(key).some((token) => sensitiveValueKeyTokens.has(token))
}

function isSensitiveUrlValue(value: string): boolean {
  try {
    const url = new URL(value)
    const parameterNames = [
      ...url.searchParams.keys(),
      ...new URLSearchParams(url.hash.slice(1)).keys(),
    ]
    return (
      Boolean(url.username || url.password) ||
      parameterNames.some(
        (key) =>
          isSensitiveKeyName(key) ||
          sensitiveUrlParameterNames.has(normalizedKeyName(key)),
      )
    )
  } catch {
    return false
  }
}

export function isSensitiveStringValue(value: string): boolean {
  return authorizationValuePattern.test(value) || isSensitiveUrlValue(value)
}

export function containsSensitiveDescendant(value: unknown): boolean {
  if (typeof value === 'string') {
    return isSensitiveStringValue(value)
  }
  if (Array.isArray(value)) {
    return value.some(containsSensitiveDescendant)
  }
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return false
  }
  return Object.entries(value as JsonRecord).some(
    ([key, nested]) => isSensitiveKeyName(key) || containsSensitiveDescendant(nested),
  )
}
