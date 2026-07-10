/**
 * Location: backend/src/modules/cms/cms.schema.ts
 * Purpose: Define runtime validation and TypeScript types for CMS marketing payloads.
 * Why: Keeps API responses and DB JSON content aligned and safe to parse.
 */

import { z } from 'zod'

const requiredText = z.string().trim().min(1)

export const HeroContentSchema = z.object({
  badge: requiredText,
  title: requiredText,
  description: requiredText,
  cta_primary: requiredText,
  cta_secondary: requiredText,
})

export const StatItemSchema = z.object({
  label: requiredText,
  value: z.number(),
  format: z.enum(['number', 'decimal', 'percentage']),
  suffix: z.string().trim().optional(),
})

export const FeatureItemSchema = z.object({
  icon: requiredText,
  title: requiredText,
  description: requiredText,
})

export const HowItWorksMetaSchema = z.object({
  title: requiredText.optional(),
  description: requiredText,
})

export const HowItWorksContentSchema = z.object({
  title: requiredText,
  description: requiredText,
  features: z.array(FeatureItemSchema),
})

export const AboutHeroContentSchema = z.object({
  title: requiredText,
  description: requiredText,
})

export const ValueItemSchema = z.object({
  icon: requiredText,
  title: requiredText,
  description: requiredText,
})

export const StoryParagraphSchema = z.object({
  text: requiredText,
})

export const HomepageContentSchema = z.object({
  hero: HeroContentSchema,
  stats: z.array(StatItemSchema),
  howItWorks: HowItWorksContentSchema,
})

export const AboutPageContentSchema = z.object({
  hero: AboutHeroContentSchema,
  values: z.array(ValueItemSchema),
  story: z.object({
    sections: z.array(requiredText),
  }),
})

export const ContactPageContentSchema = z.object({
  header: z.object({
    title: requiredText,
    description: requiredText,
  }),
  form: z.object({
    title: requiredText,
    description: requiredText,
    submitLabel: requiredText,
  }),
  details: z.object({
    email: z.string().trim().email(),
    phone: requiredText,
    address: requiredText,
  }),
  hours: z.array(
    z.object({
      label: requiredText,
      value: requiredText,
    }),
  ),
})

export const CmsPageKeySchema = z.enum(['homepage', 'about', 'contact'])

export const CmsDraftUpdateSchema = z.object({
  content: z.unknown(),
  expectedDraftVersion: z.number().int().nonnegative(),
}).strict()

export const CmsPublishSchema = z.object({
  content: z.unknown(),
  expectedDraftVersion: z.number().int().nonnegative(),
}).strict()

export const CmsRevisionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
}).strict()

export const CmsRollbackParamsSchema = z.object({
  pageKey: CmsPageKeySchema,
  revisionId: z.string().uuid(),
}).strict()

export const CmsRollbackSchema = z.object({
  expectedDraftVersion: z.number().int().nonnegative(),
}).strict()

export type HeroContent = z.infer<typeof HeroContentSchema>
export type StatItem = z.infer<typeof StatItemSchema>
export type FeatureItem = z.infer<typeof FeatureItemSchema>
export type HowItWorksMeta = z.infer<typeof HowItWorksMetaSchema>
export type HowItWorksContent = z.infer<typeof HowItWorksContentSchema>
export type AboutHeroContent = z.infer<typeof AboutHeroContentSchema>
export type ValueItem = z.infer<typeof ValueItemSchema>
export type StoryParagraph = z.infer<typeof StoryParagraphSchema>
export type HomepageContent = z.infer<typeof HomepageContentSchema>
export type AboutPageContent = z.infer<typeof AboutPageContentSchema>
export type ContactPageContent = z.infer<typeof ContactPageContentSchema>
export type CmsPageKey = z.infer<typeof CmsPageKeySchema>
export type CmsPageContent =
  | HomepageContent
  | AboutPageContent
  | ContactPageContent
