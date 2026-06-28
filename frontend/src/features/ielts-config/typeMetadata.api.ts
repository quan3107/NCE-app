/**
 * Location: features/ielts-config/typeMetadata.api.ts
 * Purpose: Fetch backend-driven IELTS type-card metadata for assignment type selectors.
 * Why: Replaces hardcoded card labels/descriptions/icons/themes with config endpoint values.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import { isIeltsAssignmentType, type IeltsAssignmentType } from '@lib/ielts';

export type IeltsTypeTheme = {
  colorFrom: string;
  colorTo: string;
  borderColor: string;
};

export type IeltsTypeMetadata = {
  id: IeltsAssignmentType;
  title: string;
  description: string;
  icon: string;
  theme: IeltsTypeTheme;
  enabled: boolean;
  sortOrder: number;
};

type IeltsTypeThemeApi = {
  color_from: string;
  color_to: string;
  border_color: string;
};

type IeltsTypeMetadataApi = {
  id: string;
  title: string;
  description: string;
  icon: string;
  theme: IeltsTypeThemeApi;
  enabled: boolean;
  sort_order: number;
};

type IeltsTypeMetadataResponse = {
  version: number;
  types: IeltsTypeMetadataApi[];
};

const IELTS_TYPE_METADATA_QUERY_KEY = 'ielts:type-metadata';

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapTheme(value: unknown): IeltsTypeTheme | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const colorFrom = normalizeText(record.color_from);
  const colorTo = normalizeText(record.color_to);
  const borderColor = normalizeText(record.border_color);

  if (!colorFrom || !colorTo || !borderColor) {
    return null;
  }

  return {
    colorFrom,
    colorTo,
    borderColor,
  };
}

function mapTypeMetadata(value: unknown): IeltsTypeMetadata | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id);
  const title = normalizeText(record.title);
  const description = normalizeText(record.description);
  const icon = normalizeText(record.icon);
  const theme = mapTheme(record.theme);

  if (!id || !isIeltsAssignmentType(id) || !title || !description || !icon || !theme) {
    return null;
  }

  return {
    id,
    title,
    description,
    icon,
    theme,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    sortOrder: typeof record.sort_order === 'number' ? record.sort_order : 0,
  };
}

export async function fetchIeltsTypeMetadata(version?: number): Promise<IeltsTypeMetadata[]> {
  const query = typeof version === 'number' ? `?version=${version}` : '';

  const response = await apiClient<IeltsTypeMetadataResponse>(
    `/api/v1/config/ielts/type-metadata${query}`,
  );

  if (!Array.isArray(response.types)) {
    throw new Error('Invalid IELTS type metadata payload returned by API.');
  }

  const mapped = response.types
    .map(mapTypeMetadata)
    .filter((item): item is IeltsTypeMetadata => Boolean(item && item.enabled));

  if (mapped.length === 0 && response.types.length > 0) {
    throw new Error('Invalid IELTS type metadata rows returned by API.');
  }

  return mapped.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function useIeltsTypeMetadata(version?: number) {
  return useQuery({
    queryKey: [IELTS_TYPE_METADATA_QUERY_KEY, version],
    queryFn: () => fetchIeltsTypeMetadata(version),
    staleTime: 0,
    gcTime: 0,
    retry: 0,
  });
}
