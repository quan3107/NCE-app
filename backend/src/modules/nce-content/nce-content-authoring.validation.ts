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
  AssignNceLessonsInput,
  CreateNceLessonInput,
  PatchNceLessonInput,
} from "./nce-content.schema.js";
import { readWithServiceRole } from "./nce-content-authoring.persistence.js";

type LessonWriteInput = CreateNceLessonInput | PatchNceLessonInput;
type CourseAccess = "admin" | "owner" | "coTeacher" | "none";
type ObjectiveReference = { id?: string; code: string };
const courseAssignableLessonStatuses = new Set<NcePublishStatus>([
  NcePublishStatus.draft,
  NcePublishStatus.published,
]);

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
  const objectiveCodes = new Set<string>();
  for (const objective of input.objectives ?? []) {
    if (objectiveCodes.has(objective.code)) {
      throw createHttpError(400, "NCE objective codes must be unique");
    }
    objectiveCodes.add(objective.code);
  }

  const exerciseKeys = new Set<string>();
  for (const exercise of input.exercises ?? []) {
    const exerciseKey = `${exercise.exerciseType}:${exercise.sortOrder}`;
    if (exerciseKeys.has(exerciseKey)) {
      throw createHttpError(400, "NCE exercise type and sort order must be unique");
    }
    exerciseKeys.add(exerciseKey);
    validateExerciseAnswerKey(exercise.exerciseType, exercise.answerKey);
  }
}

export function validateLessonExerciseObjectiveRefs(
  input: LessonWriteInput,
  objectives: ObjectiveReference[],
  allowObjectiveIds: boolean,
): void {
  const objectiveCodes = new Set(objectives.map((objective) => objective.code));
  const objectiveIds = new Set(
    objectives
      .map((objective) => objective.id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const exercise of input.exercises ?? []) {
    if (exercise.objectiveCode) {
      if (!objectiveCodes.has(exercise.objectiveCode)) {
        throw createHttpError(
          400,
          "NCE exercise objectiveCode does not match an authored objective",
        );
      }
      continue;
    }

    if (exercise.objectiveId && (!allowObjectiveIds || !objectiveIds.has(exercise.objectiveId))) {
      throw createHttpError(
        400,
        "NCE exercise objectiveId does not match an authored objective",
      );
    }
  }
}

export function validateCourseAssignmentWrite(input: AssignNceLessonsInput): void {
  const lessonIds = new Set<string>();
  const sequences = new Set<number>();

  for (const lesson of input.lessons) {
    if (lessonIds.has(lesson.lessonId)) {
      throw createHttpError(
        400,
        "NCE course lesson assignments cannot repeat a lesson",
      );
    }
    lessonIds.add(lesson.lessonId);

    if (sequences.has(lesson.sequence)) {
      throw createHttpError(
        400,
        "NCE course lesson assignment sequences must be unique",
      );
    }
    sequences.add(lesson.sequence);
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

export async function assertCreateCourseWritable(
  courseId: string | undefined,
  actor: RequestActor,
): Promise<void> {
  if (actor.role === UserRole.teacher && !courseId) {
    throw createHttpError(400, "courseId is required to create teacher NCE lessons");
  }

  if (courseId) {
    await assertCourseWritable(courseId, actor);
  }
}

export async function assertLessonCourseWritable(
  lesson: { id: string; courseId?: string | null },
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

  if (lesson.courseId !== courseId) {
    throw createHttpError(403, "NCE lesson is not editable in this course");
  }

  const assignment = await readWithServiceRole(actor, () =>
    prisma.nceCourseLessonAssignment.findFirst({
      where: {
        courseId,
        lessonId: lesson.id,
      },
      select: {
        courseId: true,
      },
    }),
  );

  if (!assignment) {
    throw createHttpError(403, "NCE lesson is not assigned to this course");
  }
}

export async function assertLessonsAssignableToCourse(
  courseId: string,
  payload: AssignNceLessonsInput,
  actor: RequestActor,
): Promise<void> {
  const lessonIds = [...new Set(payload.lessons.map((lesson) => lesson.lessonId))];
  if (lessonIds.length === 0) {
    return;
  }

  const lessons = await readWithServiceRole(actor, () =>
    prisma.nceLesson.findMany({
      where: {
        id: { in: lessonIds },
        deletedAt: null,
        unit: {
          deletedAt: null,
          book: { deletedAt: null },
        },
      },
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    }),
  );

  if (lessons.length !== lessonIds.length) {
    throw createHttpError(404, "NCE lesson not found");
  }

  for (const lesson of lessons) {
    if (lesson.courseId) {
      if (
        lesson.courseId !== courseId ||
        !courseAssignableLessonStatuses.has(lesson.status)
      ) {
        throw createHttpError(403, "NCE lesson cannot be assigned to this course");
      }
      continue;
    }

    if (lesson.status !== NcePublishStatus.published) {
      throw createHttpError(403, "NCE lesson cannot be assigned to this course");
    }
  }
}
