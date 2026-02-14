/**
 * File: src/modules/notification-config/notification-config.service.ts
 * Purpose: Resolve role-based notification type metadata from persisted config rows.
 * Why: Allows frontend filters and labels to be backend-driven with safe, logged fallbacks.
 */

import type { UserRole } from "../../prisma/index.js";

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import { getFallbackNotificationTypes } from "./notification-config.fallback.js";
import type { NotificationTypesResponse } from "./notification-config.schema.js";
import { toNotificationTypeConfigItem } from "./notification-config.visuals.js";

type FallbackReason = "db_empty_for_role" | "query_failed" | "invalid_rows";

function toFallbackTypes(
  role: UserRole,
  reason: FallbackReason,
  details: Record<string, unknown> = {},
) {
  const fallback = getFallbackNotificationTypes(role);

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

  return fallback;
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

    const mapped = rows.map((row) =>
      toNotificationTypeConfigItem({
        id: row.type,
        label: row.label,
        description: row.description,
        category: row.category,
        icon: row.icon,
        accent: row.accent,
        defaultEnabled: row.defaultEnabled,
        enabled: row.enabled,
        sortOrder: row.sortOrder,
      }),
    );

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
