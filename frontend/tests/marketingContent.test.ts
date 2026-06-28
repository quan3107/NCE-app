/// <reference lib="dom" />
/**
 * Location: tests/marketingContent.test.ts
 * Purpose: Validate CMS marketing formatting and server-data-only route wiring.
 * Why: Prevents regressions that reintroduce client-side fallback marketing content.
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { isValidElement } from 'react'

import { formatStatValue } from '../src/components/marketing/StatsOverview'
import { getIconComponent } from '../src/features/marketing/iconMap'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const homeRoutePath = path.join(frontendRoot, 'src/routes/Home.tsx')
const aboutRoutePath = path.join(frontendRoot, 'src/routes/About.tsx')

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

test('marketing routes render server errors instead of fallback content', async () => {
  const homeSource = await readFile(homeRoutePath, 'utf8')
  const aboutSource = await readFile(aboutRoutePath, 'utf8')

  assert.doesNotMatch(homeSource, /resolveHomepageContent|fallbackHomepageContent/)
  assert.doesNotMatch(aboutSource, /resolveAboutPageContent|fallbackAboutPageContent/)
  assert.match(homeSource, /homepageQuery\.error/)
  assert.match(aboutSource, /aboutQuery\.error/)
  assert.match(homeSource, /Unable to load homepage content/)
  assert.match(aboutSource, /Unable to load about page content/)
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
