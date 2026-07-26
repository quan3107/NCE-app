/**
 * File: src/utils/semanticValue.ts
 * Purpose: Compare persisted values by normalized semantic content.
 * Why: Request presence, object key order, and storage wrappers do not imply a real mutation.
 */

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (value && typeof value === 'object') {
    const toJSON = (value as { toJSON?: () => unknown }).toJSON
    if (typeof toJSON === 'function') {
      return canonicalize(toJSON.call(value))
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value ?? null
}

export function semanticValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
}
