/**
 * Location: features/nce-content/components/nceLessonEditor.logic.ts
 * Purpose: Hold small NCE lesson editor form helpers.
 * Why: Keeps the route component below the source-file size guideline.
 */

import type {
  NceExerciseInput,
  NceObjectiveInput,
} from '../types';

export type ExerciseDraft = NceExerciseInput & {
  clientId: string;
  contentText: string;
  answerKeyText: string;
  scoringConfigText: string;
};

export const emptyObjective = (sortOrder: number): NceObjectiveInput => ({
  code: `objective-${sortOrder}`,
  title: '',
  category: 'grammar',
  description: '',
  masteryThreshold: 80,
  sortOrder,
});

export const emptyExercise = (sortOrder: number, clientId: string): ExerciseDraft => ({
  clientId,
  objectiveCode: '',
  exerciseType: 'gap_fill',
  prompt: '',
  content: { prompt: '' },
  answerKey: { answers: [] },
  scoringConfig: { points: 1 },
  sortOrder,
  contentText: JSON.stringify({ prompt: '' }, null, 2),
  answerKeyText: JSON.stringify({ answers: [] }, null, 2),
  scoringConfigText: JSON.stringify({ points: 1 }, null, 2),
});

export const stringifyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

export const stringifyNullableJson = (value: unknown) =>
  value == null ? '' : JSON.stringify(value, null, 2);

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
