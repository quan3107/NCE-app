/**
 * Location: src/lib/zodSchemas.ts
 * Purpose: Provide placeholder schema validators pending real Zod integration.
 * Why: Allows feature modules to import common contracts without runtime dependencies yet.
 */

export type AssignmentFormInput = {
  title: string;
  description: string;
  dueAt: string;
  courseId: string;
};

export function validateAssignmentInput(input: AssignmentFormInput) {
  const isValid =
    Boolean(input.title?.trim()) &&
    Boolean(input.description?.trim()) &&
    Boolean(input.courseId?.trim()) &&
    Boolean(input.dueAt?.trim());

  return {
    success: isValid,
    data: input,
    errors: isValid ? undefined : ['Missing required assignment fields.'],
  };
}
