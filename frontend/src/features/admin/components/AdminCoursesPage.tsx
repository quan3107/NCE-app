/**
 * Location: features/admin/components/AdminCoursesPage.tsx
 * Purpose: Render the Admin Courses Page component for the Admin domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { PageHeader } from '@components/common/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Plus, Edit, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAdminUsersQuery, useCreateCourseMutation } from '@features/admin/api';
import { useCoursesQuery } from '@features/courses/api';

export function AdminCoursesPage() {
  const { data: courses = [], isLoading, error, refetch } = useCoursesQuery();
  const { data: users = [] } = useAdminUsersQuery();
  const createCourseMutation = useCreateCourseMutation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    ownerTeacherId: '',
  });

  const teacherOptions = useMemo(
    () => users.filter(user => user.role === 'teacher'),
    [users],
  );

  useEffect(() => {
    if (!formState.ownerTeacherId && teacherOptions.length > 0) {
      setFormState(current => ({ ...current, ownerTeacherId: teacherOptions[0].id }));
    }
  }, [formState.ownerTeacherId, teacherOptions]);

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Manage all courses"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>Create a new course offering.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Course title"
                value={formState.title}
                onChange={(event) =>
                  setFormState(current => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={formState.description}
                onChange={(event) =>
                  setFormState(current => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select
                value={formState.ownerTeacherId}
                onValueChange={(value) =>
                  setFormState(current => ({ ...current, ownerTeacherId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teacherOptions.map(teacher => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} ({teacher.email})
                    </SelectItem>
                  ))}
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
                if (!formState.title.trim() || !formState.ownerTeacherId) {
                  toast.error('Title and teacher are required.');
                  return;
                }
                try {
                  await createCourseMutation.mutateAsync({
                    title: formState.title.trim(),
                    description: formState.description.trim() || undefined,
                    ownerTeacherId: formState.ownerTeacherId,
                  });
                  toast.success('Course created.');
                  setShowCreateDialog(false);
                  setFormState({
                    title: '',
                    description: '',
                    ownerTeacherId: teacherOptions[0]?.id ?? '',
                  });
                } catch (errorValue) {
                  toast.error(
                    errorValue instanceof Error ? errorValue.message : 'Unable to create course.',
                  );
                }
              }}
              disabled={createCourseMutation.isLoading}
            >
              {createCourseMutation.isLoading ? 'Creating...' : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
