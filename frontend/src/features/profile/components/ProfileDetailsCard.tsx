/**
 * Location: features/profile/components/ProfileDetailsCard.tsx
 * Purpose: Render the shared controlled profile editor for authenticated roles.
 * Why: Student, teacher, and admin profile routes should share persistence and validation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Edit } from "lucide-react";
import { toast } from "sonner@2.0.3";

import { Button } from "@components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { useMeProfileQuery } from "@features/profile/api";
import {
  isTerminalProfileError,
  useProfileSaveLifecycle,
} from "@features/profile/hooks/useProfileSaveLifecycle";
import { getProfileInitials } from "@features/profile/profileInitials";
import { useAuthStore } from "@store/authStore";

const TERMINAL_PROFILE_MESSAGE =
  "This account is no longer available. Please sign in again.";

export function ProfileDetailsCard() {
  const {
    currentUser,
    sessionGeneration,
    commitCurrentProfile,
    refreshCurrentProfile,
    logout,
  } = useAuthStore();
  const profileQuery = useMeProfileQuery(currentUser.id);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(currentUser.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [terminalProfileState, setTerminalProfileState] = useState(false);
  const terminalLogoutStarted = useRef(false);
  const latestIdentity = useRef({
    userId: currentUser.id,
    generation: sessionGeneration,
  });
  const previousUserId = useRef(currentUser.id);
  const requestSequence = useRef(0);
  latestIdentity.current = {
    userId: currentUser.id,
    generation: sessionGeneration,
  };
  const authoritativeName =
    profileQuery.data?.id === currentUser.id
      ? profileQuery.data.fullName
      : currentUser.name;
  const hasAuthoritativeProfile = Boolean(
    profileQuery.data?.id === currentUser.id &&
      !profileQuery.isPending &&
      !profileQuery.error,
  );

  const endTerminalProfileSession = useCallback(() => {
    requestSequence.current += 1;
    setEditing(false);
    setNameError(null);
    setSaveError(TERMINAL_PROFILE_MESSAGE);
    setTerminalProfileState(true);
    if (!terminalLogoutStarted.current) {
      terminalLogoutStarted.current = true;
      void logout().catch(() => {
        terminalLogoutStarted.current = false;
        toast.error("Server logout could not be confirmed.", {
          description: "Retry to prevent the session from being restored.",
          action: { label: "Retry", onClick: endTerminalProfileSession },
        });
      });
    }
  }, [logout]);

  const { isSaving, recordDraftChange, submitProfile } =
    useProfileSaveLifecycle({
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
    });

  useEffect(() => {
    if (previousUserId.current !== currentUser.id) {
      previousUserId.current = currentUser.id;
      setEditing(false);
      setNameError(null);
      setSaveError(null);
      setTerminalProfileState(false);
      terminalLogoutStarted.current = false;
      setFullName(authoritativeName);
      return;
    }

    if (!editing) {
      setFullName(authoritativeName);
    }
  }, [authoritativeName, currentUser.id, editing]);

  useEffect(() => {
    if (isTerminalProfileError(profileQuery.error)) {
      endTerminalProfileSession();
    }
  }, [endTerminalProfileSession, profileQuery.error]);

  useEffect(() => {
    const profile = profileQuery.data;
    if (
      !profile ||
      profile.id !== currentUser.id ||
      (profile.fullName === currentUser.name &&
        profile.email === currentUser.email &&
        profile.role === currentUser.role)
    ) {
      return;
    }
    void commitCurrentProfile(
      { userId: currentUser.id, generation: sessionGeneration },
      profile,
    );
  }, [
    commitCurrentProfile,
    currentUser.id,
    profileQuery.data,
    sessionGeneration,
  ]);

  const cancelEditing = () => {
    setFullName(authoritativeName);
    setNameError(null);
    setSaveError(null);
    setEditing(false);
  };

  const startEditing = () => {
    if (terminalProfileState || !hasAuthoritativeProfile) {
      return;
    }
    setFullName(authoritativeName);
    setNameError(null);
    setSaveError(null);
    setEditing(true);
  };

  const initials = getProfileInitials(currentUser.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            disabled={terminalProfileState || !hasAuthoritativeProfile}
            onClick={() => (editing ? cancelEditing() : startEditing())}
          >
            <Edit className="mr-2 size-4" />
            {editing ? "Cancel" : "Edit Profile"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submitProfile}>
          <div
            className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-[#E6F0FF] to-[#BFD9FF] text-2xl font-medium"
            aria-label="Profile initials"
          >
            {initials}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(event) => {
                recordDraftChange();
                setFullName(event.target.value);
                setNameError(null);
              }}
              disabled={
                terminalProfileState || !editing || isSaving
              }
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "profile-name-error" : undefined}
            />
            {nameError && (
              <p id="profile-name-error" className="text-sm text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={currentUser.email} disabled />
            <p className="text-xs text-muted-foreground">
              Email changes require verification and are not available here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-role">Role</Label>
            <Input
              id="profile-role"
              value={currentUser.role}
              disabled
              className="capitalize"
            />
          </div>
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
          {editing && (
            <Button
              type="submit"
              className="w-full"
              disabled={terminalProfileState || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
