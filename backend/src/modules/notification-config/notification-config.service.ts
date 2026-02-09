/**
 * File: src/modules/notification-config/notification-config.service.ts
 * Purpose: Resolve role-based notification type metadata from persisted config rows.
 * Why: Allows frontend filters and labels to be backend-driven with safe, logged fallbacks.
 */

import type { UserRole } from "../../prisma/index.js";

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import type {
  NotificationTypeConfigItem,
  NotificationTypesResponse,
} from "./notification-config.schema.js";

type FallbackReason = "db_empty_for_role" | "query_failed" | "invalid_rows";

const FALLBACK_NOTIFICATION_TYPES: Record<UserRole, NotificationTypeConfigItem[]> = {
  student: [
    {
      id: "assignment_published",
      label: "Assignment Published",
      description: "When a new assignment is published.",
      category: "assignments",
      default_enabled: true,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "due_soon",
      label: "Due Soon",
      description: "When an assignment deadline is approaching.",
      category: "assignments",
      default_enabled: true,
      enabled: true,
      sort_order: 2,
    },
    {
      id: "graded",
      label: "Graded",
      description: "When feedback and scores are released.",
      category: "grading",
      default_enabled: true,
      enabled: true,
      sort_order: 3,
    },
    {
      id: "reminder",
      label: "Reminder",
      description: "General reminders and nudges.",
      category: "general",
      default_enabled: true,
      enabled: true,
      sort_order: 4,
    },
  ],
  teacher: [
    {
      id: "new_submission",
      label: "New Submission",
      description: "When a student submits new work.",
      category: "grading",
      default_enabled: true,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "graded",
      label: "Graded",
      description: "When grading activity is completed.",
      category: "grading",
      default_enabled: true,
      enabled: true,
      sort_order: 2,
    },
    {
      id: "reminder",
      label: "Reminder",
      description: "General reminders and workflow nudges.",
      category: "general",
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
      default_enabled: true,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "schedule_update",
      label: "Schedule Update",
      description: "When class schedules or events are updated.",
      category: "system",
      default_enabled: true,
      enabled: true,
      sort_order: 2,
    },
  ],
};

function toFallbackTypes(
  role: UserRole,
  reason: FallbackReason,
  details: Record<string, unknown> = {},
): NotificationTypeConfigItem[] {
  const fallback = FALLBACK_NOTIFICATION_TYPES[role] ?? FALLBACK_NOTIFICATION_TYPES.student;
  logger.warn(
    {
      event: "notification_types_fallback_used",
      reason,
      role,
      fallback_count: fallback.length,
      ...details,
    },
    "Using fallback notification types configuration",
  );
  return fallback.map((item) => ({ ...item }));
}

export async function getNotificationTypesForRole(
  role: UserRole,
): Promise<NotificationTypesResponse> {
  try {
    const rows = await prisma.notificationTypeConfig.findMany({
      where: {
        role,
        enabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { type: "asc" }],
    });

    if (rows.length === 0) {
      return {
        types: toFallbackTypes(role, "db_empty_for_role"),
      };
    }

    const mapped = rows.map((row) => ({
      id: row.type.trim(),
      label: row.label.trim(),
      description: row.description,
      category: row.category,
      default_enabled: row.defaultEnabled,
      enabled: row.enabled,
      sort_order: row.sortOrder,
    }));

    const invalidCount = mapped.filter(
      (item) => item.id.length === 0 || item.label.length === 0,
    ).length;

    if (invalidCount > 0) {
      return {
        types: toFallbackTypes(role, "invalid_rows", {
          invalid_count: invalidCount,
          row_count: rows.length,
        }),
      };
    }

    return {
      types: mapped,
    };
  } catch (error) {
    return {
      types: toFallbackTypes(role, "query_failed", {
        err: error,
      }),
    };
  }
}
