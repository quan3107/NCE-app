/**
 * File: src/modules/courses/courses.completion-rate.ts
 * Purpose: Compute teacher-visible course completion metrics from live backend data.
 * Why: Keeps completion-rate query logic isolated from the main course read service.
 */
import {
  EnrollmentRole,
  SubmissionStatus,
  UserStatus,
} from "../../prisma/index.js";

import { prisma } from "../../config/prismaClient.js";

export async function getCourseCompletionRatePercent(
  courseId: string,
): Promise<number> {
  const [activeStudentCount, publishedAssignmentCount, completedSubmissionCount] =
    await Promise.all([
      prisma.enrollment.count({
        where: {
          courseId,
          roleInCourse: EnrollmentRole.student,
          deletedAt: null,
          user: {
            deletedAt: null,
            status: UserStatus.active,
          },
        },
      }),
      prisma.assignment.count({
        where: {
          courseId,
          deletedAt: null,
          publishedAt: {
            not: null,
          },
        },
      }),
      prisma.submission.count({
        where: {
          deletedAt: null,
          status: {
            in: [
              SubmissionStatus.submitted,
              SubmissionStatus.late,
              SubmissionStatus.graded,
            ],
          },
          assignment: {
            courseId,
            deletedAt: null,
            publishedAt: {
              not: null,
            },
          },
          student: {
            deletedAt: null,
            status: UserStatus.active,
            enrollments: {
              some: {
                courseId,
                roleInCourse: EnrollmentRole.student,
                deletedAt: null,
              },
            },
          },
        },
      }),
    ]);

  const denominator = activeStudentCount * publishedAssignmentCount;
  if (denominator <= 0) {
    return 0;
  }

  const rate = (completedSubmissionCount / denominator) * 100;
  if (!Number.isFinite(rate)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(rate)));
}
