/**
 * File: src/modules/notification-config/notification-config.fallback.ts
 * Purpose: Provide role-scoped fallback notification type config rows.
 * Why: Preserves resilient config behavior when DB-backed rows are unavailable.
 */

import type { UserRole } from "../../prisma/index.js";

import type { NotificationTypeConfigItem } from "./notification-config.schema.js";

const FALLBACK_NOTIFICATION_TYPES_BY_ROLE: Record<UserRole, NotificationTypeConfigItem[]> = {
  student: [
    {
      id: "assignment_published",
      label: "Assignment Published",
      description: "When a new assignment is published.",
      category: "assignments",
      icon: "file-text",
      accent: "info",
      default_enabled: true,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "due_soon",
      label: "Due Soon",
      description: "When an assignment deadline is approaching.",
      category: "assignments",
      icon: "clock",
      accent: "warning",
      default_enabled: true,
      enabled: true,
      sort_order: 2,
    },
    {
      id: "graded",
      label: "Graded",
      description: "When feedback and scores are released.",
      category: "grading",
      icon: "check-circle",
      accent: "success",
      default_enabled: true,
      enabled: true,
      sort_order: 3,
    },
    {
      id: "reminder",
      label: "Reminder",
      description: "General reminders and nudges.",
      category: "general",
      icon: "bell",
      accent: "info",
      default_enabled: true,
      enabled: true,
      sort_order: 4,
    },
    {
      id: "weekly_digest",
      label: "Weekly Digest",
      description: "A weekly summary of upcoming coursework.",
      category: "digest",
      icon: "inbox",
      accent: "neutral",
      default_enabled: true,
      enabled: true,
      sort_order: 5,
    },
  ],
  teacher: [
    {
      id: "new_submission",
      label: "New Submission",
      description: "When a student submits new work.",
      category: "grading",
      icon: "file-text",
      accent: "info",
      default_enabled: true,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "reminder",
      label: "Reminder",
      description: "General reminders and workflow nudges.",
      category: "general",
      icon: "bell",
      accent: "info",
      default_enabled: true,
      enabled: true,
      sort_order: 2,
    },
    {
      id: "weekly_digest",
      label: "Weekly Digest",
      description: "A weekly summary of assignment activity.",
      category: "digest",
      icon: "inbox",
      accent: "neutral",
      default_enabled: true,
      enabled: true,
      sort_order: 3,
    },
  ],
  admin: [
    {
      id: "reminder",
      label: "Reminder",
      description: "General operational reminders.",
      category: "general",
      icon: "bell",
      accent: "info",
      default_enabled: true,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "weekly_digest",
      label: "Weekly Digest",
      description: "A weekly platform activity summary.",
      category: "digest",
      icon: "inbox",
      accent: "neutral",
      default_enabled: true,
      enabled: true,
      sort_order: 2,
    },
    {
      id: "schedule_update",
      label: "Schedule Update",
      description: "When class schedules or events are updated.",
      category: "system",
      icon: "clock",
      accent: "info",
      default_enabled: true,
      enabled: true,
      sort_order: 3,
    },
  ],
};

export function getFallbackNotificationTypes(
  role: UserRole,
): NotificationTypeConfigItem[] {
  const fallback =
    FALLBACK_NOTIFICATION_TYPES_BY_ROLE[role]
    ?? FALLBACK_NOTIFICATION_TYPES_BY_ROLE.student;
  return fallback.map((item) => ({ ...item }));
}
