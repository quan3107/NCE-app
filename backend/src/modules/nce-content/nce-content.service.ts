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

import { prisma } from "../../config/prismaClient.js";
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

const lessonInclude = {
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

const publishedLessonWhere = {
  status: NcePublishStatus.published,
  unit: {
    status: NcePublishStatus.published,
    deletedAt: null,
    book: {
      status: NcePublishStatus.published,
      deletedAt: null,
    },
  },
};

const parseReadQuery = (query?: unknown): NceReadQuery =>
  nceReadQuerySchema.parse(query ?? {});

const pagination = (query: NceReadQuery) => ({
  skip: (query.page - 1) * query.pageSize,
  take: query.pageSize,
});

const paginationResponse = <T>(query: NceReadQuery, rows: T[]) => ({
  page: query.page,
  pageSize: query.pageSize,
  total: rows.length,
});

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
    return {
      includeDrafts: false,
      includeAnswers: false,
      includeTeacherNotes: false,
    };
  }

  if (actor.role === UserRole.admin) {
    if (query.courseId) {
      await assertCourseAccess(query.courseId, actor);
    }
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

  return {
    includeDrafts: false,
    includeAnswers: false,
    includeTeacherNotes: false,
  };
}

function bookWhere(includeDrafts: boolean): Prisma.NceBookWhereInput {
  return {
    deletedAt: null,
    ...(includeDrafts ? {} : { status: NcePublishStatus.published }),
  };
}

function unitWhere(
  bookId: string,
  includeDrafts: boolean,
): Prisma.NceUnitWhereInput {
  return {
    bookId,
    deletedAt: null,
    ...(includeDrafts
      ? {}
      : {
          status: NcePublishStatus.published,
          book: { status: NcePublishStatus.published, deletedAt: null },
        }),
  };
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
      : {}),
    ...(includeDrafts ? {} : publishedLessonWhere),
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
      ...(includeDrafts ? {} : publishedLessonWhere),
    },
  };
}

export async function listNceBooks(
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const query = parseReadQuery(rawQuery);
  const visibility = await resolveVisibility(actor, query);
  const books = await prisma.nceBook.findMany({
    where: bookWhere(visibility.includeDrafts),
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  return { books: (books as NceBookRow[]).map(mapNceBook) };
}

export async function listNceUnits(
  rawParams: unknown,
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const { bookId } = nceBookParamsSchema.parse(rawParams);
  const query = parseReadQuery(rawQuery);
  const visibility = await resolveVisibility(actor, query);
  const units = await prisma.nceUnit.findMany({
    where: unitWhere(bookId, visibility.includeDrafts),
    orderBy: [{ sortOrder: "asc" }, { unitNumber: "asc" }],
  });

  return { units: (units as NceUnitRow[]).map(mapNceUnit) };
}

export async function listNceLessons(
  rawParams: unknown,
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const { unitId } = nceUnitParamsSchema.parse(rawParams);
  const query = parseReadQuery(rawQuery);
  const visibility = await resolveVisibility(actor, query);
  const pageArgs = pagination(query);
  const lessons = await prisma.nceLesson.findMany({
    where: lessonWhere(unitId, undefined, query, visibility.includeDrafts),
    include: lessonInclude,
    orderBy: [{ sortOrder: "asc" }, { lessonNumber: "asc" }],
    ...pageArgs,
  });

  return {
    lessons: (lessons as NceLessonRow[]).map((lesson) =>
      mapNceLesson(lesson, visibility),
    ),
    pagination: paginationResponse(query, lessons),
  };
}

export async function getNceLesson(
  rawParams: unknown,
  actor?: RequestActor,
  rawQuery?: unknown,
) {
  const { lessonId } = nceLessonParamsSchema.parse(rawParams);
  const query = parseReadQuery(rawQuery);
  const visibility = await resolveVisibility(actor, query);
  const lesson = await prisma.nceLesson.findFirst({
    where: lessonWhere(undefined, lessonId, query, visibility.includeDrafts),
    include: lessonInclude,
  });

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

  const assignments = await prisma.nceCourseLessonAssignment.findMany({
    where: courseLessonWhere(courseId, canIncludeDrafts),
    include: {
      lesson: {
        include: lessonInclude,
      },
    },
    orderBy: [{ sequence: "asc" }],
    ...pageArgs,
  });

  return {
    lessons: assignments.map((assignment) => ({
      sequence: assignment.sequence,
      availableFrom: assignment.availableFrom?.toISOString() ?? null,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      ...mapNceLesson(assignment.lesson as NceLessonRow, {
        includeAnswers,
        includeTeacherNotes: includeAnswers,
      }),
    })),
    pagination: paginationResponse(query, assignments),
  };
}
