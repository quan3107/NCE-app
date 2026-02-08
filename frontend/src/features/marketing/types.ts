/**
 * Location: frontend/src/features/marketing/types.ts
 * Purpose: TypeScript types for CMS/marketing content
 * Why: Type safety for API responses and component props
 */

export type HeroContent = {
  badge: string;
  title: string;
  description: string;
  cta_primary: string;
  cta_secondary: string;
}

export type StatItem = {
  label: string;
  value: number;
  format: 'number' | 'decimal' | 'percentage';
  suffix?: string;
}

export type FeatureItem = {
  icon: string;
  title: string;
  description: string;
}

export type HowItWorksContent = {
  title: string;
  description: string;
  features: FeatureItem[];
}

export type HomepageContent = {
  hero: HeroContent;
  stats: StatItem[];
  howItWorks: HowItWorksContent;
}

export type AboutHeroContent = {
  title: string;
  description: string;
}

export type ValueItem = {
  icon: string;
  title: string;
  description: string;
}

export type AboutPageContent = {
  hero: AboutHeroContent;
  values: ValueItem[];
  story: {
    sections: string[];
  };
}
