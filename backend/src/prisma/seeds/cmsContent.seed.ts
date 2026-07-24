/**
 * File: backend/src/prisma/seeds/cmsContent.seed.ts
 * Purpose: Seed initial CMS content without replacing existing managed pages.
 * Why: Safe re-runs must never overwrite administrator-edited production content.
 */

import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { basePrisma } from '../client.js'
import type { Prisma } from '../generated.js'
import { parseCmsPageContent } from '../../modules/cms/cms.content.js'
import { CmsPageKeySchema } from '../../modules/cms/cms.schema.js'
import { CMS_PAGES, type CmsSeedPage } from './cmsContent.data.js'

const prisma = basePrisma

export async function createPageIfMissing(
  tx: Prisma.TransactionClient,
  page: CmsSeedPage,
) {
  const pageKey = CmsPageKeySchema.parse(page.pageKey)
  const content = parseCmsPageContent(pageKey, {
    sections: page.sections.map((section) => ({
      ...section,
      isActive: true,
      items: section.items.map((contentItem) => ({
        ...contentItem,
        isActive: true,
      })),
    })),
  })
  const [created] = await tx.cmsPageContent.createManyAndReturn({
    data: [
      {
        pageKey,
        label: page.label,
        isActive: true,
        publishedRevision: 1,
        publishedAt: new Date(),
      },
    ],
    skipDuplicates: true,
    select: { id: true },
  })
  if (!created) {
    return (
      await tx.cmsPageContent.findUniqueOrThrow({
        where: { pageKey },
        select: { id: true },
      })
    ).id
  }

  await tx.cmsPageContent.update({
    where: { id: created.id },
    data: {
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
      revisions: {
        create: {
          revisionNumber: 1,
          contentJson: content as Prisma.InputJsonValue,
          operation: 'publish',
        },
      },
    },
  })

  return created.id
}

export async function seedCmsContent() {
  console.log('Seeding CMS content...')

  const ids: string[] = []
  for (const page of CMS_PAGES) {
    ids.push(await prisma.$transaction((tx) => createPageIfMissing(tx, page)))
  }
  const [homepageId, aboutPageId, contactPageId] = ids

  console.log('✓ CMS content seeded successfully')
  console.log(`  - Homepage: ${homepageId}`)
  console.log(`  - About Page: ${aboutPageId}`)
  console.log(`  - Contact Page: ${contactPageId}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedCmsContent()
    .catch((error) => {
      console.error('Error seeding CMS content:', error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
