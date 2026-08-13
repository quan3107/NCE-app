/**
 * Location: features/admin/settingsApi.ts
 * Purpose: Read and persist admin-managed runtime upload limits.
 * Why: The admin settings page should expose only backend-enforced values.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@lib/apiClient";
import { queryClient } from "@lib/queryClient";

export type UploadLimitRole = "student" | "teacher" | "admin";

export type AdminUploadLimits = {
  limits: Array<{
    role: UploadLimitRole;
    maxFileSizeMib: number;
  }>;
};

export type AdminUploadLimitUpdates = {
  updates: Partial<
    Record<
      UploadLimitRole,
      {
        expectedMaxFileSizeMib: number;
        maxFileSizeMib: number;
      }
    >
  >;
};

export const adminUploadLimitsQueryKey = [
  "admin",
  "settings",
  "upload-limits",
] as const;

export const fetchAdminUploadLimits = (
  signal?: AbortSignal,
): Promise<AdminUploadLimits> =>
  apiClient<AdminUploadLimits>("/api/v1/settings/file-upload-limits", {
    auth: "required",
    signal,
  });

export const updateAdminUploadLimits = (
  payload: AdminUploadLimitUpdates,
): Promise<AdminUploadLimits> =>
  apiClient<AdminUploadLimits, AdminUploadLimitUpdates>(
    "/api/v1/settings/file-upload-limits",
    {
      auth: "required",
      method: "PATCH",
      body: payload,
    },
  );

export function useAdminUploadLimitsQuery() {
  return useQuery({
    queryKey: adminUploadLimitsQueryKey,
    queryFn: ({ signal }) => fetchAdminUploadLimits(signal),
  });
}

export function useUpdateAdminUploadLimitsMutation() {
  return useMutation({
    mutationFn: updateAdminUploadLimits,
    onSuccess: async (limits) => {
      await queryClient.cancelQueries({
        queryKey: adminUploadLimitsQueryKey,
        exact: true,
      });
      queryClient.setQueryData(adminUploadLimitsQueryKey, limits);
      await queryClient.invalidateQueries({
        queryKey: ["config:file-upload"],
      });
    },
  });
}
