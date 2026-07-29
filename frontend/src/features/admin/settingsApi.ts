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
    maxFileSizeMb: number;
  }>;
};

export type AdminUploadLimitUpdates = {
  updates: Partial<
    Record<
      UploadLimitRole,
      {
        expectedMaxFileSizeMb: number;
        maxFileSizeMb: number;
      }
    >
  >;
};

const ADMIN_UPLOAD_LIMITS_KEY = ["admin", "settings", "upload-limits"] as const;

export const fetchAdminUploadLimits = (): Promise<AdminUploadLimits> =>
  apiClient<AdminUploadLimits>("/api/v1/settings/file-upload-limits");

export const updateAdminUploadLimits = (
  payload: AdminUploadLimitUpdates,
): Promise<AdminUploadLimits> =>
  apiClient<AdminUploadLimits, AdminUploadLimitUpdates>(
    "/api/v1/settings/file-upload-limits",
    {
      method: "PATCH",
      body: payload,
    },
  );

export function useAdminUploadLimitsQuery() {
  return useQuery({
    queryKey: ADMIN_UPLOAD_LIMITS_KEY,
    queryFn: fetchAdminUploadLimits,
  });
}

export function useUpdateAdminUploadLimitsMutation() {
  return useMutation({
    mutationFn: updateAdminUploadLimits,
    onSuccess: async (limits) => {
      queryClient.setQueryData(ADMIN_UPLOAD_LIMITS_KEY, limits);
      await queryClient.invalidateQueries({
        queryKey: ["config:file-upload"],
      });
    },
  });
}
