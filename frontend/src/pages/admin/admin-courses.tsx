import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { PageHeader } from '../../components/page-header';
import { mockCourses } from '../../lib/mock-data';
import { Plus, Edit } from 'lucide-react';

export function AdminCourses() {
  return (
    <div>
      <PageHeader
        title="Courses"
        description="Manage all courses"
        actions={
          <Button>
            <Plus className="mr-2 size-4" />
            Add Course
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
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
                {mockCourses.map(course => (
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
      </div>
    </div>
  );
}

