/**
 * File: src/modules/nce-attempts/nce-attempts.service.ts
 * Purpose: Implement student NCE learning path, progress, and exercise attempts.
 * Why: Turns assigned NCE content into a persistent student learning workflow.
 */
import {
  EnrollmentRole,
  NceAttemptStatus,
  NceExerciseType,
  NceLessonProgressStatus,
  NcePublishStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "../../prisma/index.js";

import { prisma, runWithRole } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import type { NceLessonRow } from "../nce-content/nce-content.mappers.js";
import {
  mapNceAttempt,
  mapNceAttemptSummary,
  mapNcePathAssignment,
  mapNceProgress,
  type NceAttemptSummaryRow,
  type NceExerciseAttemptRow,
  type NcePathAssignmentRow,
} from "./nce-attempts.mappers.js";
import {
  courseNceExerciseParamsSchema,
  courseNceLessonParamsSchema,
  courseNcePathParamsSchema,
  nceAttemptParamsSchema,
  nceAttemptSummaryQuerySchema,
  nceAttemptWriteSchema,
  ncePathQuerySchema,
  type NceAttemptSummaryQuery,
  type NcePathQuery,
} from "./nce-attempts.schema.js";

type CourseAccess = "admin" | "owner" | "coTeacher" | "student" | "none";

const lessonSelect = {
  id: true,
  courseId: true,
  unitId: true,
  lessonNumber: true,
  title: true,
  lessonText: true,
  mediaJson: true,
  teacherNotes: false,
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
      scoringConfig: true,
      sortOrder: true,
    },
  },
};

type ScoredResult = {
  score: number | null;
  maxScore: number | null;
  feedbackJson: Prisma.InputJsonValue;
};

const automaticallyScoredTypes: NceExerciseType[] = [
  NceExerciseType.vocabulary,
  NceExerciseType.grammar,
  NceExerciseType.dictation,
  NceExerciseType.gap_fill,
  NceExerciseType.multiple_choice,
  NceExerciseType.reading,
];

const availableAssignmentWhere = () => ({
  OR: [
    { availableFrom: null },
    { availableFrom: { lte: new Date() } },
  ],
});

const pagination = (query: NcePathQuery) => ({
  skip: (query.page - 1) * query.pageSize,
  take: query.pageSize,
});

const paginationResponse = (query: NcePathQuery, total: number) => ({
  page: query.page,
  pageSize: query.pageSize,
  total,
});

function readWithServiceRole<T>(
  actor: RequestActor,
  read: () => Promise<T>,
): Promise<T> {
  return runWithRole(
    {
      role: "service_role",
      userId: actor.id,
      userRole: actor.role,
    },
    read,
  );
}

function getCourseAccess(
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

  const activeEnrollment = course.enrollments.find(
    (enrollment) =>
      enrollment.userId === actor.id &&
      !enrollment.deletedAt &&
      !enrollment.user?.deletedAt &&
      enrollment.user?.status === UserStatus.active,
  );

  if (
    actor.role === UserRole.teacher &&
    activeEnrollment?.roleInCourse === EnrollmentRole.teacher
  ) {
    return "coTeacher";
  }

  if (
    actor.role === UserRole.student &&
    activeEnrollment?.roleInCourse === EnrollmentRole.student
  ) {
    return "student";
  }

  return "none";
}

async function assertCourseAccess(
  courseId: string,
  actor: RequestActor,
): Promise<CourseAccess> {
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

  const access = getCourseAccess(course, actor);
  if (access === "none") {
    throw createHttpError(403, "You are not enrolled in this course");
  }

  return access;
}

async function assertStudentCourseAccess(courseId: string, actor: RequestActor) {
  if (actor.role !== UserRole.student) {
    throw createHttpError(403, "Student access is required");
  }

  const access = await assertCourseAccess(courseId, actor);
  if (access !== "student") {
    throw createHttpError(403, "You are not enrolled in this course");
  }
}

async function assertTeacherCourseAccess(courseId: string, actor: RequestActor) {
  const access = await assertCourseAccess(courseId, actor);
  if (access !== "admin" && access !== "owner" && access !== "coTeacher") {
    throw createHttpError(403, "Teacher or admin access is required");
  }
}

function lessonContentWhere(): Prisma.NceLessonWhereInput {
  return {
    status: NcePublishStatus.published,
    deletedAt: null,
    unit: {
      status: NcePublishStatus.published,
      deletedAt: null,
      book: {
        status: NcePublishStatus.published,
        deletedAt: null,
      },
    },
  };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "" ? null : normalized;
}

function getResponseAnswer(response: Prisma.JsonValue): string | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }

  const record = response as Record<string, unknown>;
  return normalizeText(record.answer ?? record.text ?? record.value);
}

