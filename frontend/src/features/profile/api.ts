/**
 * Location: features/profile/api.ts
 * Purpose: Persist the authenticated user's editable profile fields.
 * Why: Profile pages need one mutation contract and a synchronized query cache.
 */
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "@lib/apiClient";
import type { CurrentProfile } from "@lib/auth-types";
import { queryClient } from "@lib/queryClient";
import {
  publishProfileInvalidation,
  subscribeToProfileInvalidation,
} from "@lib/shared-profile-invalidation";

export type MeProfile = CurrentProfile;

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
  const response = await apiClient<MeResponse>("/api/v1/me", {
    auth: "required",
    signal,
  });
  return response.profile;
};

export const updateMeProfile = async (
  payload: UpdateMeProfilePayload,
): Promise<MeProfile> =>
  apiClient<MeProfile, UpdateMeProfilePayload>("/api/v1/me", {
    auth: "required",
    method: "PATCH",
    body: payload,
  });

export function useMeProfileQuery(userId: string) {
  const query = useQuery({
    queryKey: meProfileQueryKey(userId),
    queryFn: ({ signal }) => fetchMeProfile(signal),
    enabled: Boolean(userId),
  });
  useEffect(
    () =>
      subscribeToProfileInvalidation((invalidation) => {
        if (invalidation.userId === userId) void query.refetch();
      }),
    [query.refetch, userId],
  );
  return query;
}

export function useUpdateMeProfileMutation(userId: string) {
  return useMutation({
    mutationFn: updateMeProfile,
    onSuccess: async (profile) => {
      if (profile.id !== userId) return;
      const queryKey = meProfileQueryKey(userId);
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData(queryKey, profile);
      publishProfileInvalidation({ userId });
    },
  });
}
