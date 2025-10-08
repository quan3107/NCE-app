import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { PageHeader } from '../../components/page-header';
import { mockCourses, mockEnrollments, mockUsers } from '../../lib/mock-data';
import { formatDate } from '../../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

export function AdminEnrollments() {
  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Manage student enrollments"
        actions={
          <Button>
            <Plus className="mr-2 size-4" />
            Enroll Student
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
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
                {mockEnrollments.map(enrollment => {
                  const user = mockUsers.find(u => u.id === enrollment.userId);
                  const course = mockCourses.find(c => c.id === enrollment.courseId);
                  return (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">{user?.name}</TableCell>
                      <TableCell>{course?.title}</TableCell>
                      <TableCell>{formatDate(enrollment.enrolledAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