function collectExpectedAnswers(answerKey: Prisma.JsonValue): string[] {
  if (!answerKey || typeof answerKey !== "object" || Array.isArray(answerKey)) {
    return [];
  }

  const record = answerKey as Record<string, unknown>;
  const values: unknown[] = [];
  for (const key of ["answers", "blanks", "accepted", "samples"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      values.push(...value);
    }
  }
  for (const key of ["acceptedAnswers", "sample"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      values.push(...value);
    } else {
      values.push(value);
    }
  }
  for (const key of ["answer", "choice", "correctChoiceId", "sentence"]) {
    values.push(record[key]);
  }

  const matches = record.matches;
  if (matches && typeof matches === "object" && !Array.isArray(matches)) {
    values.push(...Object.keys(matches));
    values.push(...Object.values(matches as Record<string, unknown>));
  }

  return values
    .map(normalizeText)
    .filter((value): value is string => Boolean(value));
}

function maxPoints(scoringConfig: Prisma.JsonValue | null): number {
  if (!scoringConfig || typeof scoringConfig !== "object" || Array.isArray(scoringConfig)) {
    return 1;
  }

  const points = (scoringConfig as Record<string, unknown>).points;
  return typeof points === "number" && Number.isFinite(points) && points > 0
    ? Math.round(points)
    : 1;
}

function scoreAttempt(
  exercise: {
    exerciseType: NceExerciseType;
    answerKey: Prisma.JsonValue;
    scoringConfig: Prisma.JsonValue | null;
  },
  response: Prisma.JsonValue,
): ScoredResult {
  const expectedAnswers = collectExpectedAnswers(exercise.answerKey);
  const studentAnswer = getResponseAnswer(response);
  const canScore =
    studentAnswer &&
    expectedAnswers.length > 0 &&
    automaticallyScoredTypes.includes(exercise.exerciseType);

  if (!canScore) {
    return {
      score: null,
      maxScore: null,
      feedbackJson: {
        correct: null,
        manualReviewRequired: true,
      },
    };
  }

  const correct = expectedAnswers.includes(studentAnswer);
  const maxScore = maxPoints(exercise.scoringConfig);
  return {
    score: correct ? maxScore : 0,
    maxScore,
    feedbackJson: {
      correct,
      manualReviewRequired: false,
    },
  };
}

export async function listStudentNcePath(
  rawParams: unknown,
  actor: RequestActor,
  rawQuery?: unknown,
) {
  const { courseId } = courseNcePathParamsSchema.parse(rawParams);
  const query = ncePathQuerySchema.parse(rawQuery ?? {});
  await assertStudentCourseAccess(courseId, actor);
  const pageArgs = pagination(query);
  const where = {
    courseId,
    ...availableAssignmentWhere(),
    lesson: lessonContentWhere(),
  };

  const [assignments, total] = await readWithServiceRole(actor, () =>
    Promise.all([
      prisma.nceCourseLessonAssignment.findMany({
        where,
        select: {
          sequence: true,
          availableFrom: true,
          dueAt: true,
          lesson: {
            select: {
              ...lessonSelect,
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
                  attempts: {
                    where: { courseId, studentId: actor.id },
                    orderBy: { updatedAt: "desc" as const },
                    take: 1,
                  },
                },
              },
              progress: {
                where: { courseId, studentId: actor.id },
                select: {
                  status: true,
                  startedAt: true,
                  completedAt: true,
                  updatedAt: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ sequence: "asc" }],
        ...pageArgs,
      }),
      prisma.nceCourseLessonAssignment.count({ where }),
    ]),
  );

  return {
    lessons: assignments.map((assignment) => {
      const lesson = assignment.lesson as NceLessonRow & {
        progress?: NcePathAssignmentRow["progress"];
      };
      const { progress, ...lessonPayload } = lesson;

      return mapNcePathAssignment({
        ...assignment,
        progress,
        lesson: lessonPayload,
      } as NcePathAssignmentRow);
    }),
    pagination: paginationResponse(query, total),
  };
}

export async function createOrUpdateNceAttempt(
  rawParams: unknown,
  payload: unknown,
  actor: RequestActor,
) {
  const { courseId, exerciseId } = courseNceExerciseParamsSchema.parse(rawParams);
  const input = nceAttemptWriteSchema.parse(payload);
  await assertStudentCourseAccess(courseId, actor);

  const exercise = await readWithServiceRole(actor, () =>
    prisma.nceExercise.findFirst({
      where: {
        id: exerciseId,
        lesson: {
          courseAssignments: {
            some: {
              courseId,
              ...availableAssignmentWhere(),
            },
          },
          ...lessonContentWhere(),
        },
      },
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
        lesson: {
          select: {
            id: true,
            status: true,
            courseAssignments: {
              where: { courseId },
              select: { courseId: true },
            },
          },
        },
      },
    }),
  );

  if (!exercise) {
    throw createHttpError(404, "NCE exercise not found");
  }

  await readWithServiceRole(actor, () =>
    prisma.nceLessonProgress.upsert({
      where: {
        courseId_lessonId_studentId: {
          courseId,
          lessonId: exercise.lessonId,
          studentId: actor.id,
        },
      },
      create: {
        courseId,
        lessonId: exercise.lessonId,
        studentId: actor.id,
        status: NceLessonProgressStatus.in_progress,
      },
      update: {
        status: NceLessonProgressStatus.in_progress,
      },
    }),
  );

  const existingDraft = await readWithServiceRole(actor, () =>
    prisma.nceExerciseAttempt.findFirst({
      where: {
        courseId,
        exerciseId,
        studentId: actor.id,
        status: NceAttemptStatus.draft,
      },
      include: { exercise: true },
      orderBy: { updatedAt: "desc" },
    }),
  );

  const response = input.response as Prisma.InputJsonValue;
  const attempt = existingDraft
    ? await readWithServiceRole(actor, () =>
        prisma.nceExerciseAttempt.update({
          where: { id: existingDraft.id },
          data: { response },
          include: { exercise: true },
        }),
      )
    : await readWithServiceRole(actor, () =>
        prisma.nceExerciseAttempt.create({
          data: {
            courseId,
            lessonId: exercise.lessonId,
            exerciseId,
            studentId: actor.id,
            status: NceAttemptStatus.draft,
            response,
          },
          include: { exercise: true },
        }),
      );

  return mapNceAttempt(attempt as NceExerciseAttemptRow);
}

