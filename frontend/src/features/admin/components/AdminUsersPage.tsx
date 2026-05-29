/**
 * Location: features/admin/components/AdminUsersPage.tsx
 * Purpose: Render the Admin Users Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Check, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  useAdminUsersQuery,
  useApproveTeacherMutation,
  useCreateUserMutation,
  useRejectTeacherMutation,
} from '@features/admin/api';
import type { UserRole, UserStatus } from '@lib/backend-schema';

const statusLabels: Record<UserStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  invited: 'Invited',
  suspended: 'Suspended',
};

type UserFormState = {
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

const initialFormState: UserFormState = {
  fullName: '',
  email: '',
  role: 'student',
  status: 'active',
};

function statusBadgeVariant(status: UserStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') {
    return 'default';
  }
  if (status === 'suspended') {
    return 'destructive';
  }
  return 'outline';
}

export function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [transitioningUserId, setTransitioningUserId] = useState<string | null>(null);
  const [formState, setFormState] = useState<UserFormState>(initialFormState);
  const { data: users = [], isLoading, error, refetch } = useAdminUsersQuery();
  const createUserMutation = useCreateUserMutation();
  const approveTeacherMutation = useApproveTeacherMutation();
  const rejectTeacherMutation = useRejectTeacherMutation();

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  const handleTeacherDecision = async (
    userId: string,
    decision: 'approve' | 'reject',
  ) => {
    setTransitioningUserId(userId);
    try {
      if (decision === 'approve') {
        await approveTeacherMutation.mutateAsync(userId);
        toast.success('Teacher approved.');
      } else {
        await rejectTeacherMutation.mutateAsync(userId);
        toast.success('Teacher request rejected.');
      }
    } catch (errorValue) {
      toast.error(
        errorValue instanceof Error
          ? errorValue.message
          : 'Unable to update teacher request.',
      );
    } finally {
      setTransitioningUserId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              Refresh
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 size-4" />
              Add User
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading users...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load users. Please try again later.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => {
                    const canReviewTeacher =
                      user.role === 'teacher' && user.status === 'pending';
                    const isTransitioning = transitioningUserId === user.id;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(user.status)}>
                            {statusLabels[user.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canReviewTeacher ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleTeacherDecision(user.id, 'approve')}
                                disabled={isTransitioning}
                              >
                                <Check className="size-4" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleTeacherDecision(user.id, 'reject')}
                                disabled={isTransitioning}
                              >
                                <X className="size-4" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Full name"
                value={formState.fullName}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                placeholder="email@example.com"
                value={formState.email}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formState.role}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, role: value as UserRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, status: value as UserStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
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
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!formState.fullName.trim() || !formState.email.trim()) {
                  toast.error('Name and email are required.');
                  return;
                }
                try {
                  await createUserMutation.mutateAsync({
                    fullName: formState.fullName.trim(),
                    email: formState.email.trim(),
                    role: formState.role,
                    status: formState.status,
                  });
                  toast.success('User created.');
                  setShowCreateDialog(false);
                  setFormState(initialFormState);
                } catch (errorValue) {
                  toast.error(
                    errorValue instanceof Error ? errorValue.message : 'Unable to create user.',
                  );
                }
              }}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
