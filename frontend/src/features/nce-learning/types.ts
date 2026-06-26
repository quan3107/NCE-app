/**
 * Location: features/nce-learning/types.ts
 * Purpose: Define frontend types for student NCE learning APIs.
 * Why: Keeps path, progress, and attempt UI aligned with backend payloads.
 */

import type { NceExercise, NceLesson, NcePagination } from '@features/nce-content/types';

export type NceLessonProgressStatus = 'in_progress' | 'completed';
export type NceAttemptStatus = 'draft' | 'submitted';

export type NceLessonProgress = {
  status: NceLessonProgressStatus;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
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

export type NceAssetContent = {
  url: string;
  mime: string;
  size: number | null;
};

export type StudentNcePathExercise = NceExercise & {
  latestAttempt: NceAttempt | null;
};

export type StudentNcePathLesson = Omit<NceLesson, 'exercises'> & {
  sequence: number;
  availableFrom: string | null;
  dueAt: string | null;
  progress: NceLessonProgress | null;
  exercises: StudentNcePathExercise[];
};

export type StudentNcePathResponse = {
  lessons: StudentNcePathLesson[];
  pagination: NcePagination;
};

export type StudentNcePathQuery = {
  page?: number;
  pageSize?: number;
};

export type NceExerciseAttemptState = {
  exercise: StudentNcePathExercise;
  attempt: NceAttempt | null;
};
