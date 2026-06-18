/**
 * File: src/modules/nce-content/nce-content.service.ts
 * Purpose: Implement read-only NCE content queries.
 * Why: Provides published and course-authorized draft content to learning UIs.
 */
import {
  EnrollmentRole,
  NcePublishStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "../../prisma/index.js";

import { prisma, runWithRole } from "../../config/prismaClient.js";
import type { RequestActor } from "../../middleware/requestActor.js";
import { createHttpError } from "../../utils/httpError.js";
import {
  mapNceBook,
  mapNceLesson,
  mapNceUnit,
  type NceBookRow,
  type NceLessonRow,
  type NceUnitRow,
} from "./nce-content.mappers.js";
import {
  courseNceLessonsParamsSchema,
  nceBookParamsSchema,
  nceLessonParamsSchema,
  nceReadQuerySchema,
  nceUnitParamsSchema,
  type NceReadQuery,
} from "./nce-content.schema.js";

type CourseAccess = "admin" | "owner" | "coTeacher" | "student" | "none";

const draftReadableStatuses = [
  NcePublishStatus.published,
  NcePublishStatus.draft,
];

const lessonSelect = (options: {
  includeAnswers: boolean;
  includeTeacherNotes: boolean;
}) => ({
  id: true,
  unitId: true,
  lessonNumber: true,
  title: true,
  lessonText: true,
  mediaJson: true,
  teacherNotes: options.includeTeacherNotes,
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
      ...(options.includeAnswers ? { answerKey: true } : {}),
      scoringConfig: true,
      sortOrder: true,
    },
  },
});

const statusWhere = (includeDrafts: boolean) =>
  includeDrafts
    ? { in: draftReadableStatuses }
    : NcePublishStatus.published;

const lessonContentWhere = (includeDrafts: boolean) => ({
  status: statusWhere(includeDrafts),
  unit: {
    status: statusWhere(includeDrafts),
    deletedAt: null,
    book: {
      status: statusWhere(includeDrafts),
      deletedAt: null,
    },
  },
});

const parseReadQuery = (query?: unknown): NceReadQuery =>
  nceReadQuerySchema.parse(query ?? {});

const pagination = (query: NceReadQuery) => ({
  skip: (query.page - 1) * query.pageSize,
  take: query.pageSize,
});

const paginationResponse = (query: NceReadQuery, total: number) => ({
  page: query.page,
  pageSize: query.pageSize,
  total,
});

function assertPublicCourseContext(query: NceReadQuery): void {
  if (query.courseId && !query.includeDrafts) {
    throw createHttpError(
      400,
      "courseId can only be used with includeDrafts=true on public NCE content routes",
    );
  }
}

function getAccessRole(
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
      deletedAt: true,
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

  const access = getAccessRole(course, actor);
  if (access === "none") {
    throw createHttpError(403, "You do not have permission to access this course");
  }

  return access;
}

async function resolveVisibility(
  actor: RequestActor | undefined,
  query: NceReadQuery,
) {
  if (!query.includeDrafts) {
    return {
      includeDrafts: false,
      includeAnswers: actor?.role === UserRole.admin || actor?.role === UserRole.teacher,
      includeTeacherNotes: false,
    };
  }

  if (!actor) {
    throw createHttpError(401, "Unauthorized");
  }

  if (actor.role === UserRole.admin) {
    if (!query.courseId) {
      throw createHttpError(400, "courseId is required to include draft NCE content");
    }

    await assertCourseAccess(query.courseId, actor);
    return {
      includeDrafts: true,
      includeAnswers: true,
      includeTeacherNotes: true,
    };
  }

  if (actor.role === UserRole.teacher) {
    if (!query.courseId) {
      throw createHttpError(400, "courseId is required to include draft NCE content");
    }

    const access = await assertCourseAccess(query.courseId, actor);
    if (access !== "owner" && access !== "coTeacher") {
      throw createHttpError(403, "You do not have permission to access this course");
    }

    return {
      includeDrafts: true,
      includeAnswers: true,
      includeTeacherNotes: true,
    };
  }

  throw createHttpError(403, "You do not have permission to include draft NCE content");
}

function bookWhere(includeDrafts: boolean): Prisma.NceBookWhereInput {
  return {
    deletedAt: null,
    status: statusWhere(includeDrafts),
  };
}

function assignedBookWhere(
  includeDrafts: boolean,
  courseId: string | undefined,
): Prisma.NceBookWhereInput {
  return {
    ...bookWhere(includeDrafts),
    ...(includeDrafts && courseId
      ? {
          units: {
            some: {
              deletedAt: null,
              status: statusWhere(includeDrafts),
              lessons: {
                some: {
                  deletedAt: null,
                  status: statusWhere(includeDrafts),
                  courseAssignments: { some: { courseId } },
                },
              },
            },
          },
        }
      : {}),
  };
}

function unitWhere(
  bookId: string,
  includeDrafts: boolean,
  courseId: string | undefined,
): Prisma.NceUnitWhereInput {
  return {
    bookId,
    deletedAt: null,
    ...(includeDrafts && courseId
      ? {
          lessons: {
            some: {
              deletedAt: null,
              status: statusWhere(includeDrafts),
              courseAssignments: { some: { courseId } },
            },
          },
        }
      : {}),
    status: statusWhere(includeDrafts),
    book: { status: statusWhere(includeDrafts), deletedAt: null },
  };
}

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

