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
import { Plus, Search, Edit } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAdminUsersQuery, useCreateUserMutation } from '@features/admin/api';

export function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    role: 'student',
    status: 'active',
  });
  const { data: users = [], isLoading, error, refetch } = useAdminUsersQuery();
  const createUserMutation = useCreateUserMutation();

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Edit className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
                  setFormState((current) => ({ ...current, role: value }))
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
                  setFormState((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
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
                    role: formState.role as 'admin' | 'teacher' | 'student',
                    status: formState.status as 'active' | 'invited' | 'suspended',
                  });
                  toast.success('User created.');
                  setShowCreateDialog(false);
                  setFormState({
                    fullName: '',
                    email: '',
                    role: 'student',
                    status: 'active',
                  });
                } catch (errorValue) {
                  toast.error(
                    errorValue instanceof Error ? errorValue.message : 'Unable to create user.',
                  );
                }
              }}
              disabled={createUserMutation.isLoading}
            >
              {createUserMutation.isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
