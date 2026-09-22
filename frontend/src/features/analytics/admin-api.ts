/** Admin analytics use the server's aggregate contract and explicit filter scope. */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';
import type { AdminAnalytics } from '../../../../backend/src/modules/analytics/admin-analytics.types';

export type { AdminAnalytics };
export type AdminFilters = { from: string; to: string; courseId?: string };
export function useAdminAnalytics(filters: AdminFilters) {
  return useQuery({
    queryKey: ['analytics', 'admin', filters],
    queryFn: () =>
      apiClient<AdminAnalytics>('/api/v1/analytics/admin', {
        auth: 'required',
        params: filters,
      }),
    retry: false,
  });
}
