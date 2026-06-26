/**
 * File: src/modules/nce-attempts/nce-attempts.service.ts
 * Purpose: Implement student NCE learning path, progress, and exercise attempts.
 * Why: Turns assigned NCE content into a persistent student learning workflow.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";

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

import { config } from "../../config/env.js";
import { prisma, runWithRole } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import { signNceAssetToken } from "../auth/auth.tokens.js";
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
  nceAssetContentQuerySchema,
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
  NceExerciseType.listening,
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

function normalizeText(value: unknown, punctuationOptional = false): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let text = value.trim().toLowerCase();
  if (punctuationOptional) {
    text = text.replace(/[^\p{L}\p{N}\s]/gu, " ");
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized === "" ? null : normalized;
}

function getResponseAnswer(
  response: Prisma.JsonValue,
  punctuationOptional = false,
): string | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }

  const record = response as Record<string, unknown>;
  return normalizeText(record.answer ?? record.text ?? record.value, punctuationOptional);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getExpectedMatches(
  answerKey: Prisma.JsonValue,
  punctuationOptional = false,
): Array<{ prompt: string; answer: string }> {
  const record = getRecord(answerKey);
  const matches = getRecord(record?.matches);
  if (!matches) {
    return [];
  }

  return Object.entries(matches).flatMap(([prompt, answer]) => {
    const normalizedPrompt = normalizeText(prompt, punctuationOptional);
    const normalizedAnswer = normalizeText(answer, punctuationOptional);
    if (!normalizedPrompt || !normalizedAnswer) {
      return [];
    }

    return [{ prompt: normalizedPrompt, answer: normalizedAnswer }];
  });
}

function getResponseMatches(
  response: Prisma.JsonValue,
  punctuationOptional = false,
): Map<string, string> {
  const record = getRecord(response);
  const matches = getRecord(record?.matches);
  const normalizedMatches = new Map<string, string>();
  if (!matches) {
    return normalizedMatches;
  }

  Object.entries(matches).forEach(([prompt, answer]) => {
    const normalizedPrompt = normalizeText(prompt, punctuationOptional);
    const normalizedAnswer = normalizeText(answer, punctuationOptional);
    if (normalizedPrompt && normalizedAnswer) {
      normalizedMatches.set(normalizedPrompt, normalizedAnswer);
    }
  });

  return normalizedMatches;
}

function getExpectedBlanks(
  answerKey: Prisma.JsonValue,
  punctuationOptional = false,
): string[][] {
  const record = getRecord(answerKey);
  const blanks = record?.blanks;
  if (!Array.isArray(blanks)) {
    return [];
  }

  return blanks
    .map((blank) => {
      const acceptedValues = Array.isArray(blank) ? blank : [blank];
      return acceptedValues
        .map((value) => normalizeText(value, punctuationOptional))
        .filter((value): value is string => Boolean(value));
    })
    .filter((acceptedValues) => acceptedValues.length > 0);
}

function getResponseBlanks(
  response: Prisma.JsonValue,
  blankCount: number,
  punctuationOptional = false,
): Array<string | null> {
  const record = getRecord(response);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.blanks)) {
    return record.blanks.map((value) => normalizeText(value, punctuationOptional));
  }

  if (blankCount === 1) {
    return [normalizeText(record.answer ?? record.text ?? record.value, punctuationOptional)];
  }

  return [];
}

function collectExpectedAnswers(
  answerKey: Prisma.JsonValue,
  punctuationOptional = false,
): string[] {
  if (!answerKey || typeof answerKey !== "object" || Array.isArray(answerKey)) {
    return [];
  }

  const record = answerKey as Record<string, unknown>;
  const values: unknown[] = [];
  for (const key of ["answers", "accepted", "samples"]) {
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

  return values
    .map((value) => normalizeText(value, punctuationOptional))
    .filter((value): value is string => Boolean(value));
}

function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function maxPoints(scoringConfig: Prisma.JsonValue | null, itemCount: number): number {
  if (!scoringConfig || typeof scoringConfig !== "object" || Array.isArray(scoringConfig)) {
    return 1;
  }

  const record = scoringConfig as Record<string, unknown>;
  const maxScore = positiveNumber(record.maxScore);
  if (maxScore) {
    return Math.round(maxScore);
  }

  const points = positiveNumber(record.points);
  if (points) {
    return Math.round(points);
  }

  const pointsPerItem =
    positiveNumber(record.pointsPerMatch) ?? positiveNumber(record.pointsPerBlank);
  if (pointsPerItem) {
    return Math.max(1, Math.round(pointsPerItem * Math.max(1, itemCount)));
  }

  return 1;
}

function partialScore(correctCount: number, itemCount: number, maxScore: number): number {
  if (correctCount <= 0 || itemCount <= 0) {
    return 0;
  }

  if (correctCount >= itemCount) {
    return maxScore;
  }

  return Math.min(maxScore - 1, Math.floor((correctCount * maxScore) / itemCount));
}

function scoreBlankAttempt(
  expectedBlanks: string[][],
  response: Prisma.JsonValue,
  scoringConfig: Prisma.JsonValue | null,
  punctuationOptional: boolean,
): ScoredResult {
  const responseBlanks = getResponseBlanks(
    response,
    expectedBlanks.length,
    punctuationOptional,
  );
  const maxScore = maxPoints(scoringConfig, expectedBlanks.length);
  const correctBlanks = expectedBlanks.filter((acceptedValues, index) => {
    const submittedValue = responseBlanks[index];
    return submittedValue ? acceptedValues.includes(submittedValue) : false;
  }).length;
  const correct = correctBlanks === expectedBlanks.length;

  return {
    score: partialScore(correctBlanks, expectedBlanks.length, maxScore),
    maxScore,
    feedbackJson: {
      correct,
      manualReviewRequired: false,
    },
  };
}

function scoreMatchingAttempt(
  expectedMatches: Array<{ prompt: string; answer: string }>,
  response: Prisma.JsonValue,
  scoringConfig: Prisma.JsonValue | null,
  punctuationOptional: boolean,
): ScoredResult {
  const responseMatches = getResponseMatches(response, punctuationOptional);
  const maxScore = maxPoints(scoringConfig, expectedMatches.length);
  const correctPairs = expectedMatches.filter(
    (match) => responseMatches.get(match.prompt) === match.answer,
  ).length;
  const correct = correctPairs === expectedMatches.length;

  return {
    score: partialScore(correctPairs, expectedMatches.length, maxScore),
    maxScore,
    feedbackJson: {
      correct,
      manualReviewRequired: false,
    },
  };
}

function scoreAttempt(
  exercise: {
    exerciseType: NceExerciseType;
    answerKey: Prisma.JsonValue;
    scoringConfig: Prisma.JsonValue | null;
  },
  response: Prisma.JsonValue,
): ScoredResult {
  const scoringConfig =
    exercise.scoringConfig && typeof exercise.scoringConfig === "object" &&
    !Array.isArray(exercise.scoringConfig)
      ? (exercise.scoringConfig as Record<string, unknown>)
      : {};
  const punctuationOptional = scoringConfig.punctuationOptional === true;
  const expectedBlanks = getExpectedBlanks(exercise.answerKey, punctuationOptional);
  const expectedAnswers = collectExpectedAnswers(
    exercise.answerKey,
    punctuationOptional,
  );
  const expectedMatches = getExpectedMatches(exercise.answerKey, punctuationOptional);
  if (
    expectedBlanks.length > 0 &&
    automaticallyScoredTypes.includes(exercise.exerciseType)
  ) {
    return scoreBlankAttempt(
      expectedBlanks,
      response,
      exercise.scoringConfig,
      punctuationOptional,
    );
  }

  if (
    expectedMatches.length > 0 &&
    automaticallyScoredTypes.includes(exercise.exerciseType)
  ) {
    return scoreMatchingAttempt(
      expectedMatches,
      response,
      exercise.scoringConfig,
      punctuationOptional,
    );
  }

  const studentAnswer = getResponseAnswer(response, punctuationOptional);
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
  const maxScore = maxPoints(exercise.scoringConfig, expectedAnswers.length);
  return {
    score: correct ? maxScore : 0,
    maxScore,
    feedbackJson: {
      correct,
      manualReviewRequired: false,
    },
  };
}

function mimeForNceAssetKey(key: string): string {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (normalizedKey.endsWith(".wav")) {
    return "audio/wav";
  }
  if (normalizedKey.endsWith(".ogg")) {
    return "audio/ogg";
  }
  if (normalizedKey.endsWith(".m4a")) {
    return "audio/mp4";
  }

  return "application/octet-stream";
}

function contentReferencesAudioKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => contentReferencesAudioKey(item, key));
  }

  const record = getRecord(value);
  if (!record) {
    return false;
  }

  return (
    record.audioKey === key ||
    Object.values(record).some((item) => contentReferencesAudioKey(item, key))
  );
}

function buildNceAssetAudioUrl(
  courseId: string,
  key: string,
  actor: RequestActor,
): string {
  const token = signNceAssetToken({
    userId: actor.id,
    role: actor.role,
    status: actor.status,
    courseId,
    key,
  });
  const params = new URLSearchParams({ key, token });
  return `/api/v1/courses/${courseId}/nce-assets/content/audio?${params.toString()}`;
}

const isPrismaUniqueConflict = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002";
  }

  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "P2002";
};

function nceAssetFilePath(key: string): string {
  const assetRoot = process.env.NCE_ASSET_ROOT ?? config.nceAssets.root;
  if (!assetRoot) {
    throw createHttpError(404, "NCE asset storage is not configured.");
  }

  const rootPath = path.resolve(assetRoot);
  const filePath = path.resolve(rootPath, key);
  const relativePath = path.relative(rootPath, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw createHttpError(404, "NCE asset not found.");
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw createHttpError(404, "NCE asset not found.");
  }

  return filePath;
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

export async function getNceAssetContentLocation(
  rawParams: unknown,
  rawQuery: unknown,
  actor: RequestActor,
) {
  const { courseId } = courseNcePathParamsSchema.parse(rawParams);
  const { key } = nceAssetContentQuerySchema.parse(rawQuery ?? {});
  await assertStudentCourseAccess(courseId, actor);

  const assignments = await readWithServiceRole(actor, () =>
    prisma.nceCourseLessonAssignment.findMany({
      where: {
        courseId,
        ...availableAssignmentWhere(),
        lesson: lessonContentWhere(),
      },
      select: {
        lesson: {
          select: {
            exercises: {
              select: {
                content: true,
              },
            },
          },
        },
      },
    }),
  );
  const hasAssignedAsset = assignments.some((assignment) =>
    assignment.lesson.exercises.some((exercise) =>
      contentReferencesAudioKey(exercise.content, key),
    ),
  );

  if (!hasAssignedAsset) {
    throw createHttpError(404, "NCE asset not found.");
  }

  const filePath = nceAssetFilePath(key);
  return {
    url: buildNceAssetAudioUrl(courseId, key, actor),
    mime: mimeForNceAssetKey(key),
    size: statSync(filePath).size,
  };
}

export async function getNceAssetContentFile(
  rawParams: unknown,
  rawQuery: unknown,
  actor: RequestActor,
) {
  const { courseId } = courseNcePathParamsSchema.parse(rawParams);
  const { key } = nceAssetContentQuerySchema.parse(rawQuery ?? {});
  await assertStudentCourseAccess(courseId, actor);

  const assignments = await readWithServiceRole(actor, () =>
    prisma.nceCourseLessonAssignment.findMany({
      where: {
        courseId,
        ...availableAssignmentWhere(),
        lesson: lessonContentWhere(),
      },
      select: {
        lesson: {
          select: {
            exercises: {
              select: {
                content: true,
              },
            },
          },
        },
      },
    }),
  );
  const hasAssignedAsset = assignments.some((assignment) =>
    assignment.lesson.exercises.some((exercise) =>
      contentReferencesAudioKey(exercise.content, key),
    ),
  );

  if (!hasAssignedAsset) {
    throw createHttpError(404, "NCE asset not found.");
  }

  const filePath = nceAssetFilePath(key);
  return {
    path: filePath,
    mime: mimeForNceAssetKey(key),
    size: statSync(filePath).size,
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
      update: {},
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
  const loadCurrentDraft = () =>
    readWithServiceRole(actor, () =>
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
  const updateDraft = async (draftId: string) => {
    const updateResult = await readWithServiceRole(actor, () =>
      prisma.nceExerciseAttempt.updateMany({
        where: { id: draftId, status: NceAttemptStatus.draft },
        data: { response },
      }),
    );
    if (updateResult.count === 0) {
      throw createHttpError(409, "NCE draft is no longer editable.");
    }

    const updatedDraft = await readWithServiceRole(actor, () =>
      prisma.nceExerciseAttempt.findFirst({
        where: { id: draftId, status: NceAttemptStatus.draft },
        include: { exercise: true },
      }),
    );
    if (!updatedDraft) {
      throw createHttpError(409, "NCE draft is no longer editable.");
    }

    return updatedDraft;
  };

  let attempt: NceExerciseAttemptRow;
  if (existingDraft) {
    attempt = (await updateDraft(existingDraft.id)) as NceExerciseAttemptRow;
  } else {
    try {
      attempt = (await readWithServiceRole(actor, () =>
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
      )) as NceExerciseAttemptRow;
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) {
        throw error;
      }

      const concurrentDraft = await loadCurrentDraft();
      if (!concurrentDraft) {
        throw createHttpError(409, "NCE draft is no longer editable.");
      }
      attempt = (await updateDraft(concurrentDraft.id)) as NceExerciseAttemptRow;
    }
  }

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

  await assertStudentCourseAccess(attempt.courseId, actor);

  const assignment = await readWithServiceRole(actor, () =>
    prisma.nceCourseLessonAssignment.findFirst({
      where: {
        courseId: attempt.courseId,
        lessonId: attempt.lessonId,
        ...availableAssignmentWhere(),
        lesson: lessonContentWhere(),
      },
      select: { courseId: true, lessonId: true },
    }),
  );

  if (!assignment) {
    throw createHttpError(404, "NCE lesson assignment not found");
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

  const [exerciseCount, submittedExerciseAttempts] = await readWithServiceRole(actor, () =>
    Promise.all([
      prisma.nceExercise.count({
        where: { lessonId },
      }),
      prisma.nceExerciseAttempt.findMany({
        where: {
          courseId,
          lessonId,
          studentId: actor.id,
          status: NceAttemptStatus.submitted,
        },
        select: { exerciseId: true },
        distinct: ["exerciseId"],
      }),
    ]),
  );

  if (submittedExerciseAttempts.length < exerciseCount) {
    throw createHttpError(400, "Submit all NCE exercise attempts before completing the lesson");
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
