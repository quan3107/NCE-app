/**
 * Location: features/admin/components/AdminCoursesPage.tsx
 * Purpose: Render the Admin Courses Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { Plus, Edit, RefreshCw } from 'lucide-react';
import { useCoursesQuery } from '@features/courses/api';

export function AdminCoursesPage() {
  const { data: courses = [], isLoading, error, refresh } = useCoursesQuery();

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Manage all courses"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Course
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading courses...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load courses. Please try again later.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map(course => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.title}</TableCell>
                      <TableCell>{course.teacher}</TableCell>
                      <TableCell>{course.schedule}</TableCell>
                      <TableCell>{course.enrolled}</TableCell>
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
    </div>
  );
}
