/**
 * File: src/modules/notification-config/notification-config.visuals.ts
 * Purpose: Normalize notification type visual metadata tokens and defaults.
 * Why: Keeps icon/accent resolution centralized so API payloads stay consistent.
 */

import type { NotificationTypeConfigItem } from "./notification-config.schema.js";

const ICON_TOKENS = [
  "check-circle",
  "clock",
  "bell",
  "file-text",
  "inbox",
] as const;

type NotificationIconToken = (typeof ICON_TOKENS)[number];

const ACCENT_TOKENS = ["success", "warning", "info", "neutral"] as const;

type NotificationAccentToken = (typeof ACCENT_TOKENS)[number];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isIconToken(value: string): value is NotificationIconToken {
  return ICON_TOKENS.includes(value as NotificationIconToken);
}

function isAccentToken(value: string): value is NotificationAccentToken {
  return ACCENT_TOKENS.includes(value as NotificationAccentToken);
}

function getDefaultIconByType(type: string): NotificationIconToken | null {
  if (type === "graded") {
    return "check-circle";
  }
  if (type === "due_soon") {
    return "clock";
  }
  if (type === "assignment_published" || type === "new_submission") {
    return "file-text";
  }
  if (type === "weekly_digest") {
    return "inbox";
  }
  return null;
}

function getDefaultIconByCategory(category: string): NotificationIconToken {
  if (category === "assignments") {
    return "file-text";
  }
  if (category === "digest") {
    return "inbox";
  }
  if (category === "grading") {
    return "check-circle";
  }
  return "bell";
}

function getDefaultAccentByType(type: string): NotificationAccentToken | null {
  if (type === "graded") {
    return "success";
  }
  if (type === "due_soon") {
    return "warning";
  }
  if (
    type === "assignment_published"
    || type === "new_submission"
    || type === "schedule_update"
  ) {
    return "info";
  }
  if (type === "weekly_digest") {
    return "neutral";
  }
  return null;
}

function getDefaultAccentByCategory(category: string): NotificationAccentToken {
  if (category === "digest") {
    return "neutral";
  }
  if (category === "assignments") {
    return "warning";
  }
  if (category === "grading") {
    return "success";
  }
  return "info";
}

function resolveIconToken(input: {
  icon: unknown;
  type: string;
  category: string;
}): NotificationIconToken {
  const normalized = normalizeText(input.icon);
  if (normalized && isIconToken(normalized)) {
    return normalized;
  }

  return (
    getDefaultIconByType(input.type)
    ?? getDefaultIconByCategory(input.category)
  );
}

function resolveAccentToken(input: {
  accent: unknown;
  type: string;
  category: string;
}): NotificationAccentToken {
  const normalized = normalizeText(input.accent);
  if (normalized && isAccentToken(normalized)) {
    return normalized;
  }

  return (
    getDefaultAccentByType(input.type)
    ?? getDefaultAccentByCategory(input.category)
  );
}

export function toNotificationTypeConfigItem(input: {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: unknown;
  accent: unknown;
  defaultEnabled: boolean;
  enabled: boolean;
  sortOrder: number;
}): NotificationTypeConfigItem {
  const id = normalizeText(input.id);
  const label = normalizeText(input.label);
  const category = normalizeText(input.category) || "general";

  return {
    id,
    label,
    description: normalizeText(input.description),
    category,
    icon: resolveIconToken({
      icon: input.icon,
      type: id,
      category,
    }),
    accent: resolveAccentToken({
      accent: input.accent,
      type: id,
      category,
    }),
    default_enabled: input.defaultEnabled,
    enabled: input.enabled,
    sort_order: input.sortOrder,
  };
}
