/**
 * File: src/modules/submissions/submissions.notifications.ts
 * Purpose: Queue teacher notifications for newly submitted student work.
 * Why: Keeps notification preference checks separate from submission persistence.
 */
import { NotificationChannel, Prisma } from "../../prisma/index.js";

import { logger } from "../../config/logger.js";
import { prisma } from "../../prisma/client.js";
import { resolveNotificationTypeEnabledForUsers } from "../notification-preferences/notification-preferences.service.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import type { SubmissionStatus } from "./submissions.timing.js";

const TEACHER_SUBMISSION_NOTIFICATION_TYPE = "new_submission";
const TEACHER_SUBMISSION_CHANNELS: NotificationChannel[] = ["inapp", "email"];

export async function enqueueTeacherSubmissionNotifications(input: {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  studentId: string;
  submissionId: string;
  status: Exclude<SubmissionStatus, "draft">;
  submittedAt: Date | null;
}): Promise<void> {
  const teacherEnrollments = await prisma.enrollment.findMany({
    where: {
      courseId: input.courseId,
      roleInCourse: "teacher",
      deletedAt: null,
    },
    select: {
      userId: true,
    },
  });

  const teacherIds = Array.from(
    new Set(teacherEnrollments.map((enrollment) => enrollment.userId)),
  );

  if (teacherIds.length === 0) {
    return;
  }

  const enabledByTeacher = await resolveNotificationTypeEnabledForUsers({
    role: "teacher",
    type: TEACHER_SUBMISSION_NOTIFICATION_TYPE,
    userIds: teacherIds,
  });

  for (const teacherId of teacherIds) {
    if (!enabledByTeacher.get(teacherId)) {
      logger.info(
        {
          event: "teacher_notification_suppressed_by_preference",
          teacher_id: teacherId,
          type: TEACHER_SUBMISSION_NOTIFICATION_TYPE,
          assignment_id: input.assignmentId,
          submission_id: input.submissionId,
        },
        "Teacher notification suppressed because preference is disabled",
      );
      continue;
    }

    const payload: Prisma.InputJsonObject = {
      submissionId: input.submissionId,
      assignmentId: input.assignmentId,
      assignmentTitle: input.assignmentTitle,
      courseId: input.courseId,
      courseTitle: input.courseTitle,
      studentId: input.studentId,
      submittedAt: input.submittedAt?.toISOString() ?? null,
      status: input.status,
      title: "New submission received",
      message: `A student submitted work for ${input.assignmentTitle}.`,
    };

    await enqueueNotification({
      userId: teacherId,
      type: TEACHER_SUBMISSION_NOTIFICATION_TYPE,
      payload,
      channels: TEACHER_SUBMISSION_CHANNELS,
    });
  }
}

export async function notifyTeachersAboutSubmittedWork(input: {
  assignment: {
    id: string;
    title: string;
    courseId: string;
    course?: { title: string } | null;
  };
  studentId: string;
  submission: { id: string; submittedAt: Date | null };
  status: SubmissionStatus;
}) {
  if (input.status !== "submitted" && input.status !== "late") {
    return;
  }
  try {
    await enqueueTeacherSubmissionNotifications({
      assignmentId: input.assignment.id,
      assignmentTitle: input.assignment.title,
      courseId: input.assignment.courseId,
      courseTitle: input.assignment.course?.title ?? "",
      studentId: input.studentId,
      submissionId: input.submission.id,
      status: input.status,
      submittedAt: input.submission.submittedAt,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        event: "teacher_submission_notification_enqueue_failed",
        assignment_id: input.assignment.id,
        submission_id: input.submission.id,
      },
      "Failed to enqueue teacher submission notifications",
    );
  }
}
