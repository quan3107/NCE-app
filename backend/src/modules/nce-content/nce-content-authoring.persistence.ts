/**
 * File: src/modules/nce-content/nce-content-authoring.persistence.ts
 * Purpose: Share persistence helpers for NCE lesson authoring.
 * Why: Keeps mutation orchestration small while preserving one response shape.
 */
import {
  NcePublishStatus,
  Prisma,
} from "../../prisma/index.js";

import { prisma, runWithRole } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
import {
  mapNceLesson,
  type NceLessonRow,
} from "./nce-content.mappers.js";
import type {
  AssignNceLessonsInput,
  CreateNceLessonInput,
  PatchNceLessonInput,
} from "./nce-content.schema.js";

type LessonWriteInput = CreateNceLessonInput | PatchNceLessonInput;

export const authoredLessonSelect = {
  id: true,
  unitId: true,
  lessonNumber: true,
  title: true,
  lessonText: true,
  mediaJson: true,
  teacherNotes: true,
  sortOrder: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  unit: {
    select: {
      id: true,
      bookId: true,
      unitNumber: true,
      title: true,
      description: true,
      sortOrder: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      book: {
        select: {
          id: true,
          code: true,
          title: true,
          level: true,
          status: true,
        },
      },
    },
  },
  objectives: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      lessonId: true,
      code: true,
      title: true,
      category: true,
      description: true,
      masteryThreshold: true,
      sortOrder: true,
    },
  },
  exercises: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      lessonId: true,
      objectiveId: true,
      exerciseType: true,
      prompt: true,
      content: true,
      answerKey: true,
      scoringConfig: true,
      sortOrder: true,
    },
  },
};

export function mapAuthoredLesson(lesson: NceLessonRow) {
  return mapNceLesson(lesson, {
    includeAnswers: true,
    includeTeacherNotes: true,
  });
}

export function readWithServiceRole<T>(
  actor: RequestActor,
  write: () => Promise<T>,
): Promise<T> {
  return runWithRole(
    {
      role: "service_role",
      userId: actor.id,
      userRole: actor.role,
    },
    write,
  );
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function objectiveCreates(input: LessonWriteInput) {
  return (input.objectives ?? []).map((objective) => ({
    code: objective.code,
    title: objective.title,
    category: objective.category,
    description: objective.description ?? null,
    masteryThreshold: objective.masteryThreshold,
    sortOrder: objective.sortOrder,
  }));
}

function exerciseCreates(input: LessonWriteInput) {
  return (input.exercises ?? []).map((exercise) => ({
    objectiveId: exercise.objectiveId ?? null,
    exerciseType: exercise.exerciseType,
    prompt: exercise.prompt,
    content: toJson(exercise.content),
    answerKey: toJson(exercise.answerKey),
    scoringConfig: exercise.scoringConfig ? toJson(exercise.scoringConfig) : Prisma.JsonNull,
    sortOrder: exercise.sortOrder,
  }));
}

export function createLessonData(
  input: CreateNceLessonInput,
): Prisma.NceLessonUncheckedCreateInput {
  return {
    unitId: input.unitId,
    lessonNumber: input.lessonNumber,
    title: input.title,
    lessonText: input.lessonText,
    mediaJson: input.media === undefined ? Prisma.JsonNull : toJson(input.media),
    teacherNotes: input.teacherNotes ?? null,
    sortOrder: input.sortOrder,
    status: NcePublishStatus.draft,
    objectives: { create: objectiveCreates(input) },
    exercises: { create: exerciseCreates(input) },
  };
}

export function patchLessonData(input: PatchNceLessonInput): Prisma.NceLessonUpdateInput {
  const data: Prisma.NceLessonUpdateInput = {};

  if (input.unitId) {
    data.unit = { connect: { id: input.unitId } };
  }
  if (input.lessonNumber !== undefined) {
    data.lessonNumber = input.lessonNumber;
  }
  if (input.title !== undefined) {
    data.title = input.title;
  }
  if (input.lessonText !== undefined) {
    data.lessonText = input.lessonText;
  }
  if (input.media !== undefined) {
    data.mediaJson = input.media === null ? Prisma.JsonNull : toJson(input.media);
  }
  if (input.teacherNotes !== undefined) {
    data.teacherNotes = input.teacherNotes;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }
  if (input.objectives) {
    data.objectives = {
      deleteMany: {},
      create: objectiveCreates(input),
    };
  }
  if (input.exercises) {
    data.exercises = {
      deleteMany: {},
      create: exerciseCreates(input),
    };
  }

  return data;
}

export async function findAuthoredLesson(lessonId: string) {
  return prisma.nceLesson.findFirst({
    where: {
      id: lessonId,
      deletedAt: null,
      unit: {
        deletedAt: null,
        book: { deletedAt: null },
      },
    },
    select: authoredLessonSelect,
  });
}

export function assignmentRows(
  courseId: string,
  payload: AssignNceLessonsInput,
): Prisma.NceCourseLessonAssignmentCreateManyInput[] {
  return payload.lessons.map((lesson) => ({
    courseId,
    lessonId: lesson.lessonId,
    sequence: lesson.sequence,
    availableFrom: lesson.availableFrom ? new Date(lesson.availableFrom) : null,
    dueAt: lesson.dueAt ? new Date(lesson.dueAt) : null,
  }));
}
