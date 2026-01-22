/**
 * Location: features/admin/components/AdminEnrollmentsPage.tsx
 * Purpose: Render the Admin Enrollments Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { formatDate } from '@lib/utils';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { useAdminEnrollmentsQuery, useAdminUsersQuery } from '@features/admin/api';
import { useCoursesQuery } from '@features/courses/api';

export function AdminEnrollmentsPage() {
  const enrollmentsQuery = useAdminEnrollmentsQuery();
  const usersQuery = useAdminUsersQuery();
  const coursesQuery = useCoursesQuery();

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
        userName: user?.name ?? 'Unknown Student',
        courseTitle: course?.title ?? 'Unknown Course',
        enrolledAt: enrollment.enrolledAt,
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
            <Button>
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
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell>{row.courseTitle}</TableCell>
                      <TableCell>{formatDate(row.enrolledAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
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
    </div>
  );
}
