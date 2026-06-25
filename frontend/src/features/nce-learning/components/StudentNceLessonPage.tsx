/**
 * Location: features/nce-learning/components/StudentNceLessonPage.tsx
 * Purpose: Render a student NCE lesson with exercise attempts and completion actions.
 * Why: Students need to read lessons, save drafts, submit attempts, and move forward.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@components/common/PageHeader';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';
import { useRouter } from '@lib/router';
import {
  useCompleteNceLessonMutation,
  useSaveNceAttemptDraftMutation,
  useStudentNcePathQuery,
  useSubmitNceAttemptMutation,
} from '../api';
import type { NceAttempt, NceAttemptResponse, StudentNcePathLesson } from '../types';
import { NceExerciseAttempt } from './NceExerciseAttempt';

type ResponseByExercise = Record<string, NceAttemptResponse>;
type AttemptByExercise = Record<string, NceAttempt>;

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function StudentNceLessonPage() {
  const { courseId = '', lessonId = '' } = useParams<{
    courseId: string;
    lessonId: string;
  }>();
  const { navigate } = useRouter();
  const [pathPage, setPathPage] = useState(1);
  const [loadedLessons, setLoadedLessons] = useState<StudentNcePathLesson[]>([]);
  const pathQuery = useStudentNcePathQuery(courseId || undefined, {
    page: pathPage,
    pageSize: 100,
  });
  const saveDraftMutation = useSaveNceAttemptDraftMutation();
  const submitMutation = useSubmitNceAttemptMutation();
  const completeMutation = useCompleteNceLessonMutation();
  const [responses, setResponses] = useState<ResponseByExercise>({});
  const [attempts, setAttempts] = useState<AttemptByExercise>({});
  const [completedLessonId, setCompletedLessonId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lessons = loadedLessons.length > 0 ? loadedLessons : pathQuery.data?.lessons ?? [];
  const lessonIndex = lessons.findIndex((item) => item.id === lessonId);
  const lesson = lessonIndex >= 0 ? lessons[lessonIndex] : null;
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : undefined;
  const paginationMeta = pathQuery.data?.pagination;
  const hasMorePathPages = Boolean(
    paginationMeta && paginationMeta.page * paginationMeta.pageSize < paginationMeta.total,
  );
  const completedFromApi = lesson?.progress?.status === 'completed';
  const isCompleted = completedLessonId === lessonId || completedFromApi;
  const title = lesson?.title ?? 'NCE Lesson';
  const exerciseIds = useMemo(
    () => lesson?.exercises.map((exercise) => exercise.id) ?? [],
    [lesson],
  );
  const hydratedAttempts = useMemo<AttemptByExercise>(() => {
    const entries = lesson?.exercises
      .filter((exercise) => exercise.latestAttempt)
      .map((exercise) => [exercise.id, exercise.latestAttempt as NceAttempt]) ?? [];

    return Object.fromEntries(entries);
  }, [lesson]);
  const effectiveAttempts = {
    ...hydratedAttempts,
    ...attempts,
  };

  useEffect(() => {
    setPathPage(1);
    setLoadedLessons([]);
  }, [courseId]);

  useEffect(() => {
    const pathData = pathQuery.data;
    if (!pathData) {
      return;
    }

    const pageLessons = pathData.lessons;
    const pageNumber = pathData.pagination.page;
    setLoadedLessons((current) => {
      if (pageNumber === 1) {
        return pageLessons;
      }

      const loadedIds = new Set(current.map((item) => item.id));
      const newLessons = pageLessons.filter((item) => !loadedIds.has(item.id));
      return [...current, ...newLessons];
    });
  }, [pathQuery.data]);

  useEffect(() => {
    const needsCurrentLesson = !lesson;
    const needsNextLesson =
      lessonIndex >= 0 && !nextLesson && lessonIndex === lessons.length - 1;

    if (!pathQuery.isFetching && hasMorePathPages && (needsCurrentLesson || needsNextLesson)) {
      setPathPage((current) => current + 1);
    }
  }, [hasMorePathPages, lesson, lessonIndex, lessons.length, nextLesson, pathQuery.isFetching]);

  const responseForExercise = (exerciseId: string) => {
    if (responses[exerciseId] !== undefined) {
      return responses[exerciseId];
    }

    const response = effectiveAttempts[exerciseId]?.response;
    return response && typeof response === 'object' && !Array.isArray(response)
      ? response
      : {};
  };

  const setResponse = (exerciseId: string, response: NceAttemptResponse) => {
    setResponses((current) => ({ ...current, [exerciseId]: response }));
  };

  const saveDraft = async (exerciseId: string) => {
    const response = responseForExercise(exerciseId);
    const attempt = await saveDraftMutation.mutateAsync({
      courseId,
      exerciseId,
      response,
    });
    setAttempts((current) => ({ ...current, [exerciseId]: attempt }));
    return attempt;
  };

  const submit = async (exerciseId: string) => {
    const draft = await saveDraft(exerciseId);
    const submitted = await submitMutation.mutateAsync(draft.id);
    setAttempts((current) => ({ ...current, [exerciseId]: submitted }));
  };

  const reportActionError = (error: unknown, fallback: string) => {
    const message = errorMessage(error, fallback);
    setActionError(message);
    toast.error(message);
  };

  const saveDraftWithFeedback = async (exerciseId: string) => {
    setActionError(null);
    try {
      await saveDraft(exerciseId);
    } catch (error) {
      reportActionError(error, 'Unable to save draft.');
    }
  };

  const submitWithFeedback = async (exerciseId: string) => {
    setActionError(null);
    try {
      await submit(exerciseId);
    } catch (error) {
      reportActionError(error, 'Unable to submit attempt.');
    }
  };

  const completeLesson = async () => {
    setActionError(null);
    try {
      await completeMutation.mutateAsync({ courseId, lessonId });
      setCompletedLessonId(lessonId);
    } catch (error) {
      reportActionError(error, 'Unable to complete lesson.');
    }
  };

  if (pathQuery.isLoading || (!lesson && hasMorePathPages)) {
    return (
      <div>
        <PageHeader title="NCE Lesson" showBack />
        <div className="p-4 sm:p-6 lg:p-8 space-y-4">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (pathQuery.error || !lesson) {
    return (
      <div>
        <PageHeader title="NCE Lesson" showBack />
        <div className="p-4 sm:p-6 lg:p-8">
          <Card>
            <CardContent className="py-10 text-center text-destructive">
              Unable to load this NCE lesson.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={`Lesson ${lesson.lessonNumber}`}
        showBack
        breadcrumbs={[
          { label: 'NCE Path', path: `/student/nce?courseId=${courseId}` },
          { label: title },
        ]}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {actionError && (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-normal">Lesson Text</h2>
          <div className="rounded-lg border bg-card/70 p-5 leading-7">
            {lesson.lessonText}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-normal">Exercises</h2>
          {lesson.exercises.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              This lesson has no exercises yet.
            </div>
          ) : (
            <div className="space-y-4">
              {lesson.exercises.map((exercise) => (
                <NceExerciseAttempt
                  key={exercise.id}
                  courseId={courseId}
                  exercise={exercise}
                  response={responseForExercise(exercise.id)}
                  attempt={effectiveAttempts[exercise.id] ?? null}
                  isSaving={saveDraftMutation.isPending}
                  isSubmitting={submitMutation.isPending}
                  onResponseChange={(response) => setResponse(exercise.id, response)}
                  onSaveDraft={() => void saveDraftWithFeedback(exercise.id)}
                  onSubmit={() => void submitWithFeedback(exercise.id)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={completeLesson}
            disabled={
              isCompleted ||
              completeMutation.isPending ||
              (exerciseIds.length > 0 &&
                !exerciseIds.every((exerciseId) => effectiveAttempts[exerciseId]?.status === 'submitted'))
            }
          >
            <CheckCircle2 className="size-4" />
            {completeMutation.isPending ? 'Completing' : 'Mark lesson complete'}
          </Button>
          {isCompleted && (
            <span className="text-sm font-medium text-foreground">Lesson completed</span>
          )}
          {nextLesson && (
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/student/nce/courses/${courseId}/lessons/${nextLesson.id}`)
              }
            >
              Next lesson
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
