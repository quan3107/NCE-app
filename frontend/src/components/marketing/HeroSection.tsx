/**
 * Location: components/marketing/HeroSection.tsx
 * Purpose: Render the marketing hero with CMS-provided copy and CTA labels.
 * Why: Keeps high-visibility landing content editable from backend CMS data.
 */

import { ArrowRight, BookOpenCheck, Headphones, PenLine } from 'lucide-react'

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
    <section className="relative overflow-hidden bg-background">
      <div className="absolute inset-0 hidden lg:block">
        <img
          src="/assets/minimal-study-hero.png"
          alt=""
          aria-hidden="true"
          className="size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:min-h-[680px] lg:flex lg:items-center">
        <div className="max-w-2xl">
          <Badge className="mb-5 bg-secondary text-secondary-foreground hover:bg-secondary">{badge}</Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight mb-6">{title}</h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-xl">{description}</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onViewCourses}>
              {ctaPrimary}
              <ArrowRight className="ml-2 size-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onTeacherLogin}>
              {ctaSecondary}
            </Button>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-sm">
            {[
              { icon: BookOpenCheck, label: 'Reading' },
              { icon: Headphones, label: 'Listening' },
              { icon: PenLine, label: 'Writing' },
            ].map((item) => (
              <div key={item.label} className="quiet-panel flex items-center gap-2 px-3 py-3">
                <item.icon className="size-4 text-primary" />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <StatsOverview stats={stats} />
      </div>
    </section>
  )
}
