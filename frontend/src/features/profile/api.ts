/**
 * Location: features/profile/api.ts
 * Purpose: Persist the authenticated user's editable profile fields.
 * Why: Profile pages need one mutation contract and a synchronized query cache.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError, apiClient } from "@lib/apiClient";
import { authBridge } from "@lib/authBridge";
import type { CurrentProfile } from "@lib/auth-types";
import { queryClient } from "@lib/queryClient";
import { publishProfileInvalidation } from "@lib/shared-profile-invalidation";

export type MeProfile = CurrentProfile;

export type ProfileAuthority = {
  userId: string;
  role: string;
  revision: number;
};

export type UpdateMeProfilePayload = {
  fullName: string;
  expectedRevision: number;
};

type UpdateMeProfileRequest = UpdateMeProfilePayload;

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
  const current = queryClient.getQueryData<MeProfile>(
    meProfileQueryKey(response.profile.id),
  );
  return newerProfile(current, response.profile);
};

export const updateMeProfile = async (
  payload: UpdateMeProfileRequest,
): Promise<MeProfile> =>
  apiClient<MeProfile, UpdateMeProfileRequest>("/api/v1/me", {
    auth: "required",
    method: "PATCH",
    body: payload,
  });

const newerProfile = (
  current: MeProfile | undefined,
  incoming: MeProfile,
): MeProfile =>
  current?.id === incoming.id &&
  current.profileRevision > incoming.profileRevision
    ? current
    : incoming;

export function captureProfileAuthority(): ProfileAuthority | null {
  const snapshot = authBridge.getSnapshot();
  if (snapshot.status !== "authenticated") return null;
  return {
    userId: snapshot.actor.id,
    role: snapshot.actor.role,
    revision: snapshot.revision,
  };
}

export function isProfileAuthorityCurrent(
  authority: ProfileAuthority,
): boolean {
  const snapshot = authBridge.getSnapshot();
  return (
    snapshot.status === "authenticated" &&
    snapshot.actor.id === authority.userId &&
    snapshot.actor.role === authority.role &&
    snapshot.revision === authority.revision
  );
}

const profileAuthorityError = () =>
  new ApiError("Profile ownership changed while the request was in flight.", 0);

export function useMeProfileQuery(userId: string) {
  return useQuery({
    queryKey: meProfileQueryKey(userId),
    queryFn: ({ signal }) => fetchMeProfile(signal),
    enabled: Boolean(userId),
  });
}

export function useUpdateMeProfileMutation(userId: string) {
  const mutation = useMutation({
    mutationFn: async (payload: UpdateMeProfilePayload) => {
      const authority = captureProfileAuthority();
      if (!authority || authority.userId !== userId) {
        throw profileAuthorityError();
      }
      const queryKey = meProfileQueryKey(userId);
      let profile: MeProfile;
      try {
        profile = await updateMeProfile(payload);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          await queryClient.invalidateQueries({ queryKey, exact: true });
        }
        throw error;
      }
      if (
        !isProfileAuthorityCurrent(authority) ||
        profile.id !== authority.userId ||
        profile.role !== authority.role
      ) {
        throw profileAuthorityError();
      }
      return { authority, profile };
    },
    onSuccess: async ({ authority, profile }) => {
      if (!isProfileAuthorityCurrent(authority)) return;
      const queryKey = meProfileQueryKey(userId);
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!isProfileAuthorityCurrent(authority)) return;
      let accepted = false;
      queryClient.setQueryData<MeProfile>(queryKey, (current) => {
        const next = newerProfile(current, profile);
        accepted = next === profile;
        return next;
      });
      if (!isProfileAuthorityCurrent(authority)) return;
      if (accepted) publishProfileInvalidation({ userId });
    },
  });
  return {
    isPending: mutation.isPending,
    mutateAsync: async (payload: UpdateMeProfilePayload) => {
      const result = await mutation.mutateAsync(payload);
      const current = queryClient.getQueryData<MeProfile>(
        meProfileQueryKey(result.authority.userId),
      );
      if (
        !isProfileAuthorityCurrent(result.authority) ||
        !current ||
        current.id !== result.authority.userId ||
        current.role !== result.authority.role
      ) {
        throw profileAuthorityError();
      }
      return current;
    },
  };
}
