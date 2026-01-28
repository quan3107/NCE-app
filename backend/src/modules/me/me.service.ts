/**
 * File: src/modules/me/me.service.ts
 * Purpose: Fetch the authenticated user's profile, roles, and enrollments.
 * Why: Powers the PRD-required /me endpoint with a single query flow.
 */
import type { EnrollmentRole, UserRole, UserStatus } from "../../prisma/generated/client/client.js";

import { prisma } from "../../prisma/client.js";
import { createNotFoundError } from "../../utils/httpError.js";

type MeProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
};

type MeEnrollment = {
  id: string;
  courseId: string;
  roleInCourse: EnrollmentRole;
  course: {
    id: string;
    title: string;
  };
  enrolledAt: string;
};

type MeResponse = {
  profile: MeProfile;
  roles: {
    global: UserRole;
    courses: Array<{ courseId: string; roleInCourse: EnrollmentRole }>;
  };
  enrollments: MeEnrollment[];
};

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      enrollments: {
        where: {
          deletedAt: null,
          course: { deletedAt: null },
        },
        select: {
          id: true,
          courseId: true,
          roleInCourse: true,
          createdAt: true,
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw createNotFoundError("User", userId);
  }

  const enrollments = user.enrollments
    .map((enrollment) => {
      if (!enrollment.course) {
        return null;
      }

      return {
        id: enrollment.id,
        courseId: enrollment.courseId,
        roleInCourse: enrollment.roleInCourse,
        course: enrollment.course,
        enrolledAt: enrollment.createdAt.toISOString(),
      } as MeEnrollment;
    })
    .filter((value): value is MeEnrollment => value !== null);

  return {
    profile: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    },
    roles: {
      global: user.role,
      courses: enrollments.map((enrollment) => ({
        courseId: enrollment.courseId,
        roleInCourse: enrollment.roleInCourse,
      })),
    },
    enrollments,
  };
}
