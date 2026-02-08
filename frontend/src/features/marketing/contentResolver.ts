/**
 * Location: frontend/src/features/marketing/contentResolver.ts
 * Purpose: Resolve live CMS data with deterministic fallback behavior and diagnostics.
 * Why: Keeps route components simple while guaranteeing usable marketing content.
 */

import {
  fallbackAboutPageContent,
  fallbackHomepageContent,
} from './fallback'
import type { AboutPageContent, HomepageContent } from './types'

const LOG_PREFIX = '[marketing-cms]'
const emittedFallbackWarnings = new Set<string>()

const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { message: String(error ?? 'unknown_error') }
}

export function resolveHomepageContent(
  data: HomepageContent | undefined,
  error: unknown,
  shouldLogFallback = true,
): HomepageContent {
  if (data) {
    emittedFallbackWarnings.delete('/api/v1/cms/homepage-content:query_error')
    emittedFallbackWarnings.delete('/api/v1/cms/homepage-content:empty_payload')
    return data
  }

  if (shouldLogFallback) {
    const endpoint = '/api/v1/cms/homepage-content'
    const reason = error ? 'query_error' : 'empty_payload'
    const warningKey = `${endpoint}:${reason}`
    if (!emittedFallbackWarnings.has(warningKey)) {
      emittedFallbackWarnings.add(warningKey)
      console.warn(`${LOG_PREFIX} Falling back to homepage static content.`, {
        endpoint,
        reason,
        error: describeError(error),
      })
    }
  }

  return fallbackHomepageContent
}

export function resolveAboutPageContent(
  data: AboutPageContent | undefined,
  error: unknown,
  shouldLogFallback = true,
): AboutPageContent {
  if (data) {
    emittedFallbackWarnings.delete('/api/v1/cms/about-page-content:query_error')
    emittedFallbackWarnings.delete('/api/v1/cms/about-page-content:empty_payload')
    return data
  }

  if (shouldLogFallback) {
    const endpoint = '/api/v1/cms/about-page-content'
    const reason = error ? 'query_error' : 'empty_payload'
    const warningKey = `${endpoint}:${reason}`
    if (!emittedFallbackWarnings.has(warningKey)) {
      emittedFallbackWarnings.add(warningKey)
      console.warn(`${LOG_PREFIX} Falling back to about static content.`, {
        endpoint,
        reason,
        error: describeError(error),
      })
    }
  }

  return fallbackAboutPageContent
}
