/**
 * Location: features/profile/components/ProfileDetailsCard.tsx
 * Purpose: Render the shared controlled profile editor for authenticated roles.
 * Why: Student, teacher, and admin profile routes should share persistence and validation.
 */
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Edit } from "lucide-react";

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
import {
  useMeProfileQuery,
  useUpdateMeProfileMutation,
} from "@features/profile/api";
import { getProfileInitials } from "@features/profile/profileInitials";
import {
  profileNameFieldError,
  validateProfileDisplayName,
} from "@features/profile/profileValidation";
import { useAuthStore } from "@store/authStore";

export function ProfileDetailsCard() {
  const { currentUser, sessionGeneration, commitCurrentProfile } = useAuthStore();
  const profileQuery = useMeProfileQuery(currentUser.id);
  const updateProfile = useUpdateMeProfileMutation();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(currentUser.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    if (previousUserId.current !== currentUser.id) {
      previousUserId.current = currentUser.id;
      setEditing(false);
      setNameError(null);
      setSaveError(null);
      setFullName(authoritativeName);
      return;
    }

    if (!editing) {
      setFullName(authoritativeName);
    }
  }, [authoritativeName, currentUser.id, editing]);

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
    setFullName(authoritativeName);
    setNameError(null);
    setSaveError(null);
    setEditing(true);
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
    try {
      const profile = await updateProfile.mutateAsync({
        fullName: validation.normalizedName,
      });
      if (
        requestSequence.current !== requestId ||
        !(await commitCurrentProfile(initiatingIdentity, profile))
      ) {
        return;
      }
      setFullName(profile.fullName);
      setEditing(false);
    } catch (error) {
      const identityStillCurrent =
        latestIdentity.current.userId === initiatingIdentity.userId &&
        latestIdentity.current.generation === initiatingIdentity.generation;
      if (requestSequence.current === requestId && identityStillCurrent) {
        const fieldError = profileNameFieldError(error);
        if (fieldError) {
          setNameError(fieldError);
        } else {
          setSaveError("Unable to save your profile. Please try again.");
        }
      }
    }
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
                setFullName(event.target.value);
                setNameError(null);
              }}
              disabled={!editing || updateProfile.isPending}
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
            <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
