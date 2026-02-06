/**
 * Location: src/features/navigation/utils/iconMap.ts
 * Purpose: Map backend icon names to Lucide icon components.
 * Why: Keeps rendering decoupled from API payload string values.
 */

import {
  AlertCircle,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Gauge,
  GraduationCap,
  Home,
  Info,
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  Timer,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  home: Home,
  'book-open': BookOpen,
  'layout-dashboard': LayoutDashboard,
  'file-text': FileText,
  'check-circle-2': CheckCircle2,
  'alert-circle': AlertCircle,
  clock: Clock,
  gauge: Gauge,
  timer: Timer,
  'graduation-cap': GraduationCap,
  bell: Bell,
  user: User,
  users: Users,
  settings: Settings,
  'scroll-text': ScrollText,
  'bar-chart-3': BarChart3,
  'book-marked': BookMarked,
  info: Info,
  mail: Mail,
};

export const getIcon = (iconName: string): LucideIcon => iconMap[iconName] ?? Circle;
