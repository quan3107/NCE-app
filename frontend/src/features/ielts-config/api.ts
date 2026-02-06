/**
 * Location: features/ielts-config/api.ts
 * Purpose: React Query hooks for IELTS domain configuration API
 * Why: Provides type-safe access to backend-driven IELTS configuration with no caching
 */

import { useQuery } from '@tanstack/react-query';
import { ApiError, apiClient } from '@lib/apiClient';

const IELTS_CONFIG_KEY = 'ielts:config';
const IELTS_CONFIG_VERSIONS_KEY = 'ielts:config:versions';

// Types matching backend API response
export interface IeltsAssignmentType {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsQuestionType {
  id: string;
  skill_type: 'reading' | 'listening';
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsWritingTaskType {
  id: string;
  task_number: number;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsSpeakingPartType {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsCompletionFormat {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsSampleTimingOption {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
}

export interface IeltsConfig {
  version: number;
  assignment_types: IeltsAssignmentType[];
  question_types: {
    reading: IeltsQuestionType[];
    listening: IeltsQuestionType[];
  };
  writing_task_types: {
    task1: IeltsWritingTaskType[];
    task2: IeltsWritingTaskType[];
  };
  speaking_part_types: IeltsSpeakingPartType[];
  completion_formats: IeltsCompletionFormat[];
  sample_timing_options: IeltsSampleTimingOption[];
}

export interface IeltsConfigVersion {
  version: number;
  name: string;
  description?: string;
  is_active: boolean;
  activated_at?: string;
  created_at: string;
}

export interface IeltsConfigVersionsResponse {
  versions: IeltsConfigVersion[];
  active_version: number;
}

// API Error type
export interface IeltsConfigError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

type IeltsConfigErrorPayload = {
  error?: {
    message?: string;
  };
};

function getIeltsConfigErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const details =
      error.details && typeof error.details === 'object'
        ? (error.details as IeltsConfigErrorPayload)
        : undefined;
    const nestedMessage =
      details?.error && typeof details.error.message === 'string'
        ? details.error.message
        : undefined;
    return nestedMessage ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

/**
 * Fetch active IELTS configuration
 */
async function fetchIeltsConfig(version?: number): Promise<IeltsConfig> {
  const url = version 
    ? `/api/v1/config/ielts?version=${version}`
    : '/api/v1/config/ielts';

  try {
    return await apiClient<IeltsConfig>(url);
  } catch (error) {
    throw new Error(
      getIeltsConfigErrorMessage(error, 'Failed to fetch IELTS configuration'),
    );
  }
}

/**
 * Fetch all IELTS configuration versions
 */
async function fetchIeltsConfigVersions(): Promise<IeltsConfigVersionsResponse> {
  try {
    return await apiClient<IeltsConfigVersionsResponse>('/api/v1/config/ielts/versions');
  } catch (error) {
    throw new Error(
      getIeltsConfigErrorMessage(error, 'Failed to fetch IELTS configuration versions'),
    );
  }
}

/**
 * React Query hook for IELTS configuration
 * No caching - fresh fetch every time
 */
export function useIeltsConfig(version?: number) {
  return useQuery({
    queryKey: [IELTS_CONFIG_KEY, version],
    queryFn: () => fetchIeltsConfig(version),
    // No caching
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}

/**
 * React Query hook for IELTS configuration versions
 * No caching - fresh fetch every time
 */
export function useIeltsConfigVersions() {
  return useQuery({
    queryKey: [IELTS_CONFIG_VERSIONS_KEY],
    queryFn: fetchIeltsConfigVersions,
    // No caching
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
}

/**
 * Helper to get enabled assignment types only
 */
export function useEnabledAssignmentTypes() {
  const { data, ...rest } = useIeltsConfig();
  
  const enabledTypes = data?.assignment_types.filter(at => at.enabled) ?? [];
  
  return {
    data: enabledTypes,
    ...rest,
  };
}

/**
 * Helper to get enabled reading question types
 */
export function useEnabledReadingQuestionTypes() {
  const { data, ...rest } = useIeltsConfig();
  
  const enabledTypes = data?.question_types.reading.filter(qt => qt.enabled) ?? [];
  
  return {
    data: enabledTypes,
    ...rest,
  };
}

/**
 * Helper to get enabled listening question types
 */
export function useEnabledListeningQuestionTypes() {
  const { data, ...rest } = useIeltsConfig();
  
  const enabledTypes = data?.question_types.listening.filter(qt => qt.enabled) ?? [];
  
  return {
    data: enabledTypes,
    ...rest,
  };
}

/**
 * Helper to get enabled writing task types
 */
export function useEnabledWritingTaskTypes(taskNumber: 1 | 2) {
  const { data, ...rest } = useIeltsConfig();
  
  const taskTypes = taskNumber === 1 
    ? data?.writing_task_types.task1 
    : data?.writing_task_types.task2;
  
  const enabledTypes = taskTypes?.filter(wt => wt.enabled) ?? [];
  
  return {
    data: enabledTypes,
    ...rest,
  };
}

/**
 * Helper to get enabled speaking part types
 */
export function useEnabledSpeakingPartTypes() {
  const { data, ...rest } = useIeltsConfig();
  
  const enabledTypes = data?.speaking_part_types.filter(spt => spt.enabled) ?? [];
  
  return {
    data: enabledTypes,
    ...rest,
  };
}

/**
 * Helper to get enabled completion formats
 */
export function useEnabledCompletionFormats() {
  const { data, ...rest } = useIeltsConfig();
  
  const enabledFormats = data?.completion_formats.filter(cf => cf.enabled) ?? [];
  
  return {
    data: enabledFormats,
    ...rest,
  };
}

/**
 * Helper to get enabled sample timing options
 */
export function useEnabledSampleTimingOptions() {
  const { data, ...rest } = useIeltsConfig();
  
  const enabledOptions = data?.sample_timing_options.filter(sto => sto.enabled) ?? [];
  
  return {
    data: enabledOptions,
    ...rest,
  };
}
