/**
 * File: src/modules/nce-attempts/nce-attempts.mappers.ts
 * Purpose: Normalize NCE progress and attempt rows into API payloads.
 * Why: Student responses stay private while progress and summary data remain usable.
 */
import type {
  NceAttemptStatus,
  NceExerciseType,
  NceLessonProgressStatus,
  Prisma,
} from "../../prisma/index.js";
import { mapNceLesson, type NceLessonRow } from "../nce-content/nce-content.mappers.js";

type DateLike = Date | null;

const toIso = (date: DateLike): string | null => date?.toISOString() ?? null;

export type NceLessonProgressRow = {
  status: NceLessonProgressStatus;
  startedAt: Date;
  completedAt: DateLike;
  updatedAt: Date;
};

export type NceExerciseAttemptRow = {
  id: string;
  courseId: string;
  lessonId: string;
  exerciseId: string;
  studentId: string;
  status: NceAttemptStatus;
  response: Prisma.JsonValue;
  score: number | null;
  maxScore: number | null;
  feedbackJson: Prisma.JsonValue | null;
  submittedAt: DateLike;
  createdAt: Date;
  updatedAt: Date;
};

type NcePathExerciseRow = NonNullable<NceLessonRow["exercises"]>[number] & {
  attempts?: NceExerciseAttemptRow[];
};

type NcePathLessonRow = Omit<NceLessonRow, "exercises"> & {
  exercises: NcePathExerciseRow[];
};

export type NcePathAssignmentRow = {
  sequence: number;
  availableFrom: DateLike;
  dueAt: DateLike;
  lesson: NcePathLessonRow;
  progress?: NceLessonProgressRow[];
};

export type NceAttemptSummaryRow = Omit<NceExerciseAttemptRow, "response" | "feedbackJson"> & {
  student: {
    id: string;
    fullName: string;
    email: string;
  };
  exercise: {
    id: string;
    exerciseType: NceExerciseType;
    prompt: string;
    sortOrder: number;
    lesson: {
      id: string;
      title: string;
      lessonNumber: number;
    };
  };
};

export const mapNceProgress = (progress?: NceLessonProgressRow | null) => {
  if (!progress) {
    return null;
  }

  return {
    status: progress.status,
    startedAt: progress.startedAt.toISOString(),
    completedAt: toIso(progress.completedAt),
    updatedAt: progress.updatedAt.toISOString(),
  };
};

export const mapNcePathAssignment = (assignment: NcePathAssignmentRow) => {
  const lesson = assignment.lesson as NcePathLessonRow;
  const mappedLesson = mapNceLesson(lesson, {
    includeAnswers: false,
    includeTeacherNotes: false,
  });

  return {
    sequence: assignment.sequence,
    availableFrom: toIso(assignment.availableFrom),
    dueAt: toIso(assignment.dueAt),
    progress: mapNceProgress(assignment.progress?.[0]),
    ...mappedLesson,
    exercises: mappedLesson.exercises.map((exercise) => {
      const source = lesson.exercises?.find((item) => item.id === exercise.id);
      const latestAttempt = source?.attempts?.[0] ?? null;

      return {
        ...exercise,
        latestAttempt: latestAttempt ? mapNceAttempt(latestAttempt) : null,
      };
    }),
  };
};

export const mapNceAttempt = (attempt: NceExerciseAttemptRow) => ({
  id: attempt.id,
  courseId: attempt.courseId,
  lessonId: attempt.lessonId,
  exerciseId: attempt.exerciseId,
  studentId: attempt.studentId,
  status: attempt.status,
  response: attempt.response,
  score: attempt.score,
  maxScore: attempt.maxScore,
  feedback: attempt.feedbackJson,
  submittedAt: toIso(attempt.submittedAt),
  createdAt: attempt.createdAt.toISOString(),
  updatedAt: attempt.updatedAt.toISOString(),
});

export const mapNceAttemptSummary = (attempt: NceAttemptSummaryRow) => ({
  id: attempt.id,
  courseId: attempt.courseId,
  lessonId: attempt.lessonId,
  exerciseId: attempt.exerciseId,
  studentId: attempt.studentId,
  status: attempt.status,
  score: attempt.score,
  maxScore: attempt.maxScore,
  submittedAt: toIso(attempt.submittedAt),
  createdAt: attempt.createdAt.toISOString(),
  updatedAt: attempt.updatedAt.toISOString(),
  student: attempt.student,
  exercise: attempt.exercise,
});
