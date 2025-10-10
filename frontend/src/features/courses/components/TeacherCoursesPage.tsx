/**
 * Location: features/courses/components/TeacherCoursesPage.tsx
 * Purpose: Render the Teacher Courses Page component for the Courses domain.
 * Why: Keeps the feature module organized under the new structure.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { PageHeader } from '@components/common/PageHeader';
import { Skeleton } from '@components/ui/skeleton';
import { useRouter } from '@lib/router';
import { useCoursesQuery } from '@features/courses/api';

export function TeacherCoursesPage() {
  const { data: courses = [], isLoading, error, refresh } = useCoursesQuery();
  const { navigate } = useRouter();

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Manage your courses"
        actions={
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={`course-skeleton-${index}`}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Unable to load courses. Try refreshing.
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
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
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/teacher/courses/${course.id}/manage`)}
                  >
                    Manage Course
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
