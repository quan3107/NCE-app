/**
 * Location: features/nce-learning/types.ts
 * Purpose: Define frontend types for student NCE learning APIs.
 * Why: Keeps path, progress, and attempt UI aligned with backend payloads.
 */

import type { CourseNceLesson, NceExercise, NcePagination } from '@features/nce-content/types';

export type NceLessonProgressStatus = 'in_progress' | 'completed';
export type NceAttemptStatus = 'draft' | 'submitted';

export type NceLessonProgress = {
  status: NceLessonProgressStatus;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type StudentNcePathLesson = CourseNceLesson & {
  progress: NceLessonProgress | null;
};

export type StudentNcePathResponse = {
  lessons: StudentNcePathLesson[];
  pagination: NcePagination;
};

export type StudentNcePathQuery = {
  page?: number;
  pageSize?: number;
};

export type NceAttemptResponse = Record<string, unknown>;

export type NceAttempt = {
  id: string;
  courseId: string;
  lessonId: string;
  exerciseId: string;
  studentId: string;
  status: NceAttemptStatus;
  response: NceAttemptResponse;
  score: number | null;
  maxScore: number | null;
  feedback: unknown | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NceAttemptDraftPayload = {
  response: NceAttemptResponse;
};

export type NceExerciseAttemptState = {
  exercise: NceExercise;
  attempt: NceAttempt | null;
};
