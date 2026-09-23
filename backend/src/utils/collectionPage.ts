/**
 * Location: src/utils/collectionPage.ts
 * Purpose: Validate and shape bounded cursor pages for collection reads.
 * Why: Assignment and submission lists must scale with page size, not route count.
 */
import { z } from 'zod'

export const collectionPageQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict()

export function collectionPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit)
  return {
    items,
    nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
  }
}
