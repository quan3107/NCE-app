/**
 * Location: components/marketing/StatsOverview.tsx
 * Purpose: Display CMS-driven hero statistics with proper numeric formatting.
 * Why: Marketing stats support multiple backend formats (number, decimal, percentage).
 */

import type { StatItem } from '@features/marketing/types'

type StatsOverviewProps = {
  stats: StatItem[]
}

export function formatStatValue(stat: StatItem): string {
  switch (stat.format) {
    case 'percentage':
      return `${Math.round(stat.value * 100)}%`
    case 'decimal':
      return stat.value.toFixed(1)
    case 'number':
    default:
      return `${stat.value}${stat.suffix ?? ''}`
  }
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="mt-16 grid grid-cols-3 gap-8">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="text-3xl sm:text-4xl font-medium mb-1">
            {formatStatValue(stat)}
          </div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
