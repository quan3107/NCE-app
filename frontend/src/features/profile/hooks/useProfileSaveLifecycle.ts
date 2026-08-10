/**
 * Location: features/profile/hooks/useProfileSaveLifecycle.ts
 * Purpose: Coordinate profile PATCH acknowledgement and GET reconciliation.
 * Why: Save ordering, identity fencing, and draft protection form one lifecycle.
 */
import {
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
  useRef,
} from "react";

import {
  type MeProfile,
  useUpdateMeProfileMutation,
} from "@features/profile/api";
import {
  profileNameFieldError,
  validateProfileDisplayName,
} from "@features/profile/profileValidation";
import { ApiError } from "@lib/apiClient";
import type { AuthContextType, SessionIdentity } from "@lib/auth-types";

const PROFILE_SYNC_MESSAGE =
  "Changes saved, but the latest profile could not be synchronized. Refresh to verify.";

export const isTerminalProfileError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.status === 404);

type ProfileSaveLifecycleOptions = {
  commitCurrentProfile: AuthContextType["commitCurrentProfile"];
  endTerminalProfileSession: () => void;
  fullName: string;
  latestIdentity: MutableRefObject<SessionIdentity>;
  refreshCurrentProfile: AuthContextType["refreshCurrentProfile"];
  requestSequence: MutableRefObject<number>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setFullName: Dispatch<SetStateAction<string>>;
  setNameError: Dispatch<SetStateAction<string | null>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
};

export function useProfileSaveLifecycle({
  commitCurrentProfile,
  endTerminalProfileSession,
  fullName,
  latestIdentity,
  refreshCurrentProfile,
  requestSequence,
  setEditing,
  setFullName,
  setNameError,
  setSaveError,
}: ProfileSaveLifecycleOptions) {
  const updateProfile = useUpdateMeProfileMutation();
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
    const initiatingIdentity = { ...latestIdentity.current };
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const submittedDraftRevision = draftRevision.current;
    const isCurrentSave = () =>
      requestSequence.current === requestId &&
      latestIdentity.current.userId === initiatingIdentity.userId &&
      latestIdentity.current.generation === initiatingIdentity.generation;
    let savedProfile: MeProfile;
    try {
      savedProfile = await updateProfile.mutateAsync({
        fullName: validation.normalizedName,
      });
    } catch (error) {
      if (isCurrentSave()) {
        if (isTerminalProfileError(error)) {
          endTerminalProfileSession();
          return;
        }
        const fieldError = profileNameFieldError(error);
        if (fieldError) setNameError(fieldError);
        else setSaveError("Unable to save your profile. Please try again.");
      }
      return;
    }

    if (!isCurrentSave()) return;
    try {
      const committed = await commitCurrentProfile(
        initiatingIdentity,
        savedProfile,
      );
      if (!isCurrentSave()) return;
      if (!committed) {
        setSaveError(PROFILE_SYNC_MESSAGE);
        return;
      }
      if (draftRevision.current === submittedDraftRevision) {
        setFullName(savedProfile.fullName);
        setEditing(false);
      }
      const profile = await refreshCurrentProfile(initiatingIdentity);
      if (
        profile &&
        isCurrentSave() &&
        draftRevision.current === submittedDraftRevision
      ) {
        setFullName(profile.fullName);
      }
    } catch (error) {
      if (!isCurrentSave()) return;
      if (isTerminalProfileError(error)) {
        endTerminalProfileSession();
        return;
      }
      setSaveError(PROFILE_SYNC_MESSAGE);
    }
  };

  return {
    isSaving: updateProfile.isPending,
    recordDraftChange,
    submitProfile,
  };
}