export async function submitNceAttempt(
  rawParams: unknown,
  actor: RequestActor,
) {
  if (actor.role !== UserRole.student) {
    throw createHttpError(403, "Student access is required");
  }

  const { attemptId } = nceAttemptParamsSchema.parse(rawParams);
  const attempt = await readWithServiceRole(actor, () =>
    prisma.nceExerciseAttempt.findFirst({
      where: {
        id: attemptId,
        studentId: actor.id,
        status: NceAttemptStatus.draft,
      },
      include: {
        exercise: true,
      },
    }),
  );

  if (!attempt) {
    throw createHttpError(404, "NCE attempt not found");
  }

  const scored = scoreAttempt(attempt.exercise, attempt.response);
  const submitted = await readWithServiceRole(actor, () =>
    prisma.nceExerciseAttempt.update({
      where: { id: attemptId },
      data: {
        status: NceAttemptStatus.submitted,
        score: scored.score,
        maxScore: scored.maxScore,
        feedbackJson: scored.feedbackJson,
        submittedAt: new Date(),
      },
      include: { exercise: true },
    }),
  );

  return mapNceAttempt(submitted as NceExerciseAttemptRow);
}

export async function completeNceLesson(
  rawParams: unknown,
  actor: RequestActor,
) {
  const { courseId, lessonId } = courseNceLessonParamsSchema.parse(rawParams);
  await assertStudentCourseAccess(courseId, actor);

  const assignment = await readWithServiceRole(actor, () =>
    prisma.nceCourseLessonAssignment.findFirst({
      where: {
        courseId,
        lessonId,
        ...availableAssignmentWhere(),
        lesson: lessonContentWhere(),
      },
      select: { courseId: true, lessonId: true },
    }),
  );

  if (!assignment) {
    throw createHttpError(404, "NCE lesson assignment not found");
  }

  const progress = await readWithServiceRole(actor, () =>
    prisma.nceLessonProgress.upsert({
      where: {
        courseId_lessonId_studentId: {
          courseId,
          lessonId,
          studentId: actor.id,
        },
      },
      create: {
        courseId,
        lessonId,
        studentId: actor.id,
        status: NceLessonProgressStatus.completed,
        completedAt: new Date(),
      },
      update: {
        status: NceLessonProgressStatus.completed,
        completedAt: new Date(),
      },
    }),
  );

  return mapNceProgress(progress);
}

export async function listTeacherNceAttemptSummaries(
  rawParams: unknown,
  actor: RequestActor,
  rawQuery?: unknown,
) {
  const { courseId } = courseNcePathParamsSchema.parse(rawParams);
  const query: NceAttemptSummaryQuery = nceAttemptSummaryQuerySchema.parse(rawQuery ?? {});
  await assertTeacherCourseAccess(courseId, actor);
  const pageArgs = pagination(query);

  const where: Prisma.NceExerciseAttemptWhereInput = {
    courseId,
    studentId: query.studentId,
    lessonId: query.lessonId,
  };

  const [attempts, total] = await readWithServiceRole(actor, () =>
    Promise.all([
      prisma.nceExerciseAttempt.findMany({
        where,
        select: {
          id: true,
          courseId: true,
          lessonId: true,
          exerciseId: true,
          studentId: true,
          status: true,
          score: true,
          maxScore: true,
          submittedAt: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          exercise: {
            select: {
              id: true,
              exerciseType: true,
              prompt: true,
              sortOrder: true,
              lesson: {
                select: {
                  id: true,
                  title: true,
                  lessonNumber: true,
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...pageArgs,
      }),
      prisma.nceExerciseAttempt.count({ where }),
    ]),
  );

  return {
    attempts: attempts.map((attempt) =>
      mapNceAttemptSummary(attempt as NceAttemptSummaryRow),
    ),
    pagination: paginationResponse(query, total),
  };
}
