/**
 * Location: components/marketing/HeroSection.tsx
 * Purpose: Render the marketing hero with CMS-provided copy and CTA labels.
 * Why: Keeps high-visibility landing content editable from backend CMS data.
 */

import { ArrowRight } from 'lucide-react'

import { Badge } from '@components/ui/badge'
import { Button } from '@components/ui/button'
import type { StatItem } from '@features/marketing/types'

import { StatsOverview } from './StatsOverview'

type HeroSectionProps = {
  badge: string
  title: string
  description: string
  ctaPrimary: string
  ctaSecondary: string
  stats: StatItem[]
  onViewCourses: () => void
  onTeacherLogin: () => void
}

export function HeroSection({
  badge,
  title,
  description,
  ctaPrimary,
  ctaSecondary,
  stats,
  onViewCourses,
  onTeacherLogin,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#E6F0FF] via-[#BFD9FF]/30 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="max-w-3xl">
          <Badge className="mb-4">{badge}</Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-6">{title}</h1>
          <p className="text-xl text-muted-foreground mb-8">{description}</p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" onClick={onViewCourses}>
              {ctaPrimary}
              <ArrowRight className="ml-2 size-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onTeacherLogin}>
              {ctaSecondary}
            </Button>
          </div>
        </div>
        <StatsOverview stats={stats} />
      </div>
    </section>
  )
}
