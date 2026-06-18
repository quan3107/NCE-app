import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@components/common/PageHeader';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { useRouter } from '@lib/router';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import { createNceLesson, patchNceLesson, useNceLessonQuery } from '../api';
import type { NceExerciseInput, NceExerciseType, NceLessonPatchPayload, NceLessonWritePayload, NceObjectiveInput } from '../types';
import { NceExerciseEditor } from './NceExerciseEditor';
import {
  emptyExercise,
  emptyObjective,
  getCourseId,
  parseJsonObject,
  stringifyJson,
  type ExerciseDraft,
} from './nceLessonEditor.logic';
import { NceObjectiveEditor } from './NceObjectiveEditor';

type Props = {
  lessonId?: string;
};

export function TeacherNceLessonEditorPage({ lessonId }: Props) {
  const { navigate } = useRouter();
  const [courseId] = useState(getCourseId);
  const isEditing = Boolean(lessonId);
  const lessonQuery = useNceLessonQuery(
    lessonId,
    courseId ? { includeDrafts: true, courseId } : { includeDrafts: false },
  );
  const [unitId, setUnitId] = useState('');
  const [lessonNumber, setLessonNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [lessonText, setLessonText] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [sortOrder, setSortOrder] = useState(1);
  const [objectives, setObjectives] = useState<NceObjectiveInput[]>([emptyObjective(0)]);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise(0)]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [hydratedLessonId, setHydratedLessonId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const lesson = lessonQuery.data;
    if (!lesson || !isEditing) {
      return;
    }

    if (isDirty || hydratedLessonId === lesson.id) {
      return;
    }

    setUnitId(lesson.unitId);
    setLessonNumber(lesson.lessonNumber);
    setTitle(lesson.title);
    setLessonText(lesson.lessonText);
    setTeacherNotes(lesson.teacherNotes ?? '');
    setSortOrder(lesson.sortOrder);
    setObjectives(
      lesson.objectives.map((objective) => ({
        code: objective.code,
        title: objective.title,
        category: objective.category,
        description: objective.description,
        masteryThreshold: objective.masteryThreshold,
        sortOrder: objective.sortOrder,
      })),
    );
    setExercises(
      lesson.exercises.map((exercise) => ({
        objectiveCode: lesson.objectives.find((objective) => objective.id === exercise.objectiveId)?.code ?? '',
        exerciseType: exercise.exerciseType,
        prompt: exercise.prompt,
        content: (exercise.content ?? {}) as Record<string, unknown>,
        answerKey: (exercise.answerKey ?? {}) as Record<string, unknown>,
        scoringConfig: (exercise.scoringConfig ?? null) as Record<string, unknown> | null,
        sortOrder: exercise.sortOrder,
        contentText: stringifyJson(exercise.content),
        answerKeyText: stringifyJson(exercise.answerKey),
        scoringConfigText: stringifyJson(exercise.scoringConfig ?? {}),
      })),
    );
    setHydratedLessonId(lesson.id);
  }, [hydratedLessonId, isDirty, isEditing, lessonQuery.data]);

  const backPath = useMemo(
    () => `/teacher/nce-lessons${courseId ? `?courseId=${courseId}` : ''}`,
    [courseId],
  );

  const buildPayload = (): NceLessonWritePayload | NceLessonPatchPayload => {
    const parsedExercises = exercises.map((exercise) => {
      const content = parseJsonObject('Content', exercise.contentText);
      const answerKey = parseJsonObject('Answer key', exercise.answerKeyText);
      const scoringConfig =
        exercise.scoringConfigText.trim()
          ? parseJsonObject('Scoring config', exercise.scoringConfigText)
          : null;

      return {
        objectiveId: exercise.objectiveId,
        objectiveCode: exercise.objectiveCode || undefined,
        exerciseType: exercise.exerciseType as NceExerciseType,
        prompt: exercise.prompt,
        content: content ?? {},
        answerKey: answerKey ?? {},
        scoringConfig,
        sortOrder: exercise.sortOrder,
      };
    });

    return {
      unitId,
      lessonNumber,
      title,
      lessonText,
      teacherNotes,
      sortOrder,
      objectives,
      exercises: parsedExercises,
    };
  };

  const saveLesson = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const payload = buildPayload();
      if (lessonId) {
        await patchNceLesson(lessonId, payload, courseId);
      } else {
        await createNceLesson(payload as NceLessonWritePayload, courseId);
      }
      setIsDirty(false);
      navigate(backPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save NCE lesson');
    } finally {
      setIsSaving(false);
    }
  };

  const updateObjective = (index: number, nextValue: NceObjectiveInput) => {
    setIsDirty(true);
    setObjectives((existing) =>
      existing.map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
    );
  };

  const updateExercise = (index: number, nextValue: NceExerciseInput) => {
    setIsDirty(true);
    setExercises((existing) =>
      existing.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...nextValue } : item,
      ),
    );
  };

  const updateExerciseText = (
    index: number,
    field: 'contentText' | 'answerKeyText' | 'scoringConfigText',
    value: string,
  ) => {
    setIsDirty(true);
    setExercises((existing) =>
      existing.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Edit NCE Lesson' : 'New NCE Lesson'}
        description="Draft lesson text, objectives, exercises, and answer keys"
        actions={
          <Button variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {lessonQuery.isLoading && isEditing ? (
          <p className="text-sm text-muted-foreground">Loading lesson...</p>
        ) : (
          <>
            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            <section className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nce-unit-id">Unit ID</Label>
                  <Input id="nce-unit-id" value={unitId} onChange={(event) => {
                    setIsDirty(true);
                    setUnitId(event.target.value);
                  }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nce-lesson-number">Lesson Number</Label>
                  <Input
                    id="nce-lesson-number"
                    type="number"
                    min={1}
                    value={lessonNumber}
                    onChange={(event) => {
                      setIsDirty(true);
                      setLessonNumber(Number(event.target.value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nce-sort-order">Sort Order</Label>
                  <Input
                    id="nce-sort-order"
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(event) => {
                      setIsDirty(true);
                      setSortOrder(Number(event.target.value));
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nce-title">Title</Label>
                <Input id="nce-title" value={title} onChange={(event) => {
                  setIsDirty(true);
                  setTitle(event.target.value);
                }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nce-lesson-text">Lesson Text</Label>
                <Textarea
                  id="nce-lesson-text"
                  value={lessonText}
                  onChange={(event) => {
                    setIsDirty(true);
                    setLessonText(event.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nce-teacher-notes">Teacher Notes</Label>
                <Textarea
                  id="nce-teacher-notes"
                  value={teacherNotes}
                  onChange={(event) => {
                    setIsDirty(true);
                    setTeacherNotes(event.target.value);
                  }}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Objectives</h2>
                <Button type="button" variant="outline" onClick={() => {
                  setIsDirty(true);
                  setObjectives((items) => [...items, emptyObjective(items.length)]);
                }}>
                  <Plus className="mr-2 size-4" />
                  Add Objective
                </Button>
              </div>
              {objectives.map((objective, index) => (
                <NceObjectiveEditor
                  key={`${objective.code}-${index}`}
                  index={index}
                  value={objective}
                  onChange={(nextValue) => updateObjective(index, nextValue)}
                  onRemove={() => {
                    setIsDirty(true);
                    setObjectives((items) => items.filter((_, itemIndex) => itemIndex !== index));
                  }}
                />
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Exercises</h2>
                <Button type="button" variant="outline" onClick={() => {
                  setIsDirty(true);
                  setExercises((items) => [...items, emptyExercise(items.length)]);
                }}>
                  <Plus className="mr-2 size-4" />
                  Add Exercise
                </Button>
              </div>
              {exercises.map((exercise, index) => (
                <NceExerciseEditor
                  key={`${exercise.exerciseType}-${index}`}
                  index={index}
                  value={exercise}
                  contentText={exercise.contentText}
                  answerKeyText={exercise.answerKeyText}
                  scoringConfigText={exercise.scoringConfigText}
                  onChange={(nextValue) => updateExercise(index, nextValue)}
                  onTextChange={(field, value) => updateExerciseText(index, field, value)}
                  onRemove={() => {
                    setIsDirty(true);
                    setExercises((items) => items.filter((_, itemIndex) => itemIndex !== index));
                  }}
                />
              ))}
            </section>

            <div className="flex justify-end">
              <Button onClick={saveLesson} disabled={isSaving}>
                <Save className="mr-2 size-4" />
                {isSaving ? 'Saving' : 'Save Lesson'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
