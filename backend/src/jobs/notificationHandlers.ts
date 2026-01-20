/**
 * File: src/jobs/notificationHandlers.ts
 * Purpose: Provide notification job handlers for due-soon and weekly digest flows.
 * Why: Keeps scheduling logic isolated from pg-boss registration boilerplate.
 */
import type { NotificationChannel, Prisma } from "@prisma/client";

import { logger } from "../config/logger.js";
import { prisma } from "../prisma/client.js";
import { enqueueNotification } from "../modules/notifications/notifications.service.js";

export const NOTIFICATION_JOB_NAMES = {
  dueSoon: "notifications.due-soon",
  weeklyDigest: "notifications.weekly-digest",
  deliverQueued: "notifications.deliver-queued",
};

const DUE_SOON_HOURS = 24;
const DUE_SOON_LEEWAY_HOURS = 1;
const WEEKLY_DIGEST_DAYS = 7;
const DEFAULT_CHANNELS: NotificationChannel[] = ["inapp", "email"];

const hoursToMilliseconds = (hours: number): number => hours * 60 * 60 * 1000;
const daysToMilliseconds = (days: number): number => days * 24 * 60 * 60 * 1000;

type DigestAssignment = {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  dueAt: string;
};

export async function handleDueSoonJob(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(
    now.getTime() + hoursToMilliseconds(DUE_SOON_HOURS - DUE_SOON_LEEWAY_HOURS),
  );
  const windowEnd = new Date(
    now.getTime() + hoursToMilliseconds(DUE_SOON_HOURS + DUE_SOON_LEEWAY_HOURS),
  );

  const assignments = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      dueAt: {
        gte: windowStart,
        lt: windowEnd,
      },
    },
    include: {
      course: {
        select: {
          title: true,
        },
      },
    },
  });

  if (assignments.length === 0) {
    logger.debug("Due-soon job found no assignments in window");
    return;
  }

  const courseIds = Array.from(
    new Set(assignments.map((assignment) => assignment.courseId)),
  );
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId: { in: courseIds },
      roleInCourse: "student",
      deletedAt: null,
    },
    select: {
      courseId: true,
      userId: true,
    },
  });

  const userIdsByCourse = new Map<string, string[]>();
  for (const enrollment of enrollments) {
    const existing = userIdsByCourse.get(enrollment.courseId) ?? [];
    existing.push(enrollment.userId);
    userIdsByCourse.set(enrollment.courseId, existing);
  }

  let createdCount = 0;
  for (const assignment of assignments) {
    const enrolledUserIds = userIdsByCourse.get(assignment.courseId) ?? [];
    if (enrolledUserIds.length === 0) {
      continue;
    }

    const existingNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: enrolledUserIds },
        type: "due_soon",
        deletedAt: null,
        payload: {
          path: ["assignmentId"],
          equals: assignment.id,
        },
      },
      select: {
        userId: true,
      },
    });
    const existingUserIds = new Set(
      existingNotifications.map((notification) => notification.userId),
    );

    for (const userId of enrolledUserIds) {
      if (existingUserIds.has(userId)) {
        continue;
      }

      const payload: Prisma.InputJsonObject = {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title ?? "",
        dueAt: assignment.dueAt?.toISOString() ?? "",
        reminderHours: DUE_SOON_HOURS,
      };

      await enqueueNotification({
        userId,
        type: "due_soon",
        payload,
        channels: DEFAULT_CHANNELS,
      });
      createdCount += DEFAULT_CHANNELS.length;
    }
  }

  logger.info(
    { createdCount },
    "Due-soon notifications queued from hourly window",
  );
}

export async function handleWeeklyDigestJob(): Promise<void> {
  const windowStart = new Date();
  const windowEnd = new Date(
    windowStart.getTime() + daysToMilliseconds(WEEKLY_DIGEST_DAYS),
  );

  const assignments = await prisma.assignment.findMany({
    where: {
      deletedAt: null,
      publishedAt: { not: null },
      dueAt: {
        gte: windowStart,
        lt: windowEnd,
      },
    },
    include: {
      course: {
        select: {
          title: true,
        },
      },
    },
  });

  if (assignments.length === 0) {
    logger.debug("Weekly digest job found no assignments in window");
    return;
  }

  const assignmentsByCourse = new Map<string, DigestAssignment[]>();
  for (const assignment of assignments) {
    if (!assignment.dueAt) {
      continue;
    }
    const item: DigestAssignment = {
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      courseId: assignment.courseId,
      courseTitle: assignment.course?.title ?? "",
      dueAt: assignment.dueAt.toISOString(),
    };
    const existing = assignmentsByCourse.get(assignment.courseId) ?? [];
    existing.push(item);
    assignmentsByCourse.set(assignment.courseId, existing);
  }

  const courseIds = Array.from(assignmentsByCourse.keys());
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId: { in: courseIds },
      roleInCourse: "student",
      deletedAt: null,
    },
    select: {
      courseId: true,
      userId: true,
    },
  });

  const assignmentsByUser = new Map<string, DigestAssignment[]>();
  for (const enrollment of enrollments) {
    const courseAssignments =
      assignmentsByCourse.get(enrollment.courseId) ?? [];
    if (courseAssignments.length === 0) {
      continue;
    }
    const existing = assignmentsByUser.get(enrollment.userId) ?? [];
    existing.push(...courseAssignments);
    assignmentsByUser.set(enrollment.userId, existing);
  }

  let createdCount = 0;
  for (const [userId, digestAssignments] of assignmentsByUser.entries()) {
    if (digestAssignments.length === 0) {
      continue;
    }
    const sortedAssignments = [...digestAssignments].sort((left, right) => {
      return (
        new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
      );
    });

    const payload: Prisma.InputJsonObject = {
      digestStart: windowStart.toISOString(),
      digestEnd: windowEnd.toISOString(),
      assignments: sortedAssignments,
      totalAssignments: sortedAssignments.length,
    };

    await enqueueNotification({
      userId,
      type: "weekly_digest",
      payload,
      channels: DEFAULT_CHANNELS,
    });
    createdCount += DEFAULT_CHANNELS.length;
  }

  logger.info(
    { createdCount },
    "Weekly digest notifications queued from upcoming assignments",
  );
}
