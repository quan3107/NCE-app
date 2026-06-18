/**
 * File: src/modules/nce-content/nce-content-authoring.service.ts
 * Purpose: Implement teacher/admin NCE lesson authoring mutations.
 * Why: Keeps write workflows separate from public read visibility rules.
 */
import { NcePublishStatus } from "../../prisma/index.js";

import { prisma } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
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
  assertCourseWritable,
  assertLessonFound,
  assertPublishable,
  assertUnitWritable,
  validateLessonWrite,
} from "./nce-content-authoring.validation.js";
import {
  assignNceLessonsSchema,
  courseNceLessonsParamsSchema,
  createNceLessonSchema,
  nceLessonParamsSchema,
  patchNceLessonSchema,
} from "./nce-content.schema.js";

export async function createNceLesson(
  payload: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const input = createNceLessonSchema.parse(payload);
  validateLessonWrite(input);
  await assertUnitWritable(input.unitId);

  const lesson = await readWithServiceRole(actor, async () => {
    const created = await prisma.nceLesson.create({
      data: createLessonData(input),
      select: authoredLessonSelect,
    });

    if (!input.exercises.length) {
      return created;
    }

    return prisma.nceLesson.update({
      where: { id: created.id },
      data: {
        exercises: {
          create: exerciseCreates(input, created.objectives),
        },
      },
      select: authoredLessonSelect,
    });
  });

  return mapAuthoredLesson(lesson as NceLessonRow);
}

export async function patchNceLesson(
  rawParams: unknown,
  payload: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { lessonId } = nceLessonParamsSchema.parse(rawParams);
  const input = patchNceLessonSchema.parse(payload);
  validateLessonWrite(input);

  if (input.unitId) {
    await assertUnitWritable(input.unitId);
  }
  assertLessonFound(await findAuthoredLesson(lessonId));

  const lesson = await readWithServiceRole(actor, async () => {
    const patched = await prisma.nceLesson.update({
      where: { id: lessonId },
      data: patchLessonData(input),
      select: authoredLessonSelect,
    });

    if (!input.exercises) {
      return patched;
    }

    return prisma.nceLesson.update({
      where: { id: lessonId },
      data: {
        exercises: {
          create: exerciseCreates(input, patched.objectives),
        },
      },
      select: authoredLessonSelect,
    });
  });

  return mapAuthoredLesson(lesson as NceLessonRow);
}

export async function publishNceLesson(
  rawParams: unknown,
  actor: RequestActor,
) {
  assertAuthor(actor);
  const { lessonId } = nceLessonParamsSchema.parse(rawParams);
  const current = assertLessonFound(await findAuthoredLesson(lessonId));
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
  const { lessonId } = nceLessonParamsSchema.parse(rawParams);
  assertLessonFound(await findAuthoredLesson(lessonId));

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

  const rows = assignmentRows(courseId, input);

  await readWithServiceRole(actor, async () => {
    await prisma.nceCourseLessonAssignment.deleteMany({
      where: { courseId },
    });

    if (rows.length > 0) {
      await prisma.nceCourseLessonAssignment.createMany({
        data: rows,
      });
    }
  });

  return {
    courseId,
    assignedCount: rows.length,
  };
}
