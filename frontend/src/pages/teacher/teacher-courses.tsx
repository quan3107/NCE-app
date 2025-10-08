import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/page-header';
import { mockCourses } from '../../lib/mock-data';

export function TeacherCourses() {
  return (
    <div>
      <PageHeader title="Courses" description="Manage your courses" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCourses.map(course => (
            <Card key={course.id}>
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription>{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium">{course.enrolled}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="font-medium">{course.schedule}</span>
                </div>
                <Button variant="outline" className="w-full">Manage Course</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

