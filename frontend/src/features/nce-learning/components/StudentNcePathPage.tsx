/**
 * Location: features/nce-learning/components/StudentNcePathPage.tsx
 * Purpose: Render the student NCE course learning path.
 * Why: Students need an ordered view of assigned lessons and completion state.
 */

import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, PlayCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { PageHeader } from '@components/common/PageHeader';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';
import { useCoursesQuery } from '@features/courses/api';
import { useRouter } from '@lib/router';
import { useStudentNcePathQuery } from '../api';

const PATH_PAGE_SIZE = 20;

export function StudentNcePathPage() {
  const { navigate } = useRouter();
  const location = useLocation();
  const routeCourseId = new URLSearchParams(location.search).get('courseId') ?? '';
  const [courseId, setCourseId] = useState(routeCourseId);
  const [page, setPage] = useState(1);
  const coursesQuery = useCoursesQuery();
  const courses = coursesQuery.data ?? [];
  const query = useStudentNcePathQuery(
    courseId || undefined,
    { page, pageSize: PATH_PAGE_SIZE },
  );
  const lessons = query.data?.lessons ?? [];
  const pagination = query.data?.pagination;
  const totalLessons = pagination?.total ?? lessons.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalLessons / (pagination?.pageSize ?? PATH_PAGE_SIZE)),
  );

  useEffect(() => {
    setCourseId(routeCourseId);
    setPage(1);
  }, [routeCourseId]);

  const selectCourse = (selectedCourseId: string) => {
    setCourseId(selectedCourseId);
    setPage(1);
    navigate(`/student/nce?courseId=${encodeURIComponent(selectedCourseId)}`);
  };

  return (
    <div>
      <PageHeader
        title="NCE Path"
        description="Work through your assigned New Concept English lessons"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {!courseId ? (
          coursesQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={`student-nce-course-skeleton-${index}`}>
                  <CardHeader>
                    <Skeleton className="h-5 w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : coursesQuery.error ? (
            <Card>
              <CardContent className="py-10 text-center text-destructive">
                Unable to load your courses.
              </CardContent>
            </Card>
          ) : courses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No enrolled courses are available.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Card key={course.id}>
                  <CardContent className="space-y-4 p-5">
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate text-base font-semibold tracking-normal">
                        {course.title}
                      </h2>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {course.description}
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => selectCourse(course.id)}
                      aria-label={`Open NCE path for ${course.title}`}
                    >
                      <BookOpen className="size-4" />
                      Open NCE Path
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : query.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`student-nce-path-skeleton-${index}`}>
                <CardHeader>
                  <Skeleton className="h-5 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : query.error ? (
          <Card>
            <CardContent className="py-10 text-center text-destructive">
              Unable to load your NCE path.
            </CardContent>
          </Card>
        ) : lessons.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No NCE lessons are assigned yet.
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => {
              const completed = lesson.progress?.status === 'completed';

              return (
                <Card key={lesson.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={completed ? 'default' : 'secondary'}>
                            {completed ? (
                              <CheckCircle2 className="size-3" />
                            ) : (
                              <PlayCircle className="size-3" />
                            )}
                            {completed ? 'Completed' : 'Ready'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Sequence {lesson.sequence} · Lesson {lesson.lessonNumber}
                          </span>
                        </div>
                        <h2 className="text-base font-semibold tracking-normal">{lesson.title}</h2>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {lesson.lessonText}
                        </p>
                      </div>
                      <Button
                        onClick={() =>
                          navigate(`/student/nce/courses/${courseId}/lessons/${lesson.id}`)
                        }
                        aria-label={`Open ${lesson.title}`}
                      >
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {pagination && totalLessons > PATH_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  Page {page} of {totalPages} · {pagination.total} lessons
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= totalPages || query.isFetching}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
