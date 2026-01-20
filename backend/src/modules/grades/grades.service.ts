/**
 * File: src/modules/grades/grades.service.ts
 * Purpose: Implement grading persistence and retrieval via Prisma.
 * Why: Keeps scoring routines decoupled from controllers.
 */
import { NotificationChannel, Prisma } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { createNotFoundError } from "../../utils/httpError.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import {
  gradePayloadSchema,
  submissionScopedParamsSchema,
} from "./grades.schema.js";

export async function upsertGrade(
  params: unknown,
  payload: unknown,
) {
  const { submissionId } = submissionScopedParamsSchema.parse(params);
  const data = gradePayloadSchema.parse(payload);
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          courseId: true,
          course: {
            select: {
              title: true,
            },
          },
        },
      },
      student: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!submission) {
    throw createNotFoundError("Submission", submissionId);
  }
  // Cast arrays to Prisma JSON inputs because Zod cannot enforce JsonValue types.
  const rubricBreakdown = data.rubricBreakdown
    ? (data.rubricBreakdown as Prisma.InputJsonArray)
    : undefined;
  const adjustments = data.adjustments
    ? (data.adjustments as Prisma.InputJsonArray)
    : undefined;

  const grade = await prisma.grade.upsert({
    where: { submissionId },
    create: {
      submissionId,
      graderId: data.graderId,
      rubricBreakdown,
      rawScore: data.rawScore,
      adjustments,
      finalScore: data.finalScore,
      feedback: data.feedbackMd,
    },
    update: {
      graderId: data.graderId,
      rubricBreakdown,
      rawScore: data.rawScore,
      adjustments,
      finalScore: data.finalScore,
      feedback: data.feedbackMd,
    },
  });

  const channels: NotificationChannel[] = ["inapp", "email"];
  const payloadJson: Prisma.InputJsonObject = {
    submissionId,
    assignmentId: submission.assignment.id,
    assignmentTitle: submission.assignment.title,
    courseId: submission.assignment.courseId,
    courseTitle: submission.assignment.course?.title ?? "",
    gradedAt: new Date().toISOString(),
  };

  await enqueueNotification({
    userId: submission.student.id,
    type: "graded",
    payload: payloadJson,
    channels,
  });

  return grade;
}

export async function getGrade(params: unknown) {
  const { submissionId } = submissionScopedParamsSchema.parse(params);
  const grade = await prisma.grade.findFirst({
    where: { submissionId, deletedAt: null },
  });
  if (!grade) {
    throw createNotFoundError("Grade", submissionId);
  }
  return grade;
}
