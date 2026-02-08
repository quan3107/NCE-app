/// <reference lib="dom" />
/**
 * Location: tests/marketingContent.test.ts
 * Purpose: Validate CMS marketing formatting, fallback resolution, and icon mapping behavior.
 * Why: Prevents regressions in public route resilience and user-visible stat rendering.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidElement } from 'react'

import { formatStatValue } from '../src/components/marketing/StatsOverview'
import {
  resolveAboutPageContent,
  resolveHomepageContent,
} from '../src/features/marketing/contentResolver'
import {
  fallbackAboutPageContent,
  fallbackHomepageContent,
} from '../src/features/marketing/fallback'
import { getIconComponent } from '../src/features/marketing/iconMap'

test('formatStatValue renders CMS number formats correctly', () => {
  assert.equal(
    formatStatValue({ label: 'Active Students', value: 500, format: 'number', suffix: '+' }),
    '500+',
  )
  assert.equal(
    formatStatValue({ label: 'Average Band Score', value: 7.53, format: 'decimal' }),
    '7.5',
  )
  assert.equal(
    formatStatValue({ label: 'Success Rate', value: 0.923, format: 'percentage' }),
    '92%',
  )
})

test('resolveHomepageContent falls back and logs details when query errors', () => {
  const originalWarn = console.warn
  const warnings: unknown[][] = []
  console.warn = (...args: unknown[]) => {
    warnings.push(args)
  }

  try {
    const resolved = resolveHomepageContent(undefined, new Error('cms unavailable'))
    assert.deepEqual(resolved, fallbackHomepageContent)
    assert.equal(warnings.length, 1)
    assert.match(String(warnings[0][0]), /Falling back to homepage static content/)
    assert.equal((warnings[0][1] as Record<string, unknown>).reason, 'query_error')
  } finally {
    console.warn = originalWarn
  }
})

test('resolveAboutPageContent can use fallback silently during initial loading', () => {
  const originalWarn = console.warn
  let warnCalls = 0
  console.warn = () => {
    warnCalls += 1
  }

  try {
    const resolved = resolveAboutPageContent(undefined, null, false)
    assert.deepEqual(resolved, fallbackAboutPageContent)
    assert.equal(warnCalls, 0)
  } finally {
    console.warn = originalWarn
  }
})

test('getIconComponent returns mapped icons and warns on unknown names', () => {
  const mappedIcon = getIconComponent('book-open', 'size-6')
  assert.equal(isValidElement(mappedIcon), true)

  const originalWarn = console.warn
  let warned = false
  console.warn = () => {
    warned = true
  }
  try {
    const missingIcon = getIconComponent('missing-icon')
    assert.equal(missingIcon, null)
    assert.equal(warned, true)
  } finally {
    console.warn = originalWarn
  }
})
