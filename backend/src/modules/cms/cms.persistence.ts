/**
 * Location: backend/src/modules/cms/cms.persistence.ts
 * Purpose: Replace normalized published CMS sections inside an existing transaction.
 * Why: Publish and rollback require the same atomic persistence sequence.
 */
import { Prisma } from '../../prisma/generated.js'
import { toCmsSectionsCreateInput } from './cms.content.js'
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
  await tx.cmsSection.deleteMany({ where: { pageId } })
  for (const section of toCmsSectionsCreateInput(pageKey, content)) {
    await tx.cmsSection.create({
      data: {
        pageId,
        sectionKey: section.sectionKey,
        label: section.label,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
        items: {
          create: section.items.create.map((item) => ({
            ...item,
            contentJson: item.contentJson as Prisma.InputJsonValue,
          })),
        },
      },
    })
  }
}
