/**
 * File: tests/modules/course-management-tabs/course-management-tabs.service.test.ts
 * Purpose: Validate course management tab config lookup and fallback behavior by role.
 * Why: Ensures backend tab config outages are explicit in logs and do not break consumers.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    courseManagementTabConfig: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/modules/permissions/permissions.service.js", () => ({
  getPermissionsForRole: vi.fn(),
  hasPermission: vi.fn((permissions: string[], requiredPermission: string) =>
    permissions.includes(requiredPermission),
  ),
}));

vi.mock("../../../src/config/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const permissionsModule = await import("../../../src/modules/permissions/permissions.service.js");
const loggerModule = await import("../../../src/config/logger.js");

const prisma = vi.mocked(prismaModule.prisma, true);
const permissionsService = vi.mocked(permissionsModule, true);
const logger = vi.mocked(loggerModule.logger, true);

const { getCourseManagementTabsForRole } = await import(
  "../../../src/modules/course-management-tabs/course-management-tabs.service.js"
);

describe("course-management-tabs.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    permissionsService.getPermissionsForRole.mockResolvedValue([
      "courses:read",
      "courses:manage",
      "assignments:create",
      "rubrics:manage",
    ]);
  });

  it("maps role-scoped rows into endpoint payload", async () => {
    prisma.courseManagementTabConfig.findMany.mockResolvedValue([
      {
        id: "cfg-1",
        role: "teacher",
        tabId: "overview",
        label: "Overview",
        icon: "book-open",
        requiredPermission: "courses:read",
        sortOrder: 1,
        enabled: true,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
      {
        id: "cfg-2",
        role: "teacher",
        tabId: "students",
        label: "Students",
        icon: "users",
        requiredPermission: "courses:manage",
        sortOrder: 2,
        enabled: true,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);

    const payload = await getCourseManagementTabsForRole("teacher");

    expect(payload).toEqual({
      tabs: [
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
      ],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("removes rows when role permissions do not satisfy required_permission", async () => {
    permissionsService.getPermissionsForRole.mockResolvedValue(["courses:read"]);
    prisma.courseManagementTabConfig.findMany.mockResolvedValue([
      {
        id: "cfg-1",
        role: "teacher",
        tabId: "overview",
        label: "Overview",
        icon: "book-open",
        requiredPermission: "courses:read",
        sortOrder: 1,
        enabled: true,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
      {
        id: "cfg-2",
        role: "teacher",
        tabId: "students",
        label: "Students",
        icon: "users",
        requiredPermission: "courses:manage",
        sortOrder: 2,
        enabled: true,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);

    const payload = await getCourseManagementTabsForRole("teacher");

    expect(payload.tabs.map((tab) => tab.id)).toEqual(["overview"]);
  });

  it("uses fallback and logs explicit reason when rows are missing", async () => {
    prisma.courseManagementTabConfig.findMany.mockResolvedValue([]);

    const payload = await getCourseManagementTabsForRole("teacher");

    expect(payload.tabs.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "course_management_tabs_fallback_used",
        reason: "db_empty_for_role",
        role: "teacher",
      }),
      "Using fallback course management tabs configuration",
    );
  });

  it("uses fallback and logs explicit reason when query fails", async () => {
    prisma.courseManagementTabConfig.findMany.mockRejectedValue(
      new Error("database unavailable"),
    );

    const payload = await getCourseManagementTabsForRole("teacher");

    expect(payload.tabs.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "course_management_tabs_fallback_used",
        reason: "query_failed",
        role: "teacher",
      }),
      "Using fallback course management tabs configuration",
    );
  });

  it("uses fallback and logs explicit reason when rows are invalid", async () => {
    prisma.courseManagementTabConfig.findMany.mockResolvedValue([
      {
        id: "cfg-1",
        role: "teacher",
        tabId: "",
        label: "Overview",
        icon: "book-open",
        requiredPermission: "courses:read",
        sortOrder: 1,
        enabled: true,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ]);

    const payload = await getCourseManagementTabsForRole("teacher");

    expect(payload.tabs.length).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "course_management_tabs_fallback_used",
        reason: "invalid_rows",
        role: "teacher",
      }),
      "Using fallback course management tabs configuration",
    );
  });
});
