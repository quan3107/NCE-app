/**
 * Location: features/assignments/components/ielts/typeMetadata.ui.ts
 * Purpose: Map backend IELTS type metadata into UI-safe icon and theme rendering values.
 * Why: Keeps card components small while logging unsupported backend metadata clearly.
 */

import type { CSSProperties } from 'react';

import { BookOpen, BookOpenText, Headphones, Mic, Mic2, PenLine, PenTool, type LucideIcon } from 'lucide-react';

import type { IeltsTypeTheme } from '@features/ielts-config/typeMetadata.api';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const iconByName: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  'book-open-text': BookOpenText,
  headphones: Headphones,
  mic: Mic,
  mic2: Mic2,
  'mic-2': Mic2,
  'pen-line': PenLine,
  'pen-tool': PenTool,
};

const FALLBACK_THEME: IeltsTypeTheme = {
  colorFrom: '#F8FAFC',
  colorTo: '#F1F5F9',
  borderColor: '#CBD5E1',
};

function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function resolveTypeIcon(iconName: string): LucideIcon {
  const normalized = iconName.trim().toLowerCase();
  const icon = iconByName[normalized];

  if (icon) {
    return icon;
  }

  console.warn('[ielts-type-metadata] unknown icon; using fallback', {
    iconName,
    fallback: 'book-open',
  });

  return BookOpen;
}

export function resolveTypeTheme(theme: IeltsTypeTheme): IeltsTypeTheme {
  if (
    isHexColor(theme.colorFrom)
    && isHexColor(theme.colorTo)
    && isHexColor(theme.borderColor)
  ) {
    return theme;
  }

  console.warn('[ielts-type-metadata] invalid theme colors; using fallback theme', {
    theme,
    fallbackTheme: FALLBACK_THEME,
  });

  return { ...FALLBACK_THEME };
}

export function buildTypeCardBackgroundStyle(theme: IeltsTypeTheme): CSSProperties {
  const normalizedTheme = resolveTypeTheme(theme);

  return {
    backgroundImage: `linear-gradient(to bottom right, ${normalizedTheme.colorFrom}, ${normalizedTheme.colorTo})`,
    borderColor: normalizedTheme.borderColor,
  };
}

export function buildTypeIconStyle(theme: IeltsTypeTheme): CSSProperties {
  const normalizedTheme = resolveTypeTheme(theme);

  return {
    color: normalizedTheme.borderColor,
  };
}
