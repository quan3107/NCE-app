/**
 * Location: features/profile/hooks/useProfileSaveLifecycle.ts
 * Purpose: Coordinate profile PATCH acknowledgement and draft protection.
 * Why: The PATCH response owns the /me cache; auth state never owns profile edits.
 */

import {
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
  useRef,
} from "react";

import { useUpdateMeProfileMutation } from "@features/profile/api";
import {
  profileNameFieldError,
  validateProfileDisplayName,
} from "@features/profile/profileValidation";
import { ApiError } from "@lib/apiClient";

export const isTerminalProfileError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.status === 404);

type ProfileIdentity = { userId: string; generation: number };

type ProfileSaveLifecycleOptions = {
  endTerminalProfileSession: () => void;
  fullName: string;
  latestIdentity: MutableRefObject<ProfileIdentity>;
  requestSequence: MutableRefObject<number>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setFullName: Dispatch<SetStateAction<string>>;
  setNameError: Dispatch<SetStateAction<string | null>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
};

export function useProfileSaveLifecycle({
  endTerminalProfileSession,
  fullName,
  latestIdentity,
  requestSequence,
  setEditing,
  setFullName,
  setNameError,
  setSaveError,
}: ProfileSaveLifecycleOptions) {
  const updateProfile = useUpdateMeProfileMutation(
    latestIdentity.current.userId,
  );
  const draftRevision = useRef(0);

  const recordDraftChange = () => {
    draftRevision.current += 1;
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateProfileDisplayName(fullName);
    if (validation.error) {
      setNameError(validation.error);
      return;
    }
    setNameError(null);
    setSaveError(null);
    const identity = { ...latestIdentity.current };
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const submittedDraft = draftRevision.current;
    const isCurrent = () =>
      requestSequence.current === requestId &&
      latestIdentity.current.userId === identity.userId &&
      latestIdentity.current.generation === identity.generation;
    try {
      const saved = await updateProfile.mutateAsync({
        fullName: validation.normalizedName,
      });
      if (!isCurrent()) return;
      if (draftRevision.current === submittedDraft) {
        setFullName(saved.fullName);
        setEditing(false);
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (isTerminalProfileError(error)) {
        endTerminalProfileSession();
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setSaveError(
          "Your profile changed elsewhere. Review the latest name and try again.",
        );
        return;
      }
      const fieldError = profileNameFieldError(error);
      if (fieldError) setNameError(fieldError);
      else setSaveError("Unable to save your profile. Please try again.");
    }
  };

  return {
    isSaving: updateProfile.isPending,
    recordDraftChange,
    submitProfile,
  };
}
