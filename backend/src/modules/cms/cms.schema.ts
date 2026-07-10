/**
 * Location: backend/src/modules/cms/cms.schema.ts
 * Purpose: Define runtime validation and TypeScript types for CMS marketing payloads.
 * Why: Keeps API responses and DB JSON content aligned and safe to parse.
 */

import { z } from 'zod'

export const HeroContentSchema = z.object({
  badge: z.string(),
  title: z.string(),
  description: z.string(),
  cta_primary: z.string(),
  cta_secondary: z.string(),
})

export const StatItemSchema = z.object({
  label: z.string(),
  value: z.number(),
  format: z.enum(['number', 'decimal', 'percentage']),
  suffix: z.string().optional(),
})

export const FeatureItemSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
})

export const HowItWorksMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string(),
})

export const HowItWorksContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  features: z.array(FeatureItemSchema),
})

export const AboutHeroContentSchema = z.object({
  title: z.string(),
  description: z.string(),
})

export const ValueItemSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
})

export const StoryParagraphSchema = z.object({
  text: z.string(),
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
    sections: z.array(z.string()),
  }),
})

export const ContactPageContentSchema = z.object({
  header: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
  }),
  form: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    submitLabel: z.string().min(1),
  }),
  details: z.object({
    email: z.string().email(),
    phone: z.string().min(1),
    address: z.string().min(1),
  }),
  hours: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1),
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
