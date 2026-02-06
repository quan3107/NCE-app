/**
 * File: src/modules/dashboard-config/dashboard-config.service.ts
 * Purpose: Resolve dashboard widget defaults and user-specific personalization.
 * Why: Centralizes merge and validation logic so controllers stay transport-focused.
 */

import { prisma } from "../../prisma/client.js";
import type { UserRole } from "../../prisma/index.js";
import { createHttpError } from "../../utils/httpError.js";
import type {
  DashboardWidgetDefaultsResponse,
  MyDashboardConfigResponse,
  UpdateMyDashboardConfigRequest,
} from "./dashboard-config.schema.js";

const DASHBOARD_WIDGETS_VERSION = "2026-02-06-001";

type DashboardWidgetDefinition = Awaited<
  ReturnType<typeof prisma.dashboardWidgetDefinition.findMany>
>[number];

type DashboardWidgetPreference = Awaited<
  ReturnType<typeof prisma.userDashboardWidgetPreference.findMany>
>[number];

async function getActiveDefinitionsForRole(
  role: UserRole,
): Promise<DashboardWidgetDefinition[]> {
  return prisma.dashboardWidgetDefinition.findMany({
    where: {
      role,
      isActive: true,
    },
    orderBy: [{ defaultOrder: "asc" }, { widgetKey: "asc" }],
  });
}

function toDefaultWidget(definition: DashboardWidgetDefinition) {
  return {
    id: definition.widgetKey,
    type: definition.type,
    label: definition.label,
    icon_name: definition.iconName,
    color: definition.color,
    data_source: definition.dataSource,
    value_format: definition.valueFormat,
    default_order: definition.defaultOrder,
    default_visible: definition.defaultVisible,
    position: {
      x: definition.defaultX,
      y: definition.defaultY,
      w: definition.defaultW,
      h: definition.defaultH,
    },
  };
}

function sortByOrderAndLabel<T extends { order: number; label: string }>(
  widgets: T[],
): T[] {
  return [...widgets].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.label.localeCompare(right.label);
  });
}

export async function getDashboardWidgetDefaultsForRole(
  role: UserRole,
): Promise<DashboardWidgetDefaultsResponse> {
  const definitions = await getActiveDefinitionsForRole(role);

  return {
    role,
    version: DASHBOARD_WIDGETS_VERSION,
    widgets: definitions.map(toDefaultWidget),
  };
}

export async function getMyDashboardConfigForUser(
  userId: string,
  role: UserRole,
): Promise<MyDashboardConfigResponse> {
  const definitions = await getActiveDefinitionsForRole(role);

  if (definitions.length === 0) {
    return {
      role,
      version: DASHBOARD_WIDGETS_VERSION,
      personalized: false,
      widgets: [],
    };
  }

  const preferences = await prisma.userDashboardWidgetPreference.findMany({
    where: {
      userId,
      widgetDefinitionId: {
        in: definitions.map((definition) => definition.id),
      },
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });

  const preferencesByDefinitionId = new Map(
    preferences.map((preference) => [preference.widgetDefinitionId, preference]),
  );

  const widgets = definitions.map((definition) => {
    const preference = preferencesByDefinitionId.get(definition.id);

    return {
      id: definition.widgetKey,
      type: definition.type,
      label: definition.label,
      icon_name: definition.iconName,
      color: definition.color,
      data_source: definition.dataSource,
      value_format: definition.valueFormat,
      visible: preference?.visible ?? definition.defaultVisible,
      order: preference?.orderIndex ?? definition.defaultOrder,
      position: {
        x: preference?.x ?? definition.defaultX,
        y: preference?.y ?? definition.defaultY,
        w: preference?.w ?? definition.defaultW,
        h: preference?.h ?? definition.defaultH,
      },
    };
  });

  return {
    role,
    version: DASHBOARD_WIDGETS_VERSION,
    personalized: preferences.length > 0,
    widgets: sortByOrderAndLabel(widgets),
  };
}

function validatePreferencesPayload(
  definitions: DashboardWidgetDefinition[],
  payload: UpdateMyDashboardConfigRequest,
): void {
  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.widgetKey, definition]),
  );

  if (payload.widgets.length !== definitions.length) {
    throw createHttpError(
      400,
      "Dashboard widget preferences must include all active widgets.",
      {
        expected: definitions.length,
        received: payload.widgets.length,
      },
    );
  }

  const seenWidgetIds = new Set<string>();
  const seenOrders = new Set<number>();

  for (const widget of payload.widgets) {
    if (!definitionsByKey.has(widget.id)) {
      throw createHttpError(400, "Dashboard widget id is not valid for this role.", {
        widgetId: widget.id,
      });
    }

    if (seenWidgetIds.has(widget.id)) {
      throw createHttpError(400, "Dashboard widget preferences contain duplicate ids.", {
        widgetId: widget.id,
      });
    }

    if (seenOrders.has(widget.order)) {
      throw createHttpError(400, "Dashboard widget preferences contain duplicate order values.", {
        order: widget.order,
      });
    }

    seenWidgetIds.add(widget.id);
    seenOrders.add(widget.order);
  }

  for (const definition of definitions) {
    if (!seenWidgetIds.has(definition.widgetKey)) {
      throw createHttpError(
        400,
        "Dashboard widget preferences are missing one or more required widgets.",
        {
          missingWidgetId: definition.widgetKey,
        },
      );
    }
  }
}

export async function saveMyDashboardConfigForUser(
  userId: string,
  role: UserRole,
  payload: UpdateMyDashboardConfigRequest,
): Promise<MyDashboardConfigResponse> {
  const definitions = await getActiveDefinitionsForRole(role);

  if (definitions.length === 0) {
    throw createHttpError(404, "Dashboard widgets are not configured for this role.");
  }

  validatePreferencesPayload(definitions, payload);

  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.widgetKey, definition]),
  );

  await prisma.$transaction(async (tx) => {
    await tx.userDashboardWidgetPreference.deleteMany({
      where: {
        userId,
        widgetDefinitionId: {
          in: definitions.map((definition) => definition.id),
        },
      },
    });

    await tx.userDashboardWidgetPreference.createMany({
      data: payload.widgets.map((widget) => {
        const definition = definitionsByKey.get(widget.id);

        if (!definition) {
          throw createHttpError(400, "Dashboard widget id is not valid for this role.", {
            widgetId: widget.id,
          });
        }

        return {
          userId,
          widgetDefinitionId: definition.id,
          visible: widget.visible,
          orderIndex: widget.order,
          x: widget.position.x,
          y: widget.position.y,
          w: widget.position.w,
          h: widget.position.h,
        };
      }),
    });
  });

  return getMyDashboardConfigForUser(userId, role);
}

export async function resetMyDashboardConfigForUser(
  userId: string,
  role: UserRole,
): Promise<void> {
  const definitions = await getActiveDefinitionsForRole(role);

  if (definitions.length === 0) {
    return;
  }

  await prisma.userDashboardWidgetPreference.deleteMany({
    where: {
      userId,
      widgetDefinitionId: {
        in: definitions.map((definition) => definition.id),
      },
    },
  });
}
