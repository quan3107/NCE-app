/**
 * Location: features/courses/management/courseTabs.ui.ts
 * Purpose: Resolve backend tab metadata into supported tab ids and icons for UI rendering.
 * Why: Keeps TeacherCourseManagement focused on orchestration while staying under LOC limits.
 */

import {
  BookOpen,
  Clock,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { CourseManagementTabConfig } from './courseTabs.config.api';

export const SUPPORTED_TAB_IDS = [
  'overview',
  'students',
  'deadlines',
  'announcements',
  'settings',
] as const;

export type TabValue = (typeof SUPPORTED_TAB_IDS)[number];

export type ResolvedCourseTab = {
  value: TabValue;
  label: string;
  Icon: LucideIcon;
};

const supportedTabIds = new Set<string>(SUPPORTED_TAB_IDS);
const iconByName: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  users: Users,
  clock: Clock,
  megaphone: Megaphone,
  settings: Settings,
};

const warnedUnknownIconNames = new Set<string>();

export function isSupportedTabId(value: string): value is TabValue {
  return supportedTabIds.has(value);
}

export function resolveTabIcon(iconName: string): LucideIcon {
  const normalized = iconName.trim().toLowerCase();
  const icon = iconByName[normalized];

  if (icon) {
    return icon;
  }

  if (!warnedUnknownIconNames.has(normalized)) {
    warnedUnknownIconNames.add(normalized);
    console.warn('[course-management] unknown tab icon; falling back to book-open', {
      iconName,
      fallbackIcon: 'book-open',
    });
  }

  return BookOpen;
}

export function toResolvedCourseTabs(
  tabs: CourseManagementTabConfig[],
  warnedUnsupportedTabIds: Set<string>,
): ResolvedCourseTab[] {
  return tabs
    .filter((tab) => {
      if (isSupportedTabId(tab.id)) {
        return true;
      }

      if (!warnedUnsupportedTabIds.has(tab.id)) {
        warnedUnsupportedTabIds.add(tab.id);
        console.warn('[course-management] unsupported tab id omitted from render', {
          tabId: tab.id,
        });
      }

      return false;
    })
    .map((tab) => ({
      value: tab.id,
      label: tab.label,
      Icon: resolveTabIcon(tab.icon),
    }));
}
