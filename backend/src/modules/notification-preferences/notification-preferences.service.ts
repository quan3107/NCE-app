/**
 * File: src/modules/notification-preferences/notification-preferences.service.ts
 * Purpose: Resolve and persist per-user notification preference overrides.
 * Why: Lets backend delivery logic enforce teacher filters without relying on frontend state.
 */

import type { UserRole } from "../../prisma/index.js";

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import { createHttpError } from "../../utils/httpError.js";
import { getNotificationTypesForRole } from "../notification-config/notification-config.service.js";
import type {
  MyNotificationPreferencesResponse,
  UpdateMyNotificationPreferencesRequest,
} from "./notification-preferences.schema.js";

const NOTIFICATION_PREFERENCES_VERSION = "2026-02-09-001";

type NotificationTypeConfigItem = Awaited<
  ReturnType<typeof getNotificationTypesForRole>
>["types"][number];

function toTypeRecord(
  item: NotificationTypeConfigItem,
  enabledOverride: boolean | undefined,
): MyNotificationPreferencesResponse["types"][number] {
  return {
    id: item.id,
    label: item.label,
    description: item.description,
    category: item.category,
    default_enabled: item.default_enabled,
    enabled: enabledOverride ?? item.default_enabled,
    sort_order: item.sort_order,
  };
}

async function getRoleConfigTypes(
  role: UserRole,
): Promise<NotificationTypeConfigItem[]> {
  const roleConfig = await getNotificationTypesForRole(role);
  return roleConfig.types;
}

export async function getMyNotificationPreferencesForUser(
  userId: string,
  role: UserRole,
): Promise<MyNotificationPreferencesResponse> {
  const configTypes = await getRoleConfigTypes(role);
  const typeIds = configTypes.map((item) => item.id);

  if (typeIds.length === 0) {
    return {
      role,
      version: NOTIFICATION_PREFERENCES_VERSION,
      personalized: false,
      types: [],
    };
  }

  const overrides = await prisma.userNotificationPreference.findMany({
    where: {
      userId,
      type: { in: typeIds },
    },
  });

  const overrideByType = new Map(
    overrides.map((override) => [override.type, override.enabled]),
  );

  return {
    role,
    version: NOTIFICATION_PREFERENCES_VERSION,
    personalized: overrides.length > 0,
    types: configTypes.map((item) =>
      toTypeRecord(item, overrideByType.get(item.id)),
    ),
  };
}

export async function saveMyNotificationPreferencesForUser(
  userId: string,
  role: UserRole,
  payload: UpdateMyNotificationPreferencesRequest,
): Promise<MyNotificationPreferencesResponse> {
  const configTypes = await getRoleConfigTypes(role);
  const configByType = new Map(
    configTypes.map((item) => [item.id, item]),
  );

  for (const preference of payload.types) {
    if (!configByType.has(preference.id)) {
      throw createHttpError(
        400,
        "Notification preference id is not valid for this role.",
        { type: preference.id },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const preference of payload.types) {
      const config = configByType.get(preference.id);
      if (!config) {
        continue;
      }

      if (preference.enabled === config.default_enabled) {
        await tx.userNotificationPreference.deleteMany({
          where: {
            userId,
            type: preference.id,
          },
        });
        continue;
      }

      await tx.userNotificationPreference.upsert({
        where: {
          userId_type: {
            userId,
            type: preference.id,
          },
        },
        create: {
          userId,
          type: preference.id,
          enabled: preference.enabled,
        },
        update: {
          enabled: preference.enabled,
        },
      });
    }
  });

  return getMyNotificationPreferencesForUser(userId, role);
}

export async function resetMyNotificationPreferencesForUser(
  userId: string,
): Promise<void> {
  await prisma.userNotificationPreference.deleteMany({
    where: {
      userId,
    },
  });
}

export async function resolveNotificationTypeEnabledForUsers(input: {
  role: UserRole;
  type: string;
  userIds: string[];
}): Promise<Map<string, boolean>> {
  const deduplicatedUserIds = Array.from(new Set(input.userIds));
  const enabledByUser = new Map<string, boolean>();

  if (deduplicatedUserIds.length === 0) {
    return enabledByUser;
  }

  const configTypes = await getRoleConfigTypes(input.role);
  const configType = configTypes.find((item) => item.id === input.type);

  if (!configType) {
    logger.info(
      {
        event: "notification_type_not_enabled_for_role",
        role: input.role,
        type: input.type,
        user_count: deduplicatedUserIds.length,
      },
      "Notification type is not enabled for role; suppressing delivery",
    );

    for (const userId of deduplicatedUserIds) {
      enabledByUser.set(userId, false);
    }
    return enabledByUser;
  }

  const defaultEnabled = configType.default_enabled;

  try {
    const overrides = await prisma.userNotificationPreference.findMany({
      where: {
        userId: { in: deduplicatedUserIds },
        type: input.type,
      },
      select: {
        userId: true,
        enabled: true,
      },
    });

    const overrideByUser = new Map(
      overrides.map((item) => [item.userId, item.enabled]),
    );

    for (const userId of deduplicatedUserIds) {
      enabledByUser.set(userId, overrideByUser.get(userId) ?? defaultEnabled);
    }

    return enabledByUser;
  } catch (error) {
    logger.error(
      {
        err: error,
        event: "notification_preference_lookup_failed",
        role: input.role,
        type: input.type,
        user_count: deduplicatedUserIds.length,
      },
      "Notification preference lookup failed; suppressing delivery",
    );

    for (const userId of deduplicatedUserIds) {
      enabledByUser.set(userId, false);
    }

    return enabledByUser;
  }
}
