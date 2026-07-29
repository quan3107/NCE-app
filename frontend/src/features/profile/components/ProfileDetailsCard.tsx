/**
 * Location: features/profile/components/ProfileDetailsCard.tsx
 * Purpose: Render the shared controlled profile editor for authenticated roles.
 * Why: Student, teacher, and admin profile routes should share persistence and validation.
 */
import { type FormEvent, useState } from "react";
import { Edit } from "lucide-react";

import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { useUpdateMeProfileMutation } from "@features/profile/api";
import { useAuthStore } from "@store/authStore";

const NAME_ERROR = "Name must be between 2 and 100 characters.";

export function ProfileDetailsCard() {
  const { currentUser, updateCurrentUser } = useAuthStore();
  const updateProfile = useUpdateMeProfileMutation();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(currentUser.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const cancelEditing = () => {
    setFullName(currentUser.name);
    setNameError(null);
    setSaveError(null);
    setEditing(false);
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = fullName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setNameError(NAME_ERROR);
      return;
    }

    setNameError(null);
    setSaveError(null);
    try {
      const profile = await updateProfile.mutateAsync({
        fullName: normalizedName,
      });
      updateCurrentUser({ name: profile.fullName });
      setFullName(profile.fullName);
      setEditing(false);
    } catch {
      setSaveError("Unable to save your profile. Please try again.");
    }
  };

  const initials = currentUser.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle>Personal Information</CardTitle>
        <Button
          type="button"
          variant="outline"
          onClick={() => (editing ? cancelEditing() : setEditing(true))}
        >
          <Edit className="mr-2 size-4" />
          {editing ? "Cancel" : "Edit Profile"}
        </Button>
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
