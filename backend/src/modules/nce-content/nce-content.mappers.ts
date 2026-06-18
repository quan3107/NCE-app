/**
 * File: src/modules/nce-content/nce-content.mappers.ts
 * Purpose: Normalize Prisma NCE rows into client-safe API payloads.
 * Why: Hides internal fields and answer keys from student/public reads.
 */
import type { NceExerciseType, NcePublishStatus, Prisma } from "../../prisma/index.js";

type DateLike = Date | null;

export type NceBookRow = {
  id: string;
  code: string;
  title: string;
  level: string;
  description: string | null;
  sortOrder: number;
  status: NcePublishStatus;
  publishedAt: DateLike;
  createdAt: Date;
  updatedAt: Date;
};

export type NceUnitRow = {
  id: string;
  bookId: string;
  unitNumber: number;
  title: string;
  description: string | null;
  sortOrder: number;
  status: NcePublishStatus;
  publishedAt: DateLike;
  createdAt: Date;
  updatedAt: Date;
};

export type NceObjectiveRow = {
  id: string;
  lessonId: string;
  code: string;
  title: string;
  category: string;
  description: string | null;
  masteryThreshold: number;
  sortOrder: number;
};

export type NceExerciseRow = {
  id: string;
  lessonId: string;
  objectiveId: string | null;
  exerciseType: NceExerciseType;
  prompt: string;
  content: Prisma.JsonValue;
  answerKey: Prisma.JsonValue;
  scoringConfig: Prisma.JsonValue | null;
  sortOrder: number;
};

export type NceLessonRow = {
  id: string;
  unitId: string;
  lessonNumber: number;
  title: string;
  lessonText: string;
  mediaJson: Prisma.JsonValue | null;
  teacherNotes: string | null;
  sortOrder: number;
  status: NcePublishStatus;
  publishedAt: DateLike;
  createdAt: Date;
  updatedAt: Date;
  unit?: (NceUnitRow & { book?: Pick<NceBookRow, "id" | "code" | "title" | "level" | "status"> }) | null;
  objectives?: NceObjectiveRow[];
  exercises?: NceExerciseRow[];
};

type LessonMapperOptions = {
  includeAnswers: boolean;
  includeTeacherNotes: boolean;
};

const toIso = (date: DateLike): string | null => date?.toISOString() ?? null;

export const mapNceBook = (book: NceBookRow) => ({
  id: book.id,
  code: book.code,
  title: book.title,
  level: book.level,
  description: book.description,
  sortOrder: book.sortOrder,
  status: book.status,
  publishedAt: toIso(book.publishedAt),
  createdAt: book.createdAt.toISOString(),
  updatedAt: book.updatedAt.toISOString(),
});

export const mapNceUnit = (unit: NceUnitRow) => ({
  id: unit.id,
  bookId: unit.bookId,
  unitNumber: unit.unitNumber,
  title: unit.title,
  description: unit.description,
  sortOrder: unit.sortOrder,
  status: unit.status,
  publishedAt: toIso(unit.publishedAt),
  createdAt: unit.createdAt.toISOString(),
  updatedAt: unit.updatedAt.toISOString(),
});

const mapNceObjective = (objective: NceObjectiveRow) => ({
  id: objective.id,
  lessonId: objective.lessonId,
  code: objective.code,
  title: objective.title,
  category: objective.category,
  description: objective.description,
  masteryThreshold: objective.masteryThreshold,
  sortOrder: objective.sortOrder,
});

const mapNceExercise = (
  exercise: NceExerciseRow,
  options: LessonMapperOptions,
) => ({
  id: exercise.id,
  lessonId: exercise.lessonId,
  objectiveId: exercise.objectiveId,
  exerciseType: exercise.exerciseType,
  prompt: exercise.prompt,
  content: exercise.content,
  ...(options.includeAnswers ? { answerKey: exercise.answerKey } : {}),
  scoringConfig: exercise.scoringConfig,
  sortOrder: exercise.sortOrder,
});

export const mapNceLesson = (
  lesson: NceLessonRow,
  options: LessonMapperOptions,
) => ({
  id: lesson.id,
  unitId: lesson.unitId,
  lessonNumber: lesson.lessonNumber,
  title: lesson.title,
  lessonText: lesson.lessonText,
  media: lesson.mediaJson,
  sortOrder: lesson.sortOrder,
  status: lesson.status,
  publishedAt: toIso(lesson.publishedAt),
  createdAt: lesson.createdAt.toISOString(),
  updatedAt: lesson.updatedAt.toISOString(),
  ...(lesson.unit
    ? {
        unit: {
          id: lesson.unit.id,
          bookId: lesson.unit.bookId,
          unitNumber: lesson.unit.unitNumber,
          title: lesson.unit.title,
          status: lesson.unit.status,
          book: lesson.unit.book
            ? {
                id: lesson.unit.book.id,
                code: lesson.unit.book.code,
                title: lesson.unit.book.title,
                level: lesson.unit.book.level,
                status: lesson.unit.book.status,
              }
            : undefined,
        },
      }
    : {}),
  ...(options.includeTeacherNotes ? { teacherNotes: lesson.teacherNotes } : {}),
  objectives: (lesson.objectives ?? []).map(mapNceObjective),
  exercises: (lesson.exercises ?? []).map((exercise) =>
    mapNceExercise(exercise, options),
  ),
});
