/**
 * Location: features/admin/components/AdminEnrollmentsPage.tsx
 * Purpose: Render the Admin Enrollments Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { formatDate } from '@lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  useAdminEnrollmentsQuery,
  useAdminUsersQuery,
  useCreateEnrollmentMutation,
  useRemoveEnrollmentMutation,
} from '@features/admin/api';
import { useCoursesQuery } from '@features/courses/api';
import type { EnrollmentRole } from '@lib/backend-schema';

export function AdminEnrollmentsPage() {
  const enrollmentsQuery = useAdminEnrollmentsQuery();
  const usersQuery = useAdminUsersQuery();
  const coursesQuery = useCoursesQuery();
  const createEnrollmentMutation = useCreateEnrollmentMutation();
  const removeEnrollmentMutation = useRemoveEnrollmentMutation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formState, setFormState] = useState({
    courseId: '',
    userId: '',
    roleInCourse: 'student',
  });

  const isLoading = enrollmentsQuery.isLoading || usersQuery.isLoading || coursesQuery.isLoading;
  const error = enrollmentsQuery.error ?? usersQuery.error ?? coursesQuery.error ?? null;

  const rows = useMemo(() => {
    const enrollments = enrollmentsQuery.data ?? [];
    const users = usersQuery.data ?? [];
    const courses = coursesQuery.data ?? [];

    return enrollments.map(enrollment => {
      const user = users.find(u => u.id === enrollment.userId);
      const course = courses.find(c => c.id === enrollment.courseId);

      return {
        id: enrollment.id,
        userName: user?.name ?? 'Unknown User',
        courseTitle: course?.title ?? 'Unknown Course',
        enrolledAt: enrollment.enrolledAt,
        courseId: enrollment.courseId,
        userId: enrollment.userId,
        roleInCourse: enrollment.roleInCourse,
      };
    });
  }, [enrollmentsQuery.data, usersQuery.data, coursesQuery.data]);

  const handleRefresh = async () => {
    await Promise.all([enrollmentsQuery.refetch(), usersQuery.refetch(), coursesQuery.refetch()]);
  };

  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Manage student enrollments"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 size-4" />
              Enroll Student
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading enrollments...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load enrollments. Please try again later.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell>{row.courseTitle}</TableCell>
                      <TableCell className="capitalize">{row.roleInCourse}</TableCell>
                      <TableCell>{formatDate(row.enrolledAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await removeEnrollmentMutation.mutateAsync({
                                enrollmentId: row.id,
                              });
                              toast.success('Enrollment removed.');
                            } catch (errorValue) {
                              toast.error(
                                errorValue instanceof Error
                                  ? errorValue.message
                                  : 'Unable to remove enrollment.',
                              );
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
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
            <DialogTitle>Enroll Student</DialogTitle>
            <DialogDescription>Add a user to a course.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select
                value={formState.courseId}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, courseId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {(coursesQuery.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={formState.userId}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, userId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {(usersQuery.data ?? []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formState.roleInCourse}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, roleInCourse: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!formState.courseId || !formState.userId) {
                  toast.error('Course and user are required.');
                  return;
                }
                try {
                  await createEnrollmentMutation.mutateAsync({
                    courseId: formState.courseId,
                    userId: formState.userId,
                    roleInCourse: formState.roleInCourse as EnrollmentRole,
                  });
                  toast.success('Enrollment created.');
                  setShowCreateDialog(false);
                  setFormState({
                    courseId: '',
                    userId: '',
                    roleInCourse: 'student',
                  });
                } catch (errorValue) {
                  toast.error(
                    errorValue instanceof Error
                      ? errorValue.message
                      : 'Unable to create enrollment.',
                  );
                }
              }}
              disabled={createEnrollmentMutation.isLoading}
            >
              {createEnrollmentMutation.isLoading ? 'Saving...' : 'Create Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
