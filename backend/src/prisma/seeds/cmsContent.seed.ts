/**
 * File: backend/src/prisma/seeds/cmsContent.seed.ts
 * Purpose: Seed initial CMS content without replacing existing managed pages.
 * Why: Safe re-runs must never overwrite administrator-edited production content.
 */

import { basePrisma } from '../client.js'
import type { Prisma } from '../generated.js'
import { CMS_PAGES, type CmsSeedPage } from './cmsContent.data.js'

const prisma = basePrisma

async function createPageIfMissing(page: CmsSeedPage) {
  const existing = await prisma.cmsPageContent.findUnique({
    where: { pageKey: page.pageKey },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.cmsPageContent.create({
    data: {
      pageKey: page.pageKey,
      label: page.label,
      isActive: true,
      publishedAt: new Date(),
      sections: {
        create: page.sections.map((section) => ({
          sectionKey: section.sectionKey,
          label: section.label,
          sortOrder: section.sortOrder,
          isActive: true,
          items: {
            create: section.items.map((contentItem) => ({
              itemKey: contentItem.itemKey,
              sortOrder: contentItem.sortOrder,
              contentType: contentItem.contentType,
              contentJson: contentItem.contentJson as Prisma.InputJsonValue,
              isActive: true,
            })),
          },
        })),
      },
    },
  })

  return created.id
}

async function seedCmsContent() {
  console.log('Seeding CMS content...')

  const ids: string[] = []
  for (const page of CMS_PAGES) ids.push(await createPageIfMissing(page))
  const [homepageId, aboutPageId, contactPageId] = ids

  console.log('✓ CMS content seeded successfully')
  console.log(`  - Homepage: ${homepageId}`)
  console.log(`  - About Page: ${aboutPageId}`)
  console.log(`  - Contact Page: ${contactPageId}`)
}

seedCmsContent()
  .catch((error) => {
    console.error('Error seeding CMS content:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
