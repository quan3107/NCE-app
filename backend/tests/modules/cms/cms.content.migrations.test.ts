/**
 * File: tests/modules/cms/cms.content.migrations.test.ts
 * Purpose: Verify production CMS bootstrap rows parse into the public contract.
 * Why: Migration fixtures need coverage without bloating conversion unit tests.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

import { parseCmsPageContent } from '../../../src/modules/cms/cms.content.js'

function readBootstrapPage(migrationName: string) {
  const migration = readFileSync(resolve(
    import.meta.dirname,
    `../../../src/prisma/migrations/${migrationName}/migration.sql`,
  ), 'utf8')
  const sections = new Map<string, {
    sectionKey: string
    label: string
    sortOrder: number
    items: Array<{ itemKey: string; sortOrder: number; contentType: string; contentJson: unknown }>
  }>()
  const itemRow = /\('([^']+)', '([^']+)', (\d+), '([^']+)', \$cms\$([\s\S]*?)\$cms\$::jsonb\)/g

  for (const match of migration.matchAll(itemRow)) {
    const sectionKey = match[1]!
    const savedSection = sections.get(sectionKey) ?? {
      sectionKey, label: sectionKey, sortOrder: sections.size, items: [],
    }
    savedSection.items.push({
      itemKey: match[2]!, sortOrder: Number(match[3]), contentType: match[4]!,
      contentJson: JSON.parse(match[5]!),
    })
    sections.set(sectionKey, savedSection)
  }
  return { sections: [...sections.values()] }
}

it('parses exact homepage and about rows from production bootstrap migrations', () => {
  const homepage = parseCmsPageContent(
    'homepage', readBootstrapPage('20260710110100_bootstrap_cms_homepage'),
  )
  const about = parseCmsPageContent(
    'about', readBootstrapPage('20260710110200_bootstrap_cms_about_page'),
  )

  expect(homepage.stats.map((stat) => stat.itemKey)).toEqual([
    'stat_students', 'stat_band_score', 'stat_success_rate',
  ])
  expect(homepage.howItWorks.features.map((feature) => feature.title)).toEqual([
    'IELTS Practice Tasks', 'Expert Feedback', 'Track Your Progress',
  ])
  expect(about.values.map((value) => value.title)).toEqual([
    'Our Mission', 'Student Success', 'Expert Instructors', 'Proven Results',
  ])
})
