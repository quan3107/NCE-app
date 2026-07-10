/**
 * Location: backend/src/modules/cms/cms.persistence.ts
 * Purpose: Reconcile normalized published CMS rows inside an existing transaction.
 * Why: Publish and rollback must update modeled rows without deleting custom content.
 */
import { Prisma } from '../../prisma/generated.js'
import { toCmsSectionsCreateInput } from './cms.content.js'
import { isManagedCmsItemKey } from './cms.managed.js'
import type { CmsPageContent, CmsPageKey } from './cms.schema.js'

export async function lockCmsPageByKey(
  tx: Prisma.TransactionClient,
  pageKey: CmsPageKey,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM public.cms_page_contents
    WHERE page_key = ${pageKey}
    FOR UPDATE
  `)
  return rows[0]?.id ?? null
}

export async function replacePublishedSections(
  tx: Prisma.TransactionClient,
  pageId: string,
  pageKey: CmsPageKey,
  content: CmsPageContent,
) {
  const managedSections = toCmsSectionsCreateInput(pageKey, content)
  for (const section of managedSections) {
    const savedSection = await tx.cmsSection.upsert({
      where: {
        pageId_sectionKey: { pageId, sectionKey: section.sectionKey },
      },
      create: {
        pageId,
        sectionKey: section.sectionKey,
        label: section.label,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
      },
      update: {
        label: section.label,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
      },
    })
    const existingItems = await tx.cmsContentItem.findMany({
      where: { sectionId: savedSection.id },
      select: { id: true, itemKey: true, isActive: true },
    })
    const replaceableItems = existingItems.filter((item) =>
      item.isActive && isManagedCmsItemKey(pageKey, section.sectionKey, item.itemKey),
    )

    for (const item of section.items.create) {
      if (!item.itemKey) throw new Error('Managed CMS item key is required')
      const existingIndex = replaceableItems.findIndex(
        (candidate) => candidate.itemKey === item.itemKey,
      )
      const data = {
        itemKey: item.itemKey,
        sortOrder: item.sortOrder,
        contentType: item.contentType,
        contentJson: item.contentJson as Prisma.InputJsonValue,
        isActive: item.isActive,
      }
      if (existingIndex >= 0) {
        const [existing] = replaceableItems.splice(existingIndex, 1)
        await tx.cmsContentItem.update({ where: { id: existing.id }, data })
      } else {
        await tx.cmsContentItem.create({
          data: { sectionId: savedSection.id, ...data },
        })
      }
    }

    if (replaceableItems.length > 0) {
      await tx.cmsContentItem.deleteMany({
        where: { id: { in: replaceableItems.map((item) => item.id) } },
      })
    }
  }
}
