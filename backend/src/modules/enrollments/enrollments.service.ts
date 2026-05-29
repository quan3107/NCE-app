/**
 * File: src/modules/enrollments/enrollments.service.ts
 * Purpose: Implement enrollment listing and creation logic using Prisma.
 * Why: Supports admin enrollment management endpoints required by the PRD.
 */
import {
  EnrollmentRole,
  UserRole,
  UserStatus,
} from "../../prisma/index.js";
import { prisma } from "../../prisma/client.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import {
  createEnrollmentSchema,
  DEFAULT_ENROLLMENT_LIMIT,
  enrollmentIdParamsSchema,
  enrollmentQuerySchema,
} from "./enrollments.schema.js";

const enrollmentSelect = {
  id: true,
  courseId: true,
  userId: true,
  roleInCourse: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  },
  course: {
    select: {
      id: true,
      title: true,
    },
  },
};

const expectedUserRoleByEnrollmentRole = {
  [EnrollmentRole.student]: UserRole.student,
  [EnrollmentRole.teacher]: UserRole.teacher,
} satisfies Record<EnrollmentRole, UserRole>;

type EnrollmentUser = {
  role: UserRole;
  status: UserStatus;
};

function assertUserCanHoldEnrollmentRole(
  user: EnrollmentUser,
  roleInCourse: EnrollmentRole,
) {
  const expectedRole = expectedUserRoleByEnrollmentRole[roleInCourse];

  if (user.role !== expectedRole) {
    throw createHttpError(
      409,
      "Enrollment role must match the user's account role.",
      {
        code: "invalid_role_pairing",
        expectedRole,
        actualRole: user.role,
        roleInCourse,
      },
    );
  }

  if (user.status === UserStatus.suspended) {
    throw createHttpError(
      409,
      "Suspended users cannot be enrolled in courses.",
      {
        code: "invalid_role_pairing",
        expectedStatus: "not_suspended",
        actualStatus: user.status,
        roleInCourse,
      },
    );
  }
}

export async function listEnrollments(query: unknown) {
  const filters = enrollmentQuerySchema.parse(query);
  const limit = filters.limit ?? DEFAULT_ENROLLMENT_LIMIT;
  const offset = filters.offset ?? 0;

  return prisma.enrollment.findMany({
    where: {
      deletedAt: null,
      courseId: filters.courseId,
      userId: filters.userId,
      roleInCourse: filters.roleInCourse,
      course: { deletedAt: null },
      user: { deletedAt: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    skip: offset,
    select: enrollmentSelect,
  });
}

export async function createEnrollment(payload: unknown) {
  const data = createEnrollmentSchema.parse(payload);

  const course = await prisma.course.findFirst({
    where: { id: data.courseId, deletedAt: null },
    select: { id: true },
  });

  if (!course) {
    throw createNotFoundError("Course", data.courseId);
  }

  const user = await prisma.user.findFirst({
    where: { id: data.userId, deletedAt: null },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    throw createNotFoundError("User", data.userId);
  }

  assertUserCanHoldEnrollmentRole(user, data.roleInCourse);

  const existing = await prisma.enrollment.findUnique({
    where: {
      courseId_userId: {
        courseId: data.courseId,
        userId: data.userId,
      },
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (existing && !existing.deletedAt) {
    throw createHttpError(409, "Enrollment already exists", {
      code: "duplicate_active_enrollment",
    });
  }

  return prisma.enrollment.upsert({
    where: {
      courseId_userId: {
        courseId: data.courseId,
        userId: data.userId,
      },
    },
    update: {
      deletedAt: null,
      roleInCourse: data.roleInCourse,
    },
    create: {
      courseId: data.courseId,
      userId: data.userId,
      roleInCourse: data.roleInCourse,
    },
    select: enrollmentSelect,
  });
}

export async function deleteEnrollment(params: unknown) {
  const { enrollmentId } = enrollmentIdParamsSchema.parse(params);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, deletedAt: true },
  });

  if (!enrollment || enrollment.deletedAt) {
    throw createNotFoundError("Enrollment", enrollmentId);
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { deletedAt: new Date() },
  });
}
