/**
 * File: src/modules/assignments/assignments.helpers.ts
 * Purpose: Hold assignment service helper logic for rubric validation and student filtering.
 * Why: Keeps assignment service data-access functions small and behavior-focused.
 */
import { prisma } from "../../prisma/client.js";
import { UserRole } from "../../prisma/index.js";
import { createHttpError } from "../../utils/httpError.js";

type AssignmentWithSubmissions = {
  type: string;
  assignmentConfig: unknown;
  submissions?: Array<{
    id: string;
    status: string;
    grade?: {
      gradedAt: Date | null;
    } | null;
  }>;
};

type StudentSubmission = NonNullable<AssignmentWithSubmissions["submissions"]>[number];

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

export async function validateWritingRubrics(
  config: unknown,
  courseId: string,
): Promise<void> {
  const configRecord = asRecord(config);
  if (Object.keys(configRecord).length === 0) {
    return;
  }

  const task1 = asRecord(configRecord.task1);
  const task2 = asRecord(configRecord.task2);
  const rubricIds = [task1.rubricId, task2.rubricId].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (rubricIds.length === 0) {
    return;
  }

  const rubrics = await prisma.rubric.findMany({
    where: {
      id: { in: rubricIds },
      courseId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (rubrics.length !== rubricIds.length) {
    throw createHttpError(
      400,
      "One or more selected rubrics are invalid or do not belong to this course",
    );
  }
}

const shouldShowSample = (
  task: Record<string, unknown>,
  studentSubmission: StudentSubmission | undefined,
): boolean => {
  if (!task.showSampleToStudents || !task.sampleResponse) {
    return false;
  }

  switch (task.showSampleTiming || "immediate") {
    case "immediate":
      return true;
    case "after_submission":
      return (
        studentSubmission?.status === "submitted" ||
        studentSubmission?.status === "graded"
      );
    case "after_grading":
      return studentSubmission?.grade?.gradedAt != null;
    case "specific_date": {
      if (!task.showSampleDate) {
        return false;
      }
      return new Date() >= new Date(task.showSampleDate as string);
    }
    default:
      return true;
  }
};

export function shouldFilterWritingAssignmentForStudent(
  assignment: AssignmentWithSubmissions,
  user?: { id: string; role: string },
): boolean {
  return assignment.type === "writing" && user?.role === UserRole.student;
}

export function filterWritingAssignmentForStudent<
  TAssignment extends AssignmentWithSubmissions,
>(assignment: TAssignment): Omit<TAssignment, "submissions"> {
  const config = asRecord(assignment.assignmentConfig);
  const task1 = asRecord(config.task1);
  const task2 = asRecord(config.task2);
  const studentSubmission = assignment.submissions?.[0];
  const {
    submissions: ignoredSubmissions,
    ...assignmentWithoutSubmissions
  } = assignment;

  return {
    ...assignmentWithoutSubmissions,
    assignmentConfig: {
      ...config,
      task1: {
        prompt: task1.prompt,
        imageFileId: task1.imageFileId,
        sampleResponse: shouldShowSample(task1, studentSubmission)
          ? task1.sampleResponse
          : undefined,
      },
      task2: {
        prompt: task2.prompt,
        sampleResponse: shouldShowSample(task2, studentSubmission)
          ? task2.sampleResponse
          : undefined,
      },
    },
  };
}
