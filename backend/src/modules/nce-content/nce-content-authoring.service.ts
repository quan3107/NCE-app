/**
 * File: src/modules/nce-content/nce-content-authoring.service.ts
 * Purpose: Implement teacher/admin NCE lesson authoring mutations.
 * Why: Keeps write workflows separate from public read visibility rules.
 */
import { NcePublishStatus, Prisma } from "../../prisma/index.js";

import { prisma } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import type { NceLessonRow } from "./nce-content.mappers.js";
import {
  assignmentRows,
  authoredLessonSelect,
  createLessonData,
  exerciseCreates,
  findAuthoredLesson,
  mapAuthoredLesson,
  patchLessonData,
  readWithServiceRole,
} from "./nce-content-authoring.persistence.js";
import {
  assertAuthor,
  assertCreateCourseWritable,
  assertCourseScopedAssignmentsRetained,
  validateCourseAssignmentWrite,
  validateLessonExerciseObjectiveRefs,
  assertLessonsAssignableToCourse,
  assertLessonCourseWritable,
  assertCourseWritable,
  assertLessonFound,
  assertPublishable,
  assertUnitWritable,
  validateLessonWrite,
} from "./nce-content-authoring.validation.js";
import {
  assignNceLessonsSchema,
  courseNceLessonsParamsSchema,
  nceLessonCreateParamsSchema,
  createNceLessonSchema,
  nceLessonWriteParamsSchema,
  patchNceLessonSchema,
} from "./nce-content.schema.js";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (error instanceof Error && "code" in error)
  ) && (error as { code?: unknown }).code === "P2002";
}

function isLessonNumberConstraintTarget(target: unknown): boolean {
  if (Array.isArray(target)) {
    return target.includes("unit_id") && target.includes("lesson_number");
  }

  if (typeof target !== "string") {
    return false;
  }

  return (
    target.includes("lesson_number") ||
    target === "nce_lessons_global_unit_number_key" ||
    target === "nce_lessons_course_unit_number_key"
  );
}

async function withLessonNumberConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    if (isUniqueConstraintError(error) && isLessonNumberConstraintTarget(target)) {
      throw createHttpError(
        409,
        "NCE lesson number already exists for this unit",
      );
    }

    throw error;
  }
}

async function relinkExercisesToRecreatedObjectives(
  previousLesson: NceLessonRow,
  objectives: Array<{ id: string; code: string }>,
  db: Pick<typeof prisma, "nceExercise">,
) {
  const previousObjectives = previousLesson.objectives ?? [];
  const previousExercises = previousLesson.exercises ?? [];
  const oldObjectiveCodeById = new Map(
    previousObjectives.map((objective) => [objective.id, objective.code]),
  );
  const newObjectiveIdByCode = new Map(
    objectives.map((objective) => [objective.code, objective.id]),
  );

  await Promise.all(
    previousExercises.map((exercise) => {
      const objectiveCode = exercise.objectiveId
        ? oldObjectiveCodeById.get(exercise.objectiveId)
        : undefined;
      const objectiveId = objectiveCode
        ? newObjectiveIdByCode.get(objectiveCode) ?? null
        : null;

      return db.nceExercise.update({
        where: { id: exercise.id },
        data: { objectiveId },
      });
    }),
  );
}

async function findCurrentAuthoredLesson(
  lessonId: string,
  actor: RequestActor,
) {
  return assertLessonFound(
    await readWithServiceRole(actor, () => findAuthoredLesson(lessonId)),
  );
}

export async function createNceLesson(
  rawParams: unknown,
  payload: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { courseId } = nceLessonCreateParamsSchema.parse(rawParams);
  const input = createNceLessonSchema.parse(payload);
  validateLessonWrite(input);
  validateLessonExerciseObjectiveRefs(input, input.objectives, false);
  await assertCreateCourseWritable(courseId, actor);
  await assertUnitWritable(input.unitId);

  const lesson = await withLessonNumberConflict(() =>
    readWithServiceRole(actor, () => prisma.$transaction(async (tx) => {
      const sequence = courseId
        ? await nextCourseLessonSequence(courseId, tx)
        : null;
      const created = await tx.nceLesson.create({
        data: createLessonData(input, courseId),
        select: authoredLessonSelect,
      });

      const authored = input.exercises.length
        ? await tx.nceLesson.update({
            where: { id: created.id },
            data: {
              exercises: {
                create: exerciseCreates(input, created.objectives),
              },
            },
            select: authoredLessonSelect,
          })
        : created;

      if (courseId && sequence) {
        await tx.nceCourseLessonAssignment.create({
          data: {
            courseId,
            lessonId: created.id,
            sequence,
          },
        });
      }

      return authored;
    })),
  );

  return mapAuthoredLesson(lesson as NceLessonRow);
}

