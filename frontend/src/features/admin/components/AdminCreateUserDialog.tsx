/**
 * Location: features/admin/components/AdminCreateUserDialog.tsx
 * Purpose: Collect and validate fields for administrator-created users.
 * Why: Every display-name writer must share the backend-compatible policy.
 */

import { useState } from 'react';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { useCreateUserMutation } from '@features/admin/api';
import {
  profileNameFieldError,
  validateProfileDisplayName,
} from '@features/profile/profileValidation';
import type { UserRole, UserStatus } from '@lib/backend-schema';
import { toast } from 'sonner@2.0.3';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialFormState = {
  fullName: '',
  email: '',
  role: 'student' as UserRole,
  status: 'active' as UserStatus,
};

export function AdminCreateUserDialog({ open, onOpenChange }: Props) {
  const [formState, setFormState] = useState(initialFormState);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const createUserMutation = useCreateUserMutation();

  const createUser = async () => {
    const validatedName = validateProfileDisplayName(formState.fullName);
    setFullNameError(validatedName.error);
    if (validatedName.error) return;
    if (!formState.email.trim()) {
      toast.error('Email is required.');
      return;
    }
    try {
      await createUserMutation.mutateAsync({
        fullName: validatedName.normalizedName,
        email: formState.email.trim(),
        role: formState.role,
        status: formState.status,
      });
      toast.success('User created.');
      onOpenChange(false);
      setFormState(initialFormState);
      setFullNameError(null);
    } catch (error) {
      const fieldError = profileNameFieldError(error);
      if (fieldError) setFullNameError(fieldError);
      else {
        toast.error(
          error instanceof Error ? error.message : 'Unable to create user.',
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create a new user account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-full-name">Name</Label>
            <Input
              id="admin-full-name"
              placeholder="Full name"
              value={formState.fullName}
              aria-invalid={Boolean(fullNameError)}
              aria-describedby={fullNameError ? 'admin-full-name-error' : undefined}
              onChange={(event) => {
                setFullNameError(null);
                setFormState((current) => ({
                  ...current,
                  fullName: event.target.value,
                }));
              }}
            />
            {fullNameError && (
              <p id="admin-full-name-error" className="text-sm text-destructive">
                {fullNameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              placeholder="email@example.com"
              value={formState.email}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-role">Role</Label>
            <Select
              value={formState.role}
              onValueChange={(role) =>
                setFormState((current) => ({ ...current, role: role as UserRole }))
              }
            >
              <SelectTrigger id="admin-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-status">Status</Label>
            <Select
              value={formState.status}
              onValueChange={(status) =>
                setFormState((current) => ({
                  ...current,
                  status: status as UserStatus,
                }))
              }
            >
              <SelectTrigger id="admin-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={createUser} disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
