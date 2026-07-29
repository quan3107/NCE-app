/**
 * Location: features/profile/api.ts
 * Purpose: Persist the authenticated user's editable profile fields.
 * Why: Profile pages need one mutation contract and a synchronized query cache.
 */
import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@lib/apiClient";
import { queryClient } from "@lib/queryClient";
import type { UserRole, UserStatus } from "@lib/backend-schema";

export const ME_PROFILE_QUERY_KEY = ["me", "profile"] as const;

export type MeProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

export type UpdateMeProfilePayload = {
  fullName: string;
};

export const updateMeProfile = async (
  payload: UpdateMeProfilePayload,
): Promise<MeProfile> =>
  apiClient<MeProfile, UpdateMeProfilePayload>("/api/v1/me", {
    method: "PATCH",
    body: payload,
  });

export function useUpdateMeProfileMutation() {
  return useMutation({
    mutationFn: updateMeProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(ME_PROFILE_QUERY_KEY, profile);
    },
  });
}
