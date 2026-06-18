/**
 * Location: features/nce-content/components/nceLessonEditor.logic.ts
 * Purpose: Hold small NCE lesson editor form helpers.
 * Why: Keeps the route component below the source-file size guideline.
 */

import type {
  NceExerciseInput,
  NceObjectiveInput,
} from '../types';
import {
  assignCourseNceLessons,
  fetchCourseNceLessons,
} from '../api';

export type ExerciseDraft = NceExerciseInput & {
  contentText: string;
  answerKeyText: string;
  scoringConfigText: string;
};

export const emptyObjective = (index: number): NceObjectiveInput => ({
  code: `objective-${index + 1}`,
  title: '',
  category: 'grammar',
  description: '',
  masteryThreshold: 80,
  sortOrder: index + 1,
});

export const emptyExercise = (index: number): ExerciseDraft => ({
  objectiveCode: '',
  exerciseType: 'gap_fill',
  prompt: '',
  content: { prompt: '' },
  answerKey: { answers: [''] },
  scoringConfig: { points: 1 },
  sortOrder: index + 1,
  contentText: JSON.stringify({ prompt: '' }, null, 2),
  answerKeyText: JSON.stringify({ answers: [''] }, null, 2),
  scoringConfigText: JSON.stringify({ points: 1 }, null, 2),
});

export const stringifyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export const parseJsonObject = (
  label: string,
  value: string,
): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
};

export const getCourseId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get('courseId') ?? '';
};

export async function assignCreatedLessonToCourse(
  courseId: string,
  lessonId: string,
) {
  const existingLessons = await fetchCourseNceLessons(courseId, {
    includeDrafts: true,
    pageSize: 100,
  });
  const sequence =
    Math.max(0, ...existingLessons.lessons.map((item) => item.sequence)) + 1;
  const lessons = existingLessons.lessons.map((item) => ({
    lessonId: item.id,
    sequence: item.sequence,
    availableFrom: item.availableFrom,
    dueAt: item.dueAt,
  }));
  const result = await assignCourseNceLessons(courseId, {
    lessons: [
      ...lessons,
      {
        lessonId,
        sequence,
      },
    ],
  });

  if (result.assignedCount < sequence) {
    throw new Error('Unable to assign the new NCE lesson to this course');
  }
}
