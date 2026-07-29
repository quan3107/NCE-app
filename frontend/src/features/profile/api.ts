/**
 * Location: features/profile/api.ts
 * Purpose: Persist the authenticated user's editable profile fields.
 * Why: Profile pages need one mutation contract and a synchronized query cache.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@lib/apiClient";
import type { UserRole, UserStatus } from "@lib/backend-schema";

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

type MeResponse = {
  profile: MeProfile;
};

export const meProfileQueryKey = (userId: string) =>
  ["identity", userId, "profile"] as const;

export const fetchMeProfile = async (
  signal?: AbortSignal,
): Promise<MeProfile> => {
  const response = await apiClient<MeResponse>("/api/v1/me", { signal });
  return response.profile;
};

export const updateMeProfile = async (
  payload: UpdateMeProfilePayload,
): Promise<MeProfile> =>
  apiClient<MeProfile, UpdateMeProfilePayload>("/api/v1/me", {
    method: "PATCH",
    body: payload,
  });

export function useMeProfileQuery(userId: string) {
  return useQuery({
    queryKey: meProfileQueryKey(userId),
    queryFn: ({ signal }) => fetchMeProfile(signal),
    enabled: Boolean(userId),
  });
}

export function useUpdateMeProfileMutation() {
  return useMutation({
    mutationFn: updateMeProfile,
  });
}
