/**
 * File: src/modules/nce-content/nce-content-authoring.validation.ts
 * Purpose: Validate NCE authoring roles, content, and parent access.
 * Why: Keeps mutation services readable and errors domain-specific.
 */
import {
  EnrollmentRole,
  NceExerciseType,
  NcePublishStatus,
  UserRole,
  UserStatus,
} from "../../prisma/index.js";

import { prisma } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import type {
  CreateNceLessonInput,
  PatchNceLessonInput,
} from "./nce-content.schema.js";

type LessonWriteInput = CreateNceLessonInput | PatchNceLessonInput;
type CourseAccess = "admin" | "owner" | "coTeacher" | "none";

export function assertAuthor(actor: RequestActor): void {
  if (actor.role !== UserRole.admin && actor.role !== UserRole.teacher) {
    throw createHttpError(403, "Teacher or admin access is required");
  }
}

function hasAnswerList(value: Record<string, unknown>): boolean {
  const answers = value.answers ?? value.acceptedAnswers;
  return (
    Array.isArray(answers) &&
    answers.some((answer) => typeof answer === "string" && answer.trim().length > 0)
  );
}

function validateExerciseAnswerKey(
  exerciseType: NceExerciseType,
  answerKey: Record<string, unknown>,
): void {
  if (exerciseType === NceExerciseType.multiple_choice) {
    if (typeof answerKey.correctChoiceId !== "string" || !answerKey.correctChoiceId.trim()) {
      throw createHttpError(400, "NCE exercise answer key is incomplete");
    }
    return;
  }

  if (!hasAnswerList(answerKey)) {
    throw createHttpError(400, "NCE exercise answer key is incomplete");
  }
}

export function validateLessonWrite(input: LessonWriteInput): void {
  for (const exercise of input.exercises ?? []) {
    validateExerciseAnswerKey(exercise.exerciseType, exercise.answerKey);
  }
}

export async function assertUnitWritable(unitId: string): Promise<void> {
  const unit = await prisma.nceUnit.findFirst({
    where: {
      id: unitId,
      deletedAt: null,
      book: { deletedAt: null },
    },
    select: {
      id: true,
    },
  });

  if (!unit) {
    throw createHttpError(404, "NCE unit not found");
  }
}

export function assertLessonFound<T>(lesson: T | null): T {
  if (!lesson) {
    throw createHttpError(404, "NCE lesson not found");
  }

  return lesson;
}

export function assertPublishable(lesson: {
  title: string;
  lessonText: string;
  unit: {
    status: NcePublishStatus;
    book?: { status: NcePublishStatus } | null;
  };
  objectives: unknown[];
  exercises: unknown[];
}): void {
  if (!lesson.title.trim() || !lesson.lessonText.trim()) {
    throw createHttpError(409, "Complete lesson title and text before publishing");
  }

  if (lesson.unit.status !== NcePublishStatus.published || lesson.unit.book?.status !== NcePublishStatus.published) {
    throw createHttpError(409, "Publish the parent NCE book and unit before publishing this lesson");
  }

  if (lesson.objectives.length === 0 || lesson.exercises.length === 0) {
    throw createHttpError(409, "Add at least one objective and one exercise before publishing");
  }
}

function courseAccess(
  course: {
    ownerId: string;
    enrollments: Array<{
      userId: string;
      roleInCourse: EnrollmentRole;
      deletedAt: Date | null;
      user?: { deletedAt: Date | null; status: UserStatus } | null;
    }>;
  },
  actor: RequestActor,
): CourseAccess {
  if (actor.role === UserRole.admin) {
    return "admin";
  }

  if (actor.role === UserRole.teacher && course.ownerId === actor.id) {
    return "owner";
  }

  const enrollment = course.enrollments.find(
    (item) =>
      item.userId === actor.id &&
      !item.deletedAt &&
      !item.user?.deletedAt &&
      item.user?.status === UserStatus.active,
  );

  if (
    actor.role === UserRole.teacher &&
    enrollment?.roleInCourse === EnrollmentRole.teacher
  ) {
    return "coTeacher";
  }

  return "none";
}

export async function assertCourseWritable(
  courseId: string,
  actor: RequestActor,
): Promise<void> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
    select: {
      id: true,
      ownerId: true,
      enrollments: {
        where: {
          deletedAt: null,
          user: { deletedAt: null },
        },
        select: {
          userId: true,
          roleInCourse: true,
          deletedAt: true,
          user: {
            select: {
              deletedAt: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw createHttpError(404, "Course not found");
  }

  if (courseAccess(course, actor) === "none") {
    throw createHttpError(403, "You do not have permission to manage this course");
  }
}

export async function assertLessonCourseWritable(
  lessonId: string,
  courseId: string | undefined,
  actor: RequestActor,
): Promise<void> {
  if (actor.role === UserRole.admin) {
    return;
  }

  if (!courseId) {
    throw createHttpError(400, "courseId is required to modify teacher NCE lessons");
  }

  await assertCourseWritable(courseId, actor);

  const assignment = await prisma.nceCourseLessonAssignment.findFirst({
    where: {
      courseId,
      lessonId,
    },
    select: {
      courseId: true,
    },
  });

  if (!assignment) {
    throw createHttpError(403, "NCE lesson is not assigned to this course");
  }
}
