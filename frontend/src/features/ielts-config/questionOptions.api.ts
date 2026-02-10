/**
 * Location: features/ielts-config/questionOptions.api.ts
 * Purpose: Fetch IELTS boolean-question option values from backend config endpoints.
 * Why: Replaces hardcoded true/false and yes/no option arrays with backend-driven values.
 */

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@lib/apiClient';
import type { IeltsQuestionOptionType } from '@lib/backend-schema';

export type IeltsQuestionOption = {
  value: string;
  label: string;
  score: number;
  enabled: boolean;
  sort_order: number;
};

export type IeltsQuestionOptionsResponse = {
  type: IeltsQuestionOptionType;
  version: number;
  options: IeltsQuestionOption[];
};

const IELTS_QUESTION_OPTIONS_QUERY_KEY = 'ielts:question-options';

const FALLBACK_OPTIONS: Record<IeltsQuestionOptionType, IeltsQuestionOption[]> = {
  true_false: [
    { value: 'true', label: 'True', score: 1, enabled: true, sort_order: 1 },
    { value: 'false', label: 'False', score: 0, enabled: true, sort_order: 2 },
    { value: 'not_given', label: 'Not Given', score: 0, enabled: true, sort_order: 3 },
  ],
  yes_no: [
    { value: 'yes', label: 'Yes', score: 1, enabled: true, sort_order: 1 },
    { value: 'no', label: 'No', score: 0, enabled: true, sort_order: 2 },
    { value: 'not_given', label: 'Not Given', score: 0, enabled: true, sort_order: 3 },
  ],
};

const OPTION_VALUE_ALIASES: Record<string, string> = {
  true: 'true',
  false: 'false',
  yes: 'yes',
  no: 'no',
  'not given': 'not_given',
  not_given: 'not_given',
};

export function normalizeQuestionOptionValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  return OPTION_VALUE_ALIASES[normalized] ?? value;
}

function toFallback(type: IeltsQuestionOptionType): IeltsQuestionOptionsResponse {
  return {
    type,
    version: 0,
    options: FALLBACK_OPTIONS[type],
  };
}

function mapOption(option: unknown): IeltsQuestionOption | null {
  if (!option || typeof option !== 'object') {
    return null;
  }

  const record = option as Record<string, unknown>;

  if (typeof record.value !== 'string' || typeof record.label !== 'string') {
    return null;
  }

  return {
    value: normalizeQuestionOptionValue(record.value),
    label: record.label,
    score: typeof record.score === 'number' ? record.score : 0,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    sort_order: typeof record.sort_order === 'number' ? record.sort_order : 0,
  };
}

export async function fetchQuestionOptions(
  type: IeltsQuestionOptionType,
  version?: number,
): Promise<IeltsQuestionOptionsResponse> {
  const query = version ? `?type=${type}&version=${version}` : `?type=${type}`;
  const url = `/api/v1/config/ielts/question-options${query}`;

  try {
    const response = await apiClient<IeltsQuestionOptionsResponse>(url);

    const mappedOptions = Array.isArray(response.options)
      ? response.options
          .map(mapOption)
          .filter((option): option is IeltsQuestionOption => Boolean(option && option.enabled))
      : [];

    if (mappedOptions.length === 0) {
      return toFallback(type);
    }

    return {
      type,
      version: typeof response.version === 'number' ? response.version : 0,
      options: mappedOptions,
    };
  } catch {
    return toFallback(type);
  }
}

export function useQuestionOptions(type: IeltsQuestionOptionType, version?: number) {
  return useQuery({
    queryKey: [IELTS_QUESTION_OPTIONS_QUERY_KEY, type, version],
    queryFn: () => fetchQuestionOptions(type, version),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}

export function useBooleanQuestionOptions() {
  const trueFalseQuery = useQuestionOptions('true_false');
  const yesNoQuery = useQuestionOptions('yes_no');

  return {
    trueFalseOptions: trueFalseQuery.data?.options ?? FALLBACK_OPTIONS.true_false,
    yesNoOptions: yesNoQuery.data?.options ?? FALLBACK_OPTIONS.yes_no,
    isLoading: trueFalseQuery.isLoading || yesNoQuery.isLoading,
  };
}