function shouldUseServiceRole(
  actor: RequestActor | undefined,
  visibility: {
    includeAnswers: boolean;
    includeTeacherNotes: boolean;
    includeDrafts: boolean;
  },
): actor is RequestActor {
  return Boolean(
    actor &&
      (visibility.includeAnswers ||
        visibility.includeTeacherNotes ||
        visibility.includeDrafts),
  );
}

function lessonWhere(
  unitId: string | undefined,
  lessonId: string | undefined,
  query: NceReadQuery,
  includeDrafts: boolean,
): Prisma.NceLessonWhereInput {
  return {
    ...(unitId ? { unitId } : {}),
    ...(lessonId ? { id: lessonId } : {}),
    deletedAt: null,
    ...(query.courseId
      ? { courseAssignments: { some: { courseId: query.courseId } } }
      : { courseId: null }),
    ...lessonContentWhere(includeDrafts),
  };
}

function courseLessonWhere(
  courseId: string,
  includeDrafts: boolean,
): Prisma.NceCourseLessonAssignmentWhereInput {
  return {
    courseId,
    lesson: {
      deletedAt: null,
      ...lessonContentWhere(includeDrafts),
    },
  };
}

export async function listNceBooks(
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const query = parseReadQuery(rawQuery);
  assertPublicCourseContext(query);
  const visibility = await resolveVisibility(actor, query);
  const read = () => prisma.nceBook.findMany({
    where: assignedBookWhere(visibility.includeDrafts, query.courseId),
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  const books =
    shouldUseServiceRole(actor, visibility)
      ? await readWithServiceRole(actor, read)
      : await read();

  return { books: (books as NceBookRow[]).map(mapNceBook) };
}

export async function listNceUnits(
  rawParams: unknown,
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const { bookId } = nceBookParamsSchema.parse(rawParams);
  const query = parseReadQuery(rawQuery);
  assertPublicCourseContext(query);
  const visibility = await resolveVisibility(actor, query);
  const read = () => prisma.nceUnit.findMany({
    where: unitWhere(bookId, visibility.includeDrafts, query.courseId),
    orderBy: [{ sortOrder: "asc" }, { unitNumber: "asc" }],
  });
  const units =
    shouldUseServiceRole(actor, visibility)
      ? await readWithServiceRole(actor, read)
      : await read();

  return { units: (units as NceUnitRow[]).map(mapNceUnit) };
}

export async function listNceLessons(
  rawParams: unknown,
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const { unitId } = nceUnitParamsSchema.parse(rawParams);
  const query = parseReadQuery(rawQuery);
  assertPublicCourseContext(query);
  const visibility = await resolveVisibility(actor, query);
  const pageArgs = pagination(query);
  const where = lessonWhere(unitId, undefined, query, visibility.includeDrafts);
  const read = () => Promise.all([
    prisma.nceLesson.findMany({
      where,
      select: lessonSelect(visibility),
      orderBy: [{ sortOrder: "asc" }, { lessonNumber: "asc" }],
      ...pageArgs,
    }),
    prisma.nceLesson.count({ where }),
  ]);
  const [lessons, total] =
    shouldUseServiceRole(actor, visibility)
      ? await readWithServiceRole(actor, read)
      : await read();

  return {
    lessons: (lessons as NceLessonRow[]).map((lesson) =>
      mapNceLesson(lesson, visibility),
    ),
    pagination: paginationResponse(query, total),
  };
}

export async function getNceLesson(
  rawParams: unknown,
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const { lessonId } = nceLessonParamsSchema.parse(rawParams);
  const query = parseReadQuery(rawQuery);
  assertPublicCourseContext(query);
  const visibility = await resolveVisibility(actor, query);
  const read = () => prisma.nceLesson.findFirst({
    where: lessonWhere(undefined, lessonId, query, visibility.includeDrafts),
    select: lessonSelect(visibility),
  });
  const lesson =
    shouldUseServiceRole(actor, visibility)
      ? await readWithServiceRole(actor, read)
      : await read();

  if (!lesson) {
    throw createHttpError(404, "NCE lesson not found");
  }

  return mapNceLesson(lesson as NceLessonRow, visibility);
}

export async function listCourseNceLessons(
  rawParams: unknown,
  actor: RequestActor,
  rawQuery?: unknown,
) {
  const { courseId } = courseNceLessonsParamsSchema.parse(rawParams);
  const query = parseReadQuery({ ...(rawQuery as object), courseId });
  const access = await assertCourseAccess(courseId, actor);
  const canIncludeDrafts =
    query.includeDrafts &&
    (access === "admin" || access === "owner" || access === "coTeacher");
  const includeAnswers = access === "admin" || access === "owner" || access === "coTeacher";
  const pageArgs = pagination(query);

  const where = courseLessonWhere(courseId, canIncludeDrafts);
  const lessonVisibility = {
    includeAnswers,
    includeTeacherNotes: includeAnswers,
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
            select: lessonSelect(lessonVisibility),
          },
        },
        orderBy: [{ sequence: "asc" }],
        ...pageArgs,
      }),
      prisma.nceCourseLessonAssignment.count({ where }),
    ]),
  );

  return {
    lessons: assignments.map((assignment) => ({
      sequence: assignment.sequence,
      availableFrom: assignment.availableFrom?.toISOString() ?? null,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      ...mapNceLesson(assignment.lesson as NceLessonRow, lessonVisibility),
    })),
    pagination: paginationResponse(query, total),
  };
}
