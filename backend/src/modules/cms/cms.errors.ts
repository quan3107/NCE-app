/**
 * Location: src/modules/cms/cms.errors.ts
 * Purpose: Identify invalid persisted CMS content as an internal server failure.
 * Why: Stored-data corruption must not be reported as invalid client input.
 */
import type { CmsPageKey } from './cms.schema.js'

export class StoredCmsContentError extends Error {
  readonly statusCode = 500
  readonly expose = false

  constructor(pageKey: CmsPageKey, cause: unknown) {
    super(`Stored CMS content failed validation for ${pageKey}.`, { cause })
    this.name = 'StoredCmsContentError'
  }
}
