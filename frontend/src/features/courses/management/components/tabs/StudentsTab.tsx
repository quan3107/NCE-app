/**
 * Location: features/courses/management/components/tabs/StudentsTab.tsx
 * Purpose: Render the enrolled students tab with table and add-student affordances.
 * Why: Keeps list rendering concerns separated from the TeacherCourseManagement shell.
 */

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import { formatDate } from '@lib/utils';
import { Trash2, UserPlus, Users } from 'lucide-react';

import type { EnrollmentHandlers } from '../../hooks/useTeacherCourseManagement';
import type { EnrollmentState } from '../../types';

type StudentsTabProps = {
  enrollment: EnrollmentState;
  handlers: Pick<EnrollmentHandlers, 'removeStudent'>;
  onOpenAddStudent: () => void;
};

export function StudentsTab({ enrollment, handlers, onOpenAddStudent }: StudentsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>Manage student enrollment and access</CardDescription>
            </div>
            <Button onClick={onOpenAddStudent} disabled={enrollment.isAddingStudent}>
              <UserPlus className="mr-2 size-4" />
              Add Student
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {enrollment.students.length === 0 ? (
            <EmptyState onAddStudent={onOpenAddStudent} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollment.students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>
                      {formatDate(new Date(student.enrolledAt), 'date')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatStatus(student.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlers.removeStudent(student.id, student.name)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type EmptyStateProps = {
  onAddStudent: () => void;
};

function EmptyState({ onAddStudent }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Users className="size-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-muted-foreground mb-4">No students enrolled yet</p>
      <Button onClick={onAddStudent}>Add First Student</Button>
    </div>
  );
}

function formatStatus(status: EnrollmentState['students'][number]['status']) {
  switch (status) {
    case 'invited':
      return 'Invited';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Active';
  }
}
