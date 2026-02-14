/**
 * Location: src/features/notifications/notificationVisuals.tsx
 * Purpose: Resolve notification visual metadata into safe icon/accent render values.
 * Why: Prevents page-level hardcoding and keeps unknown backend tokens non-breaking.
 */

import type { ReactNode } from 'react';
import { Bell, CheckCircle2, Clock, FileText, Inbox } from 'lucide-react';

const ICON_TOKENS = ['check-circle', 'clock', 'bell', 'file-text', 'inbox'] as const;
type NotificationIconToken = (typeof ICON_TOKENS)[number];

const ACCENT_TOKENS = ['success', 'warning', 'info', 'neutral'] as const;
type NotificationAccentToken = (typeof ACCENT_TOKENS)[number];

const warnedUnknownVisualTokens = new Set<string>();

function warnUnknownVisualToken(kind: 'icon' | 'accent', token: string) {
  const key = `${kind}:${token}`;
  if (warnedUnknownVisualTokens.has(key)) {
    return;
  }

  warnedUnknownVisualTokens.add(key);
  console.warn('[notifications] unknown notification visual token; using default', {
    kind,
    token,
  });
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isNotificationIconToken(value: string): value is NotificationIconToken {
  return ICON_TOKENS.includes(value as NotificationIconToken);
}

function isNotificationAccentToken(value: string): value is NotificationAccentToken {
  return ACCENT_TOKENS.includes(value as NotificationAccentToken);
}

function getDefaultIconTokenByType(type: string): NotificationIconToken {
  if (type === 'graded') {
    return 'check-circle';
  }
  if (type === 'due_soon' || type === 'schedule_update') {
    return 'clock';
  }
  if (type === 'assignment_published' || type === 'new_submission') {
    return 'file-text';
  }
  if (type === 'weekly_digest') {
    return 'inbox';
  }
  return 'bell';
}

function getDefaultAccentTokenByType(type: string): NotificationAccentToken {
  if (type === 'graded') {
    return 'success';
  }
  if (type === 'due_soon') {
    return 'warning';
  }
  if (type === 'weekly_digest') {
    return 'neutral';
  }
  return 'info';
}

export function resolveNotificationIconToken(
  iconToken: string | undefined,
  type: string,
): NotificationIconToken {
  const normalized = normalizeText(iconToken);
  if (!normalized) {
    return getDefaultIconTokenByType(type);
  }

  if (isNotificationIconToken(normalized)) {
    return normalized;
  }

  warnUnknownVisualToken('icon', normalized);
  return getDefaultIconTokenByType(type);
}

export function resolveNotificationAccentToken(
  accentToken: string | undefined,
  type: string,
): NotificationAccentToken {
  const normalized = normalizeText(accentToken);
  if (!normalized) {
    return getDefaultAccentTokenByType(type);
  }

  if (isNotificationAccentToken(normalized)) {
    return normalized;
  }

  warnUnknownVisualToken('accent', normalized);
  return getDefaultAccentTokenByType(type);
}

export function getNotificationAccentClass(
  accentToken: string | undefined,
  type: string,
): string {
  const resolved = resolveNotificationAccentToken(accentToken, type);

  if (resolved === 'success') {
    return 'text-green-500';
  }
  if (resolved === 'warning') {
    return 'text-orange-500';
  }
  if (resolved === 'neutral') {
    return 'text-muted-foreground';
  }
  return 'text-blue-500';
}

export function getNotificationIconNode(
  iconToken: string | undefined,
  type: string,
): ReactNode {
  const resolved = resolveNotificationIconToken(iconToken, type);

  if (resolved === 'check-circle') {
    return <CheckCircle2 className="size-5" />;
  }
  if (resolved === 'clock') {
    return <Clock className="size-5" />;
  }
  if (resolved === 'file-text') {
    return <FileText className="size-5" />;
  }
  if (resolved === 'inbox') {
    return <Inbox className="size-5" />;
  }

  return <Bell className="size-5" />;
}
