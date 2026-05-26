/**
 * Location: features/assignments/components/teacherGrade.logic.ts
 * Purpose: Keep grading rubric extraction and score helpers outside the page component.
 * Why: Makes the teacher grading route smaller while keeping scoring behavior testable.
 */

export type GradeCriterion = {
  key: string;
  label: string;
  max: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const getAssignmentRubricIds = (
  assignmentConfig: Record<string, unknown> | null | undefined,
): string[] => {
  const config = asRecord(assignmentConfig);
  if (!config) {
    return [];
  }

  const rubricIds = new Set<string>();
  const task1 = asRecord(config.task1);
  const task2 = asRecord(config.task2);

  if (typeof task1?.rubricId === 'string' && task1.rubricId.length > 0) {
    rubricIds.add(task1.rubricId);
  }
  if (typeof task2?.rubricId === 'string' && task2.rubricId.length > 0) {
    rubricIds.add(task2.rubricId);
  }
  if (typeof config.rubricId === 'string' && config.rubricId.length > 0) {
    rubricIds.add(config.rubricId);
  }

  return Array.from(rubricIds);
};

export const toGradeCriteria = (
  criteria: Array<{ criterion: string; levels: Array<{ points: number }> }>,
): GradeCriterion[] => {
  return criteria.map((criterion, index) => ({
    key: `${index}`,
    label: criterion.criterion,
    max:
      criterion.levels.length > 0
        ? Math.max(...criterion.levels.map((level) => level.points))
        : 100,
  }));
};

export const calculateRawScore = (
  rubricDrivenMode: boolean,
  gradeCriteria: GradeCriterion[],
  scores: Record<string, number>,
  rawScoreInput: number,
) =>
  rubricDrivenMode
    ? gradeCriteria.reduce((sum, criterion) => sum + (scores[criterion.key] ?? 0), 0)
    : rawScoreInput;
