/**
 * Location: src/features/navigation/api.ts
 * Purpose: Provide navigation-focused API calls and response normalization.
 * Why: Isolates /me navigation parsing and badge count endpoint handling from UI code.
 */

import { ApiError, apiClient } from '@lib/apiClient';

import type { NavigationPayload } from './types';
import { isNavigationPayload } from './types';

type ApiMeResponse = {
  navigation?: unknown;
};

type CountResponse = {
  count: number;
};

export type CountApiResult =
  | {
      ok: true;
      count: number;
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
};

const toFailedCountResult = (error: unknown, fallback: string): CountApiResult => {
  if (error instanceof ApiError) {
    return {
      ok: false,
      error: error.message || fallback,
      status: error.status,
    };
  }

  return {
    ok: false,
    error: toErrorMessage(error, fallback),
  };
};

export async function fetchNavigationFromMe(): Promise<NavigationPayload> {
  const response = await apiClient<ApiMeResponse>('/api/v1/me');

  if (!isNavigationPayload(response.navigation)) {
    throw new Error('Invalid navigation payload returned by /api/v1/me');
  }

  return response.navigation;
}

export async function fetchAssignmentsPendingCount(): Promise<CountApiResult> {
  try {
    const response = await apiClient<CountResponse>('/api/v1/assignments/pending-count');
    if (typeof response.count !== 'number') {
      return {
        ok: false,
        error: 'Invalid assignments count payload.',
      };
    }

    return {
      ok: true,
      count: response.count,
    };
  } catch (error) {
    return toFailedCountResult(error, 'Unable to fetch assignments pending count.');
  }
}

export async function fetchSubmissionsPendingCount(): Promise<CountApiResult> {
  try {
    const response = await apiClient<CountResponse>('/api/v1/submissions/pending-count');
    if (typeof response.count !== 'number') {
      return {
        ok: false,
        error: 'Invalid submissions count payload.',
      };
    }

    return {
      ok: true,
      count: response.count,
    };
  } catch (error) {
    return toFailedCountResult(error, 'Unable to fetch submissions pending count.');
  }
}
