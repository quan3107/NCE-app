/**
 * File: tests/modules/dashboard-config/dashboard-config.service.test.ts
 * Purpose: Validate dashboard widget default/merge behavior and personalization persistence guards.
 * Why: Prevents regressions when role defaults and user overrides are merged for dashboard rendering.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/prisma/client.js", () => ({
  prisma: {
    dashboardWidgetDefinition: {
      findMany: vi.fn(),
    },
    userDashboardWidgetPreference: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const prismaModule = await import("../../../src/prisma/client.js");
const prisma = vi.mocked(prismaModule.prisma, true);

const {
  getDashboardWidgetDefaultsForRole,
  getMyDashboardConfigForUser,
  resetMyDashboardConfigForUser,
  saveMyDashboardConfigForUser,
} = await import("../../../src/modules/dashboard-config/dashboard-config.service.js");

const studentDefinitions = [
  {
    id: "def-1",
    role: "student",
    widgetKey: "student_due_soon",
    type: "stat",
    label: "Due Soon",
    iconName: "clock",
    color: "text-orange-500",
    dataSource: "student.assignments_due_soon",
    valueFormat: "number",
    defaultOrder: 0,
    defaultVisible: true,
    defaultX: 0,
    defaultY: 0,
    defaultW: 1,
    defaultH: 1,
    isActive: true,
    createdAt: new Date("2026-02-06T00:00:00.000Z"),
    updatedAt: new Date("2026-02-06T00:00:00.000Z"),
  },
  {
    id: "def-2",
    role: "student",
    widgetKey: "student_completed",
    type: "stat",
    label: "Completed",
    iconName: "check-circle-2",
    color: "text-green-500",
    dataSource: "student.assignments_completed",
    valueFormat: "number",
    defaultOrder: 1,
    defaultVisible: true,
    defaultX: 1,
    defaultY: 0,
    defaultW: 1,
    defaultH: 1,
    isActive: true,
    createdAt: new Date("2026-02-06T00:00:00.000Z"),
    updatedAt: new Date("2026-02-06T00:00:00.000Z"),
  },
];

describe("dashboard-config.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        userDashboardWidgetPreference: {
          deleteMany: prisma.userDashboardWidgetPreference.deleteMany,
          createMany: prisma.userDashboardWidgetPreference.createMany,
        },
      }),
    );
  });

  it("returns role defaults for config endpoint", async () => {
    prisma.dashboardWidgetDefinition.findMany.mockResolvedValue(studentDefinitions);

    const payload = await getDashboardWidgetDefaultsForRole("student");

    expect(payload.role).toBe("student");
    expect(payload.widgets).toEqual([
      {
        id: "student_due_soon",
        type: "stat",
        label: "Due Soon",
        icon_name: "clock",
        color: "text-orange-500",
        data_source: "student.assignments_due_soon",
        value_format: "number",
        default_order: 0,
        default_visible: true,
        position: { x: 0, y: 0, w: 1, h: 1 },
      },
      {
        id: "student_completed",
        type: "stat",
        label: "Completed",
        icon_name: "check-circle-2",
        color: "text-green-500",
        data_source: "student.assignments_completed",
        value_format: "number",
        default_order: 1,
        default_visible: true,
        position: { x: 1, y: 0, w: 1, h: 1 },
      },
    ]);
  });

  it("merges role defaults when no personalization exists", async () => {
    prisma.dashboardWidgetDefinition.findMany.mockResolvedValue(studentDefinitions);
    prisma.userDashboardWidgetPreference.findMany.mockResolvedValue([]);

    const payload = await getMyDashboardConfigForUser("user-1", "student");

    expect(payload.personalized).toBe(false);
    expect(payload.widgets.map((widget) => widget.id)).toEqual([
      "student_due_soon",
      "student_completed",
    ]);
    expect(payload.widgets[0]).toMatchObject({
      visible: true,
      order: 0,
      position: { x: 0, y: 0, w: 1, h: 1 },
    });
  });

  it("merges and sorts personalized overrides by order", async () => {
    prisma.dashboardWidgetDefinition.findMany.mockResolvedValue(studentDefinitions);
    prisma.userDashboardWidgetPreference.findMany.mockResolvedValue([
      {
        id: "pref-1",
        userId: "user-1",
        widgetDefinitionId: "def-1",
        visible: false,
        orderIndex: 1,
        x: 1,
        y: 0,
        w: 2,
        h: 1,
        createdAt: new Date("2026-02-06T00:00:00.000Z"),
        updatedAt: new Date("2026-02-06T00:00:00.000Z"),
      },
      {
        id: "pref-2",
        userId: "user-1",
        widgetDefinitionId: "def-2",
        visible: true,
        orderIndex: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        createdAt: new Date("2026-02-06T00:00:00.000Z"),
        updatedAt: new Date("2026-02-06T00:00:00.000Z"),
      },
    ]);

    const payload = await getMyDashboardConfigForUser("user-1", "student");

    expect(payload.personalized).toBe(true);
    expect(payload.widgets.map((widget) => widget.id)).toEqual([
      "student_completed",
      "student_due_soon",
    ]);
    expect(payload.widgets[1]).toMatchObject({
      id: "student_due_soon",
      visible: false,
      order: 1,
      position: { x: 1, y: 0, w: 2, h: 1 },
    });
  });

  it("rejects save payload when widget ids do not match role definitions", async () => {
    prisma.dashboardWidgetDefinition.findMany.mockResolvedValue(studentDefinitions);

    await expect(
      saveMyDashboardConfigForUser("user-1", "student", {
        widgets: [
          {
            id: "teacher_on_time_rate",
            visible: true,
            order: 0,
            position: { x: 0, y: 0, w: 1, h: 1 },
          },
          {
            id: "student_due_soon",
            visible: true,
            order: 1,
            position: { x: 1, y: 0, w: 1, h: 1 },
          },
        ],
      }),
    ).rejects.toThrow("Dashboard widget id is not valid for this role.");
  });

  it("resets personalization by deleting role-scoped user preferences", async () => {
    prisma.dashboardWidgetDefinition.findMany.mockResolvedValue(studentDefinitions);

    await resetMyDashboardConfigForUser("user-1", "student");

    expect(prisma.userDashboardWidgetPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        widgetDefinitionId: {
          in: ["def-1", "def-2"],
        },
      },
    });
  });
});
