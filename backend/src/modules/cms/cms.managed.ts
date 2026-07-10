/**
 * Location: backend/src/modules/cms/cms.managed.ts
 * Purpose: Identify item keys owned by each modeled CMS section.
 * Why: Parsing and persistence must agree on which rows belong to the editor model.
 */
import type { CmsPageKey } from './cms.schema.js'

const managedItemPatterns: Record<CmsPageKey, Record<string, RegExp>> = {
  homepage: {
    hero: /^hero_main$/,
    stats: /^stat_(students|band_score|success_rate|\d+)$/,
    features: /^(section_meta|feature_(practice|feedback|progress|\d+))$/,
  },
  about: {
    hero: /^hero_main$/,
    values: /^value_(mission|success|instructors|results|\d+)$/,
    story: /^story_p\d+$/,
  },
  contact: {
    header: /^header_main$/,
    form: /^form_main$/,
    details: /^details_main$/,
    hours: /^hours_\d+$/,
  },
}

export function isManagedCmsItemKey(
  pageKey: CmsPageKey,
  sectionKey: string,
  itemKey: string | null | undefined,
) {
  return (
    typeof itemKey === 'string' &&
    Boolean(managedItemPatterns[pageKey][sectionKey]?.test(itemKey))
  )
}
