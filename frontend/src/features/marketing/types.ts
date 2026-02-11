/**
 * Location: frontend/src/features/marketing/types.ts
 * Purpose: TypeScript types for CMS/marketing content
 * Why: Type safety for API responses and component props
 */

import type {
  CmsAboutHeroContent as BackendAboutHeroContent,
  CmsAboutPageContent as BackendAboutPageContent,
  CmsFeatureItem as BackendFeatureItem,
  CmsHeroContent as BackendHeroContent,
  CmsHomepageContent as BackendHomepageContent,
  CmsHowItWorksContent as BackendHowItWorksContent,
  CmsStatItem as BackendStatItem,
  CmsValueItem as BackendValueItem,
} from '@lib/backend-schema';

export type HeroContent = BackendHeroContent;
export type StatItem = BackendStatItem;
export type FeatureItem = BackendFeatureItem;
export type HowItWorksContent = BackendHowItWorksContent;
export type HomepageContent = BackendHomepageContent;
export type AboutHeroContent = BackendAboutHeroContent;
export type ValueItem = BackendValueItem;
export type AboutPageContent = BackendAboutPageContent;
