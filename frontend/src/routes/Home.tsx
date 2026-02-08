/**
 * Location: src/routes/Home.tsx
 * Purpose: Render the marketing home route with CMS-driven content and safe fallback.
 * Why: Prevents hardcoded copy drift while keeping the public route resilient to API issues.
 */

import { CallToAction } from '@components/marketing/CallToAction'
import { FeaturedCourses } from '@components/marketing/FeaturedCourses'
import { HeroSection } from '@components/marketing/HeroSection'
import { HowItWorks } from '@components/marketing/HowItWorks'
import { useHomepageContentQuery } from '@features/marketing/api'
import { resolveHomepageContent } from '@features/marketing/contentResolver'
import { getIconComponent } from '@features/marketing/iconMap'
import { useRouter } from '@lib/router'

export function HomeRoute() {
  const { navigate } = useRouter()
  const homepageQuery = useHomepageContentQuery()
  const content = resolveHomepageContent(
    homepageQuery.data,
    homepageQuery.error,
    !homepageQuery.isLoading,
  )

  const features = content.howItWorks.features.map((feature) => ({
    ...feature,
    icon: getIconComponent(feature.icon, 'size-6 text-primary'),
  }))

  return (
    <div>
      <HeroSection
        badge={content.hero.badge}
        title={content.hero.title}
        description={content.hero.description}
        ctaPrimary={content.hero.cta_primary}
        ctaSecondary={content.hero.cta_secondary}
        stats={content.stats}
        onViewCourses={() => navigate('/courses')}
        onTeacherLogin={() => navigate('/login')}
      />
      <HowItWorks
        sectionTitle={content.howItWorks.title}
        sectionDescription={content.howItWorks.description}
        features={features}
      />
      <FeaturedCourses
        onSelectCourse={(courseId) => navigate(`/courses/${courseId}`)}
        onViewAll={() => navigate('/courses')}
      />
      <CallToAction
        onCreateAccount={() => navigate('/login')}
        onContact={() => navigate('/contact')}
      />
    </div>
  )
}
