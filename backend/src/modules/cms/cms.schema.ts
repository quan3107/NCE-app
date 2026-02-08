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
