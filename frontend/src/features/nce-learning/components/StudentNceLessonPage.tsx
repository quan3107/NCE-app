/**
 * Location: features/nce-learning/components/StudentNceLessonPage.tsx
 * Purpose: Render a student NCE lesson with exercise attempts and completion actions.
 * Why: Students need to read lessons, save drafts, submit attempts, and move forward.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { PageHeader } from '@components/common/PageHeader';
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
import type { NceAttempt } from '../types';
import { NceExerciseAttempt } from './NceExerciseAttempt';

type AnswerByExercise = Record<string, string>;
type AttemptByExercise = Record<string, NceAttempt>;

export function StudentNceLessonPage() {
  const { courseId = '', lessonId = '' } = useParams<{
    courseId: string;
    lessonId: string;
  }>();
  const { navigate } = useRouter();
  const [pathPage, setPathPage] = useState(1);
  const pathQuery = useStudentNcePathQuery(courseId || undefined, {
    page: pathPage,
    pageSize: 100,
  });
  const saveDraftMutation = useSaveNceAttemptDraftMutation();
  const submitMutation = useSubmitNceAttemptMutation();
  const completeMutation = useCompleteNceLessonMutation();
  const [answers, setAnswers] = useState<AnswerByExercise>({});
  const [attempts, setAttempts] = useState<AttemptByExercise>({});
  const [completed, setCompleted] = useState(false);
  const lessons = pathQuery.data?.lessons ?? [];
  const lessonIndex = lessons.findIndex((item) => item.id === lessonId);
  const lesson = lessonIndex >= 0 ? lessons[lessonIndex] : null;
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : undefined;
  const paginationMeta = pathQuery.data?.pagination;
  const hasMorePathPages = Boolean(
    paginationMeta && paginationMeta.page * paginationMeta.pageSize < paginationMeta.total,
  );
  const completedFromApi = lesson?.progress?.status === 'completed';
  const isCompleted = completed || completedFromApi;
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
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!pathQuery.isFetching && !lesson && hasMorePathPages) {
      setPathPage((current) => current + 1);
    }
  }, [hasMorePathPages, lesson, pathQuery.isFetching]);

  const answerForExercise = (exerciseId: string) => {
    if (answers[exerciseId] !== undefined) {
      return answers[exerciseId];
    }

    const response = effectiveAttempts[exerciseId]?.response;
    const value = response?.answer ?? response?.text ?? response?.value;
    return typeof value === 'string' ? value : '';
  };

  const setAnswer = (exerciseId: string, value: string) => {
    setAnswers((current) => ({ ...current, [exerciseId]: value }));
  };

  const saveDraft = async (exerciseId: string) => {
    const answer = answerForExercise(exerciseId);
    const attempt = await saveDraftMutation.mutateAsync({
      courseId,
      exerciseId,
      response: { answer },
    });
    setAttempts((current) => ({ ...current, [exerciseId]: attempt }));
    return attempt;
  };

  const submit = async (exerciseId: string) => {
    const draft = await saveDraft(exerciseId);
    const submitted = await submitMutation.mutateAsync(draft.id);
    setAttempts((current) => ({ ...current, [exerciseId]: submitted }));
  };

  const completeLesson = async () => {
    await completeMutation.mutateAsync({ courseId, lessonId });
    setCompleted(true);
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
                  exercise={exercise}
                  answer={answerForExercise(exercise.id)}
                  attempt={effectiveAttempts[exercise.id] ?? null}
                  isSaving={saveDraftMutation.isPending}
                  isSubmitting={submitMutation.isPending}
                  onAnswerChange={(value) => setAnswer(exercise.id, value)}
                  onSaveDraft={() => void saveDraft(exercise.id)}
                  onSubmit={() => void submit(exercise.id)}
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
