/**
 * File: src/modules/course-management-tabs/course-management-tabs.service.ts
 * Purpose: Resolve role-based course management tab metadata from persisted config rows.
 * Why: Lets frontend tab rendering be backend-driven with explicit fallback logging.
 */

import type { UserRole } from "../../prisma/index.js";

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import {
  getPermissionsForRole,
  hasPermission,
} from "../permissions/permissions.service.js";
import type {
  CourseManagementTabConfigItem,
  CourseManagementTabsResponse,
} from "./course-management-tabs.schema.js";

type FallbackReason = "db_empty_for_role" | "query_failed" | "invalid_rows";

const FALLBACK_COURSE_MANAGEMENT_TABS_BY_ROLE: Record<
  UserRole,
  CourseManagementTabConfigItem[]
> = {
  student: [],
  teacher: [
    {
      id: "overview",
      label: "Overview",
      icon: "book-open",
      required_permission: "courses:read",
      order: 1,
      enabled: true,
    },
    {
      id: "students",
      label: "Students",
      icon: "users",
      required_permission: "courses:manage",
      order: 2,
      enabled: true,
    },
    {
      id: "deadlines",
      label: "Deadlines",
      icon: "clock",
      required_permission: "assignments:create",
      order: 3,
      enabled: true,
    },
    {
      id: "announcements",
      label: "Announcements",
      icon: "megaphone",
      required_permission: "courses:manage",
      order: 4,
      enabled: true,
    },
    {
      id: "settings",
      label: "Settings",
      icon: "settings",
      required_permission: "rubrics:manage",
      order: 5,
      enabled: true,
    },
  ],
  admin: [],
};

function toFallbackTabs(
  role: UserRole,
  reason: FallbackReason,
  details: Record<string, unknown> = {},
): CourseManagementTabConfigItem[] {
  const fallback =
    FALLBACK_COURSE_MANAGEMENT_TABS_BY_ROLE[role]
    ?? FALLBACK_COURSE_MANAGEMENT_TABS_BY_ROLE.teacher;

  logger.warn(
    {
      event: "course_management_tabs_fallback_used",
      reason,
      role,
      fallback_count: fallback.length,
      ...details,
    },
    "Using fallback course management tabs configuration",
  );

  return fallback.map((item) => ({ ...item }));
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapCourseTab(
  row: Awaited<ReturnType<typeof prisma.courseManagementTabConfig.findMany>>[number],
): CourseManagementTabConfigItem | null {
  const id = normalizeText(row.tabId);
  const label = normalizeText(row.label);
  const icon = normalizeText(row.icon);

  if (!id || !label || !icon) {
    return null;
  }

  return {
    id,
    label,
    icon,
    required_permission: normalizeText(row.requiredPermission) || null,
    order: row.sortOrder,
    enabled: row.enabled,
  };
}

export async function getCourseManagementTabsForRole(
  role: UserRole,
): Promise<CourseManagementTabsResponse> {
  try {
    const [rows, permissions] = await Promise.all([
      prisma.courseManagementTabConfig.findMany({
        where: {
          role,
          enabled: true,
        },
        orderBy: [{ sortOrder: "asc" }, { tabId: "asc" }],
      }),
      getPermissionsForRole(role),
    ]);

    if (rows.length === 0) {
      return {
        tabs: toFallbackTabs(role, "db_empty_for_role"),
      };
    }

    const mapped = rows.map(mapCourseTab).filter(Boolean);

    if (mapped.length !== rows.length) {
      return {
        tabs: toFallbackTabs(role, "invalid_rows", {
          invalid_count: rows.length - mapped.length,
          row_count: rows.length,
        }),
      };
    }

    return {
      tabs: mapped.filter(
        (tab): tab is CourseManagementTabConfigItem =>
          tab !== null
          && (!tab.required_permission || hasPermission(permissions, tab.required_permission)),
      ),
    };
  } catch (error) {
    return {
      tabs: toFallbackTabs(role, "query_failed", {
        err: error,
      }),
    };
  }
}

export function getCourseManagementTabsFallback(
  role: UserRole,
): CourseManagementTabConfigItem[] {
  return (
    FALLBACK_COURSE_MANAGEMENT_TABS_BY_ROLE[role]
    ?? FALLBACK_COURSE_MANAGEMENT_TABS_BY_ROLE.teacher
  ).map((item) => ({ ...item }));
}
