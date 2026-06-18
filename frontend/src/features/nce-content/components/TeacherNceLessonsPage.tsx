/**
 * Location: features/nce-content/components/TeacherNceLessonsPage.tsx
 * Purpose: List teacher-manageable NCE lessons for a course context.
 * Why: Teachers need a draft-aware workspace for publishing and sequencing NCE lessons.
 */

import { useState } from 'react';
import { PageHeader } from '@components/common/PageHeader';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Skeleton } from '@components/ui/skeleton';
import { useRouter } from '@lib/router';
import { Edit, Plus, RefreshCw } from 'lucide-react';
import {
  publishNceLesson,
  unpublishNceLesson,
  useCourseNceLessonsQuery,
} from '../api';

const initialCourseId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get('courseId') ?? '';
};

export function TeacherNceLessonsPage() {
  const { navigate } = useRouter();
  const [courseId, setCourseId] = useState(initialCourseId);
  const [mutatingLessonId, setMutatingLessonId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const query = useCourseNceLessonsQuery(
    courseId || undefined,
    { includeDrafts: true, pageSize: 100 },
  );
  const lessons = query.data?.lessons ?? [];
  const newLessonPath = courseId
    ? `/teacher/nce-lessons/new?${new URLSearchParams({ courseId }).toString()}`
    : '/teacher/nce-lessons/new';

  const updateCourseId = (value: string) => {
    const trimmed = value.trim();
    setCourseId(trimmed);
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

  const togglePublish = async (lessonId: string, isPublished: boolean) => {
    setMutatingLessonId(lessonId);
    setErrorMessage(null);
    try {
      if (isPublished) {
        await unpublishNceLesson(lessonId);
      } else {
        await publishNceLesson(lessonId);
      }
      await query.refetch();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update lesson');
    } finally {
      setMutatingLessonId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="NCE Lessons"
        description="Create, publish, and sequence New Concept English lessons"
        actions={
          <Button onClick={() => navigate(newLessonPath)}>
            <Plus className="mr-2 size-4" />
            New Lesson
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="nce-course-id">Course ID</Label>
            <Input
              id="nce-course-id"
              value={courseId}
              onChange={(event) => updateCourseId(event.target.value)}
              placeholder="Paste a course ID to manage its NCE sequence"
            />
          </div>
          <Button variant="outline" onClick={() => query.refetch()} disabled={!courseId || query.isLoading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {!courseId ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Enter a course ID to load draft and published NCE lessons.
          </div>
        ) : query.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={`nce-lesson-skeleton-${index}`}>
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
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
              Unable to load NCE lessons for this course.
            </CardContent>
          </Card>
        ) : lessons.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No NCE lessons are assigned to this course yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {lessons.map((lesson) => {
              const isPublished = lesson.status === 'published';
              const isMutating = mutatingLessonId === lesson.id;
              return (
                <Card key={lesson.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{lesson.title}</CardTitle>
                    <CardDescription>
                      Sequence {lesson.sequence} · Lesson {lesson.lessonNumber} · {lesson.status}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/teacher/nce-lessons/${lesson.id}/edit?courseId=${courseId}`)}
                    >
                      <Edit className="mr-2 size-4" />
                      Edit
                    </Button>
                    <Button
                      variant={isPublished ? 'secondary' : 'default'}
                      disabled={isMutating}
                      onClick={() => togglePublish(lesson.id, isPublished)}
                    >
                      {isMutating
                        ? isPublished
                          ? 'Unpublishing'
                          : 'Publishing'
                        : isPublished
                          ? 'Unpublish'
                          : 'Publish'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
