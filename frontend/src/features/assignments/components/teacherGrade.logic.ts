/**
 * Location: features/assignments/components/teacherGrade.logic.ts
 * Purpose: Keep grading rubric extraction and score helpers outside the page component.
 * Why: Makes the teacher grading route smaller while keeping scoring behavior testable.
 */

export type GradeCriterion = {
  key: string;
  label: string;
  max: number;
  step?: number;
  payloadCriterion?: string;
};

const IELTS_WRITING_GRADE_CRITERIA: GradeCriterion[] = [
  {
    key: 'task1TaskAchievement',
    label: 'Task 1 - Task Achievement',
    payloadCriterion: 'Task 1 - Task Achievement',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task1CoherenceAndCohesion',
    label: 'Task 1 - Coherence and Cohesion',
    payloadCriterion: 'Task 1 - Coherence and Cohesion',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task1LexicalResource',
    label: 'Task 1 - Lexical Resource',
    payloadCriterion: 'Task 1 - Lexical Resource',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task1GrammaticalRangeAndAccuracy',
    label: 'Task 1 - Grammatical Range and Accuracy',
    payloadCriterion: 'Task 1 - Grammatical Range and Accuracy',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task2TaskResponse',
    label: 'Task 2 - Task Response',
    payloadCriterion: 'Task 2 - Task Response',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task2CoherenceAndCohesion',
    label: 'Task 2 - Coherence and Cohesion',
    payloadCriterion: 'Task 2 - Coherence and Cohesion',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task2LexicalResource',
    label: 'Task 2 - Lexical Resource',
    payloadCriterion: 'Task 2 - Lexical Resource',
    max: 9,
    step: 0.5,
  },
  {
    key: 'task2GrammaticalRangeAndAccuracy',
    label: 'Task 2 - Grammatical Range and Accuracy',
    payloadCriterion: 'Task 2 - Grammatical Range and Accuracy',
    max: 9,
    step: 0.5,
  },
];

const IELTS_SPEAKING_GRADE_CRITERIA: GradeCriterion[] = [
  {
    key: 'fluencyAndCoherence',
    label: 'Fluency and Coherence',
    max: 9,
    step: 0.5,
  },
  {
    key: 'lexicalResource',
    label: 'Lexical Resource',
    max: 9,
    step: 0.5,
  },
  {
    key: 'grammaticalRangeAndAccuracy',
    label: 'Grammatical Range and Accuracy',
    max: 9,
    step: 0.5,
  },
  {
    key: 'pronunciation',
    label: 'Pronunciation',
    max: 9,
    step: 0.5,
  },
];

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

export const getIeltsManualGradeCriteria = (
  assignmentType: string | null | undefined,
): GradeCriterion[] => {
  if (assignmentType === 'writing') {
    return IELTS_WRITING_GRADE_CRITERIA;
  }
  if (assignmentType === 'speaking') {
    return IELTS_SPEAKING_GRADE_CRITERIA;
  }
  return [];
};

export const isValidIeltsBandScore = (score: number): boolean => {
  if (!Number.isFinite(score) || score < 0 || score > 9) {
    return false;
  }
  return Math.abs(score * 2 - Math.round(score * 2)) < 0.00001;
};

export const calculateIeltsBandFromScores = (
  gradeCriteria: GradeCriterion[],
  scores: Record<string, number>,
): number => {
  if (gradeCriteria.length === 0) {
    return 0;
  }
  const total = gradeCriteria.reduce(
    (sum, criterion) => sum + (scores[criterion.key] ?? 0),
    0,
  );
  return Math.round((total / gradeCriteria.length) * 2) / 2;
};

export const calculateRawScore = (
  rubricDrivenMode: boolean,
  gradeCriteria: GradeCriterion[],
  scores: Record<string, number>,
  rawScoreInput: number,
  mode: 'sum' | 'ieltsBand' = 'sum',
) =>
  rubricDrivenMode
    ? mode === 'ieltsBand'
      ? calculateIeltsBandFromScores(gradeCriteria, scores)
      : gradeCriteria.reduce((sum, criterion) => sum + (scores[criterion.key] ?? 0), 0)
    : rawScoreInput;
