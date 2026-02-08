/**
 * Location: frontend/src/features/marketing/iconMap.tsx
 * Purpose: Map icon string names to Lucide React components
 * Why: CMS returns icon names as strings, components need React nodes
 */

import type { ComponentType, ReactNode } from 'react'
import {
  Award,
  BookOpen,
  Heart,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  'book-open': BookOpen,
  users: Users,
  'trending-up': TrendingUp,
  target: Target,
  heart: Heart,
  award: Award,
}

export function getIconComponent(iconName: string, className?: string): ReactNode {
  const IconComponent = iconMap[iconName]
  if (!IconComponent) {
    console.warn(`[marketing-cms] Unknown icon "${iconName}" in icon map.`)
    return null
  }

  return <IconComponent className={className} />
}
