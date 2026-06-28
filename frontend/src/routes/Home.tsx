/**
 * Location: src/routes/Home.tsx
 * Purpose: Render the marketing home route with CMS-driven content.
 * Why: Keeps public content server-sourced and surfaces CMS/API failures directly.
 */

import { CallToAction } from '@components/marketing/CallToAction'
import { FeaturedCourses } from '@components/marketing/FeaturedCourses'
import { HeroSection } from '@components/marketing/HeroSection'
import { HowItWorks } from '@components/marketing/HowItWorks'
import { useHomepageContentQuery } from '@features/marketing/api'
import { getIconComponent } from '@features/marketing/iconMap'
import { useRouter } from '@lib/router'

export function HomeRoute() {
  const { navigate } = useRouter()
  const homepageQuery = useHomepageContentQuery()

  if (homepageQuery.isLoading) {
    return (
      <section className="content-band py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-muted-foreground">
          Loading homepage content...
        </div>
      </section>
    )
  }

  if (homepageQuery.error || !homepageQuery.data) {
    const message =
      homepageQuery.error instanceof Error
        ? homepageQuery.error.message
        : 'The homepage CMS response was empty.'

    return (
      <section className="content-band py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl rounded-[8px] border border-destructive/30 bg-card p-6">
            <h1 className="text-2xl font-semibold tracking-normal text-destructive">
              Unable to load homepage content.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </section>
    )
  }

  const content = homepageQuery.data

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
