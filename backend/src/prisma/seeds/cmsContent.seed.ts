/**
 * File: backend/src/prisma/seeds/cmsContent.seed.ts
 * Purpose: Seed CMS content for homepage and about pages in an idempotent way.
 * Why: Allows safe re-runs while keeping marketing content as backend-managed data.
 */

import { basePrisma } from '../client.js'
import type { Prisma } from '../generated.js'
import { CMS_PAGES, type CmsSeedPage } from './cmsContent.data.js'

const prisma = basePrisma

async function replacePageContent(page: CmsSeedPage) {
  const pageRecord = await prisma.cmsPageContent.upsert({
    where: { pageKey: page.pageKey },
    create: {
      pageKey: page.pageKey,
      label: page.label,
      isActive: true,
    },
    update: {
      label: page.label,
      isActive: true,
    },
  })

  await prisma.cmsSection.deleteMany({
    where: { pageId: pageRecord.id },
  })

  for (const section of page.sections) {
    await prisma.cmsSection.create({
      data: {
        pageId: pageRecord.id,
        sectionKey: section.sectionKey,
        label: section.label,
        sortOrder: section.sortOrder,
        isActive: true,
        items: {
          create: section.items.map((item) => ({
            itemKey: item.itemKey,
            sortOrder: item.sortOrder,
            contentType: item.contentType,
            contentJson: item.contentJson as Prisma.InputJsonValue,
            isActive: true,
          })),
        },
      },
    })
  }

  return pageRecord.id
}

async function seedCmsContent() {
  console.log('Seeding CMS content...')

  const [homepageId, aboutPageId] = await prisma.$transaction(async () => {
    const ids: string[] = []
    for (const page of CMS_PAGES) {
      ids.push(await replacePageContent(page))
    }
    return ids
  })

  console.log('✓ CMS content seeded successfully')
  console.log(`  - Homepage: ${homepageId}`)
  console.log(`  - About Page: ${aboutPageId}`)
}

seedCmsContent()
  .catch((error) => {
    console.error('Error seeding CMS content:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
