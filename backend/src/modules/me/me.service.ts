/**
 * File: src/modules/me/me.service.ts
 * Purpose: Fetch the authenticated user's profile, roles, enrollments, and navigation.
 * Why: Powers the PRD-required /me endpoint with a single query flow.
 */
import {
  UserStatus,
  type EnrollmentRole,
  type UserRole,
} from "../../prisma/index.js";

import { prisma } from "../../prisma/client.js";
import { createHttpError, createNotFoundError } from "../../utils/httpError.js";
import { writeAuditLog } from "../audit-logs/audit-logs.service.js";
import { getNavigationForRole } from "../navigation/navigation.service.js";
import type { NavigationResponse } from "../navigation/navigation.types.js";

export type MeProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  profileRevision: number;
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
  navigation: NavigationResponse;
};

const meProfileSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  profileRevision: true,
} as const;

type UpdateMeProfileInput = {
  fullName: string;
  expectedRevision: number;
};

export async function updateMeProfile(
  userId: string,
  input: UpdateMeProfileInput,
): Promise<MeProfile> {
  return prisma.$transaction(async (transaction) => {
    const updateResult = await transaction.user.updateMany({
      where: {
        id: userId,
        deletedAt: null,
        status: UserStatus.active,
        profileRevision: input.expectedRevision,
        NOT: { fullName: input.fullName },
      },
      data: {
        fullName: input.fullName,
        profileRevision: { increment: 1 },
      },
    });

    const profile = await transaction.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: meProfileSelect,
    });

    if (!profile) {
      throw createNotFoundError("User", userId);
    }
    if (profile.status !== UserStatus.active) {
      throw createHttpError(403, "Active account required.");
    }
    const changedAtExpectedRevision =
      updateResult.count === 1 &&
      profile.profileRevision === input.expectedRevision + 1;
    const alreadyHasRequestedName =
      updateResult.count === 0 && profile.fullName === input.fullName;
    if (!changedAtExpectedRevision && !alreadyHasRequestedName) {
      throw createHttpError(409, "Profile changed; reload before saving.");
    }

    if (updateResult.count === 1) {
      await writeAuditLog(
        {
          actorId: userId,
          action: "user.profile_updated",
          entity: "user",
          entityId: userId,
          eventData: { fullNameChanged: true },
        },
        transaction,
      );
    }

    return profile;
  });
}

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      profileRevision: true,
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
  if (user.status !== UserStatus.active) {
    throw createHttpError(403, "Active account required.");
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

  // Fetch navigation data for the user's role
  const navigation = await getNavigationForRole(user.role);

  return {
    profile: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      profileRevision: user.profileRevision,
    },
    roles: {
      global: user.role,
      courses: enrollments.map((enrollment) => ({
        courseId: enrollment.courseId,
        roleInCourse: enrollment.roleInCourse,
      })),
    },
    enrollments,
    navigation,
  };
}
