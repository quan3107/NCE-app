/**
 * File: src/modules/analytics/analytics.service.ts
 * Purpose: Aggregate grade and submission analytics for teacher dashboards.
 * Why: Centralizes analytics computations so controllers remain thin and consistent.
 */
import { EnrollmentRole, Prisma } from "@prisma/client";

import { prisma } from "../../config/prismaClient.js";
import { createHttpError } from "../../utils/httpError.js";
import type { AnalyticsRubricAverage, TeacherAnalyticsResponse } from "./analytics.types.js";
import {
  NON_DRAFT_STATUSES,
  buildCourseStats,
  isSubmissionOnTime,
  readRubricBreakdown,
  safeAverage,
  safeRate,
  toCourseSummary,
  toNumber,
  type AssignmentRecord,
  type CourseRecord,
  type RubricTotals,
  type SubmissionRecord,
} from "./analytics.utils.js";

type AuthenticatedUser = {
  id: string;
  role: string;
};

type SubmissionGrade = {
  finalScore: Prisma.Decimal | number | string | null;
  rubricBreakdown: unknown;
  gradedAt: Date | null;
};

export async function getTeacherAnalytics(
  user?: AuthenticatedUser,
): Promise<TeacherAnalyticsResponse> {
  if (!user) {
    throw createHttpError(401, "Unauthorized");
  }

  const courses: CourseRecord[] = await prisma.course.findMany({
    where: {
      deletedAt: null,
      OR: [
        { ownerId: user.id },
        {
          enrollments: {
            some: {
              userId: user.id,
              roleInCourse: EnrollmentRole.teacher,
              deletedAt: null,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { title: "asc" },
  });

  const courseIds = courses.map((course) => course.id);

  if (courseIds.length === 0) {
    return {
      teacherId: user.id,
      courseCount: 0,
      onTimeRate: null,
      averageScore: null,
      averageTurnaroundDays: null,
      courses: [],
      rubricAverages: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const assignments: AssignmentRecord[] = await prisma.assignment.findMany({
    where: {
      courseId: { in: courseIds },
      deletedAt: null,
      publishedAt: { not: null },
    },
    select: {
      id: true,
      courseId: true,
      dueAt: true,
    },
  });

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const assignmentsById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );

  const submissions: Array<SubmissionRecord & { grade: SubmissionGrade | null }> =
    assignmentIds.length
      ? await prisma.submission.findMany({
          where: {
            assignmentId: { in: assignmentIds },
            deletedAt: null,
            status: { in: NON_DRAFT_STATUSES },
          },
          select: {
            assignmentId: true,
            status: true,
            submittedAt: true,
            createdAt: true,
            grade: {
              select: {
                finalScore: true,
                rubricBreakdown: true,
                gradedAt: true,
              },
            },
          },
        })
      : [];

  const courseStats = buildCourseStats(courses);
  const rubricTotals = new Map<string, RubricTotals>();

  let totalOnTime = 0;
  let totalSubmissions = 0;
  let totalScoreSum = 0;
  let totalScoreCount = 0;
  let totalTurnaroundSum = 0;
  let totalTurnaroundCount = 0;

  for (const submission of submissions) {
    const assignment = assignmentsById.get(submission.assignmentId);
    const courseId = assignment?.courseId;
    if (!courseId) {
      continue;
    }

    const stats = courseStats.get(courseId);
    if (!stats) {
      continue;
    }

    stats.submissionCount += 1;
    totalSubmissions += 1;

    if (isSubmissionOnTime(submission, assignment)) {
      stats.onTimeCount += 1;
      totalOnTime += 1;
    }

    if (submission.grade) {
      stats.gradedCount += 1;

      const score = toNumber(submission.grade.finalScore);
      if (score !== null) {
        stats.scoreSum += score;
        stats.scoreCount += 1;
        totalScoreSum += score;
        totalScoreCount += 1;
      }

      const submittedAt = submission.submittedAt ?? submission.createdAt;
      if (submission.grade.gradedAt && submittedAt) {
        const diffMs =
          submission.grade.gradedAt.getTime() - submittedAt.getTime();
        if (diffMs >= 0) {
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          stats.turnaroundSumDays += diffDays;
          stats.turnaroundCount += 1;
          totalTurnaroundSum += diffDays;
          totalTurnaroundCount += 1;
        }
      }

      const rubricItems = readRubricBreakdown(
        submission.grade.rubricBreakdown,
      );
      for (const item of rubricItems) {
        const existing = rubricTotals.get(item.criterion) ?? {
          sum: 0,
          count: 0,
        };
        existing.sum += item.points;
        existing.count += 1;
        rubricTotals.set(item.criterion, existing);
      }
    }
  }

  const courseSummaries = Array.from(courseStats.values()).map(toCourseSummary);

  const rubricAverages: AnalyticsRubricAverage[] = Array.from(
    rubricTotals.entries(),
  ).map(([criterion, totals]) => ({
    criterion,
    averageScore: safeAverage(totals.sum, totals.count) ?? 0,
    sampleSize: totals.count,
  }));

  return {
    teacherId: user.id,
    courseCount: courses.length,
    onTimeRate: safeRate(totalOnTime, totalSubmissions),
    averageScore: safeAverage(totalScoreSum, totalScoreCount),
    averageTurnaroundDays: safeAverage(
      totalTurnaroundSum,
      totalTurnaroundCount,
    ),
    courses: courseSummaries,
    rubricAverages,
    generatedAt: new Date().toISOString(),
  };
}
