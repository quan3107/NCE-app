/**
 * Location: features/ielts-config/typeMetadata.api.ts
 * Purpose: Fetch backend-driven IELTS type-card metadata for assignment type selectors.
 * Why: Replaces hardcoded card labels/descriptions/icons/themes with config endpoint values.
 */

import { useQuery } from '@tanstack/react-query';

import { ApiError, apiClient } from '@lib/apiClient';
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

const IELTS_TYPE_METADATA_FALLBACK: IeltsTypeMetadata[] = [
  {
    id: 'reading',
    title: 'Reading',
    description: 'Create a reading test with passages and questions',
    icon: 'book-open',
    theme: {
      colorFrom: '#EFF6FF',
      colorTo: '#DBEAFE',
      borderColor: '#BFDBFE',
    },
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'listening',
    title: 'Listening',
    description: 'Build a listening test with audio sections',
    icon: 'headphones',
    theme: {
      colorFrom: '#FAF5FF',
      colorTo: '#F3E8FF',
      borderColor: '#E9D5FF',
    },
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 'writing',
    title: 'Writing',
    description: 'Design Task 1 and Task 2 writing prompts',
    icon: 'pen-tool',
    theme: {
      colorFrom: '#F0FDF4',
      colorTo: '#DCFCE7',
      borderColor: '#BBF7D0',
    },
    enabled: true,
    sortOrder: 3,
  },
  {
    id: 'speaking',
    title: 'Speaking',
    description: 'Set up speaking test with all three parts',
    icon: 'mic',
    theme: {
      colorFrom: '#FFF7ED',
      colorTo: '#FFEDD5',
      borderColor: '#FED7AA',
    },
    enabled: true,
    sortOrder: 4,
  },
];

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

function toFallbackMetadata(): IeltsTypeMetadata[] {
  return IELTS_TYPE_METADATA_FALLBACK.map((item) => ({
    ...item,
    theme: { ...item.theme },
  }));
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

  try {
    const response = await apiClient<IeltsTypeMetadataResponse>(
      `/api/v1/config/ielts/type-metadata${query}`,
    );

    if (!Array.isArray(response.types)) {
      console.warn('[ielts-type-metadata] invalid payload; using fallback', {
        endpoint: '/api/v1/config/ielts/type-metadata',
        reason: 'types_not_array',
        fallbackCount: IELTS_TYPE_METADATA_FALLBACK.length,
      });
      return toFallbackMetadata();
    }

    const mapped = response.types
      .map(mapTypeMetadata)
      .filter((item): item is IeltsTypeMetadata => Boolean(item && item.enabled));

    if (mapped.length === 0 && response.types.length > 0) {
      console.warn('[ielts-type-metadata] invalid rows; using fallback', {
        endpoint: '/api/v1/config/ielts/type-metadata',
        reason: 'rows_invalid',
        rowCount: response.types.length,
        fallbackCount: IELTS_TYPE_METADATA_FALLBACK.length,
      });
      return toFallbackMetadata();
    }

    return mapped.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;

    console.error('[ielts-type-metadata] backend unavailable; using fallback', {
      endpoint: '/api/v1/config/ielts/type-metadata',
      status,
      reason: 'request_failed',
      fallbackCount: IELTS_TYPE_METADATA_FALLBACK.length,
    });

    return toFallbackMetadata();
  }
}

export function useIeltsTypeMetadata(version?: number) {
  return useQuery({
    queryKey: [IELTS_TYPE_METADATA_QUERY_KEY, version],
    queryFn: () => fetchIeltsTypeMetadata(version),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}

export function getIeltsTypeMetadataFallback(): IeltsTypeMetadata[] {
  return toFallbackMetadata();
}
