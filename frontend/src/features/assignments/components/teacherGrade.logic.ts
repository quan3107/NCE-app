/**
 * Location: features/assignments/components/teacherGrade.logic.ts
 * Purpose: Keep grading rubric extraction and score helpers outside the page component.
 * Why: Makes the teacher grading route smaller while keeping scoring behavior testable.
 */

import type { Grade } from '@domain';

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

const IELTS_WRITING_TASK_1_GRADE_CRITERIA: GradeCriterion[] = [
  {
    key: 'taskAchievement',
    label: 'Task Achievement',
    max: 9,
    step: 0.5,
  },
  {
    key: 'coherenceAndCohesion',
    label: 'Coherence and Cohesion',
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
];

const IELTS_WRITING_TASK_2_GRADE_CRITERIA: GradeCriterion[] = [
  {
    key: 'taskResponse',
    label: 'Task Response',
    max: 9,
    step: 0.5,
  },
  {
    key: 'coherenceAndCohesion',
    label: 'Coherence and Cohesion',
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
  assignmentConfig?: Record<string, unknown> | null,
): GradeCriterion[] => {
  if (assignmentType === 'writing') {
    return getIeltsWritingGradeCriteria(assignmentConfig);
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
  if (isTaskScopedWritingCriteria(gradeCriteria)) {
    const task1Average = averageCriterionScores(
      gradeCriteria.filter(criterion =>
        (criterion.payloadCriterion ?? criterion.label).startsWith('Task 1 - '),
      ),
      scores,
    );
    const task2Average = averageCriterionScores(
      gradeCriteria.filter(criterion =>
        (criterion.payloadCriterion ?? criterion.label).startsWith('Task 2 - '),
      ),
      scores,
    );
    return roundIeltsBand((task1Average + task2Average * 2) / 3);
  }
  return roundIeltsBand(averageCriterionScores(gradeCriteria, scores));
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

export type ExistingGradeFormState = {
  scores: Record<string, number>;
  rawScoreInput: number;
  feedback: string;
};

export const getExistingGradeFormState = (
  existingGrade: Grade | null,
  gradeCriteria: GradeCriterion[],
  rubricDrivenMode: boolean,
): ExistingGradeFormState => {
  const defaultScores = rubricDrivenMode
    ? Object.fromEntries(gradeCriteria.map((criterion) => [criterion.key, 0]))
    : {};

  if (!existingGrade) {
    return {
      scores: defaultScores,
      rawScoreInput: 0,
      feedback: '',
    };
  }

  if (!rubricDrivenMode) {
    return {
      scores: defaultScores,
      rawScoreInput: existingGrade.rawScore,
      feedback: existingGrade.feedback,
    };
  }

  const breakdownByExactCriterion = new Map(
    existingGrade.rubricBreakdown.map((item) => [item.criteria, item.points]),
  );
  const breakdownByLegacyCriterion = new Map(
    existingGrade.rubricBreakdown.map((item) => [
      normalizeLegacyGradeCriterion(item.criteria),
      item.points,
    ]),
  );
  const scores = Object.fromEntries(
    gradeCriteria.map((criterion) => {
      const criterionName = criterion.payloadCriterion ?? criterion.label;
      const persistedScore =
        breakdownByExactCriterion.get(criterionName) ??
        breakdownByExactCriterion.get(criterion.label) ??
        breakdownByLegacyCriterion.get(normalizeLegacyGradeCriterion(criterionName)) ??
        breakdownByLegacyCriterion.get(normalizeLegacyGradeCriterion(criterion.label)) ??
        breakdownByLegacyCriterion.get(toLegacyWritingCriterionName(criterionName)) ??
        0;

      return [criterion.key, persistedScore];
    }),
  );

  return {
    scores,
    rawScoreInput: existingGrade.rawScore,
    feedback: existingGrade.feedback,
  };
};

const normalizeLegacyGradeCriterion = (criterion: string): string =>
  criterion
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^task\s+[12]\s*-\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

const toLegacyWritingCriterionName = (criterion: string): string => {
  const normalizedCriterion = normalizeLegacyGradeCriterion(criterion);
  return normalizedCriterion === 'task response' ? 'task achievement' : normalizedCriterion;
};

const averageCriterionScores = (
  gradeCriteria: GradeCriterion[],
  scores: Record<string, number>,
): number => {
  const total = gradeCriteria.reduce(
    (sum, criterion) => sum + (scores[criterion.key] ?? 0),
    0,
  );
  return total / gradeCriteria.length;
};

const roundIeltsBand = (score: number): number => Math.round(score * 2) / 2;

const getIeltsWritingGradeCriteria = (
  assignmentConfig?: Record<string, unknown> | null,
): GradeCriterion[] => {
  const config = asRecord(assignmentConfig);
  if (!config) {
    return IELTS_WRITING_GRADE_CRITERIA;
  }

  const hasTask1 = asRecord(config.task1) !== null;
  const hasTask2 = asRecord(config.task2) !== null;

  if (hasTask1 && !hasTask2) {
    return IELTS_WRITING_TASK_1_GRADE_CRITERIA;
  }
  if (hasTask2 && !hasTask1) {
    return IELTS_WRITING_TASK_2_GRADE_CRITERIA;
  }

  return IELTS_WRITING_GRADE_CRITERIA;
};

const isTaskScopedWritingCriteria = (gradeCriteria: GradeCriterion[]): boolean => {
  const names = new Set(
    gradeCriteria.map(criterion => criterion.payloadCriterion ?? criterion.label),
  );
  return IELTS_WRITING_GRADE_CRITERIA.every(criterion =>
    names.has(criterion.payloadCriterion ?? criterion.label),
  );
};