export async function patchNceLesson(
  rawParams: unknown,
  payload: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { lessonId, courseId } = nceLessonWriteParamsSchema.parse(rawParams);
  const input = patchNceLessonSchema.parse(payload);
  validateLessonWrite(input);

  if (input.unitId) {
    await assertUnitWritable(input.unitId);
  }
  const currentLesson = await findCurrentAuthoredLesson(lessonId, actor);
  await assertLessonCourseWritable(currentLesson, courseId, actor);
  if (input.exercises) {
    validateLessonExerciseObjectiveRefs(
      input,
      input.objectives ?? currentLesson.objectives,
      !input.objectives,
    );
  }

  const lesson = await withLessonNumberConflict(() =>
    readWithServiceRole(actor, () => prisma.$transaction(async (tx) => {
      const patched = await tx.nceLesson.update({
        where: { id: lessonId },
        data: patchLessonData(input),
        select: authoredLessonSelect,
      });

      if (!input.exercises) {
        if (input.objectives) {
          await relinkExercisesToRecreatedObjectives(
            currentLesson as NceLessonRow,
            patched.objectives,
            tx,
          );

          return assertLessonFound(await findAuthoredLesson(lessonId, tx));
        }

        return patched;
      }

      return tx.nceLesson.update({
        where: { id: lessonId },
        data: {
          exercises: {
            create: exerciseCreates(input, patched.objectives),
          },
        },
        select: authoredLessonSelect,
      });
    })),
  );

  return mapAuthoredLesson(lesson as NceLessonRow);
}

export async function publishNceLesson(
  rawParams: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { lessonId, courseId } = nceLessonWriteParamsSchema.parse(rawParams);
  const current = await findCurrentAuthoredLesson(lessonId, actor);
  await assertLessonCourseWritable(current, courseId, actor);
  assertPublishable(current);

  const lesson = await readWithServiceRole(actor, () =>
    prisma.nceLesson.update({
      where: { id: lessonId },
      data: {
        status: NcePublishStatus.published,
        publishedAt: new Date(),
      },
      select: authoredLessonSelect,
    }),
  );

  return mapAuthoredLesson(lesson as NceLessonRow);
}

export async function unpublishNceLesson(
  rawParams: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { lessonId, courseId } = nceLessonWriteParamsSchema.parse(rawParams);
  const current = await findCurrentAuthoredLesson(lessonId, actor);
  await assertLessonCourseWritable(current, courseId, actor);

  const lesson = await readWithServiceRole(actor, () =>
    prisma.nceLesson.update({
      where: { id: lessonId },
      data: {
        status: NcePublishStatus.draft,
        publishedAt: null,
      },
      select: authoredLessonSelect,
    }),
  );

  return mapAuthoredLesson(lesson as NceLessonRow);
}

export async function assignNceLessonsToCourse(
  rawParams: unknown,
  payload: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { courseId } = courseNceLessonsParamsSchema.parse(rawParams);
  const input = assignNceLessonsSchema.parse(payload);
  await assertCourseWritable(courseId, actor);
  validateCourseAssignmentWrite(input);
  await assertLessonsAssignableToCourse(courseId, input, actor);
  await assertCourseScopedAssignmentsRetained(courseId, input, actor);

  const rows = assignmentRows(courseId, input);

  await readWithServiceRole(actor, () =>
    prisma.$transaction(async (tx) => {
      await tx.nceCourseLessonAssignment.deleteMany({
        where: { courseId },
      });

      if (rows.length > 0) {
        await tx.nceCourseLessonAssignment.createMany({
          data: rows,
        });
      }
    }),
  );

  return {
    courseId,
    assignedCount: rows.length,
  };
}

async function nextCourseLessonSequence(
  courseId: string,
  db: Pick<typeof prisma, "nceCourseLessonAssignment"> = prisma,
): Promise<number> {
  const result = await db.nceCourseLessonAssignment.aggregate({
    where: { courseId },
    _max: { sequence: true },
  });

  return (result._max.sequence ?? 0) + 1;
}
