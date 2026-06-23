/**
 * Location: features/nce-learning/components/StudentNcePathPage.tsx
 * Purpose: Render the student NCE course learning path.
 * Why: Students need an ordered view of assigned lessons and completion state.
 */

import { useState } from 'react';
import { BookOpen, CheckCircle2, PlayCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { PageHeader } from '@components/common/PageHeader';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Skeleton } from '@components/ui/skeleton';
import { useRouter } from '@lib/router';
import { useStudentNcePathQuery } from '../api';

const PATH_PAGE_SIZE = 20;

export function StudentNcePathPage() {
  const { navigate } = useRouter();
  const location = useLocation();
  const [courseId, setCourseId] = useState(
    () => new URLSearchParams(location.search).get('courseId') ?? '',
  );
  const [page, setPage] = useState(1);
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

  const updateCourseId = (value: string) => {
    const trimmed = value.trim();
    setCourseId(trimmed);
    setPage(1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (trimmed) {
        url.searchParams.set('courseId', trimmed);
      } else {
        url.searchParams.delete('courseId');
      }
      window.history.replaceState(null, '', url.toString());
    }
  };

  return (
    <div>
      <PageHeader
        title="NCE Path"
        description="Work through your assigned New Concept English lessons"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="student-nce-course-id">Course ID</Label>
            <Input
              id="student-nce-course-id"
              value={courseId}
              onChange={(event) => updateCourseId(event.target.value)}
              placeholder="Paste your course ID"
            />
          </div>
          <Button variant="outline" onClick={() => query.refetch()} disabled={!courseId || query.isFetching}>
            <BookOpen className="size-4" />
            Load
          </Button>
        </div>

        {!courseId ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Enter a course ID to load your NCE lesson path.
          </div>
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
