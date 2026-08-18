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
import { Ban, Check, Plus, Search, Trash2, UserRoundCheck, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  useAdminUsersQuery,
  useApproveTeacherMutation,
  useDeleteManagedUserMutation,
  useRejectTeacherMutation,
  useUpdateManagedUserStatusMutation,
} from '@features/admin/api';
import type { UserStatus } from '@lib/backend-schema';
import { AdminCreateUserDialog } from './AdminCreateUserDialog';

const statusLabels: Record<UserStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  invited: 'Invited',
  suspended: 'Suspended',
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
  const { data: users = [], isLoading, error, refetch } = useAdminUsersQuery();
  const approveTeacherMutation = useApproveTeacherMutation();
  const rejectTeacherMutation = useRejectTeacherMutation();
  const statusMutation = useUpdateManagedUserStatusMutation();
  const deleteMutation = useDeleteManagedUserMutation();

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

  const handleStatusChange = async (
    userId: string,
    status: 'active' | 'suspended',
  ) => {
    setTransitioningUserId(userId);
    try {
      await statusMutation.mutateAsync({ userId, status });
      toast.success(status === 'suspended' ? 'User suspended.' : 'User reactivated.');
    } catch (errorValue) {
      toast.error(errorValue instanceof Error ? errorValue.message : 'Unable to update user.');
    } finally {
      setTransitioningUserId(null);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!window.confirm(`Delete ${email}? This account will lose access immediately.`)) {
      return;
    }
    setTransitioningUserId(userId);
    try {
      await deleteMutation.mutateAsync(userId);
      toast.success('User deleted.');
    } catch (errorValue) {
      toast.error(errorValue instanceof Error ? errorValue.message : 'Unable to delete user.');
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
                    const canManageAccount = user.role !== 'admin';

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
                          {canManageAccount ? (
                            <div className="flex justify-end gap-2">
                              {canReviewTeacher ? (
                                <>
                                  <Button size="sm" onClick={() => handleTeacherDecision(user.id, 'approve')} disabled={isTransitioning}>
                                    <Check className="size-4" /> Approve
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleTeacherDecision(user.id, 'reject')} disabled={isTransitioning}>
                                    <X className="size-4" /> Reject
                                  </Button>
                                </>
                              ) : user.status === 'active' ? (
                                <Button variant="outline" size="sm" onClick={() => handleStatusChange(user.id, 'suspended')} disabled={isTransitioning}>
                                  <Ban className="size-4" /> Suspend
                                </Button>
                              ) : user.status === 'suspended' ? (
                                <Button variant="outline" size="sm" onClick={() => handleStatusChange(user.id, 'active')} disabled={isTransitioning}>
                                  <UserRoundCheck className="size-4" /> Reactivate
                                </Button>
                              ) : null}
                              <Button variant="destructive" size="sm" onClick={() => void handleDelete(user.id, user.email)} disabled={isTransitioning}>
                                <Trash2 className="size-4" /> Delete
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

      <AdminCreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
