/**
 * File: src/modules/scoring/ieltsManualGrading.ts
 * Purpose: Validate and normalize manually graded IELTS writing/speaking bands.
 * Why: Keeps IELTS-specific grading rules out of generic grade persistence.
 */
import { AssignmentType } from "../../prisma/index.js";

export type IeltsCriterionScore = {
  criterion: string;
  points: number;
};

const IELTS_MIN_BAND = 0;
const IELTS_MAX_BAND = 9;
const HALF_STEP = 0.5;
const EPSILON = 0.00001;

const WRITING_CRITERION_GROUPS = [
  ["Task Achievement", "Task Response"],
  ["Coherence and Cohesion"],
  ["Lexical Resource"],
  ["Grammatical Range and Accuracy"],
];

const SPEAKING_CRITERION_GROUPS = [
  ["Fluency and Coherence"],
  ["Lexical Resource"],
  ["Grammatical Range and Accuracy"],
  ["Pronunciation"],
];

export function isIeltsManualAssignment(
  assignmentType: AssignmentType,
): boolean {
  return (
    assignmentType === AssignmentType.writing ||
    assignmentType === AssignmentType.speaking
  );
}

export function isValidIeltsBandValue(value: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  if (value < IELTS_MIN_BAND || value > IELTS_MAX_BAND) {
    return false;
  }
  return Math.abs(value / HALF_STEP - Math.round(value / HALF_STEP)) < EPSILON;
}

export function roundIeltsBand(value: number): number {
  const rounded = Math.round(value / HALF_STEP) * HALF_STEP;
  return Math.min(IELTS_MAX_BAND, Math.max(IELTS_MIN_BAND, rounded));
}

export function getExpectedIeltsCriteria(
  assignmentType: AssignmentType,
): string[][] {
  return assignmentType === AssignmentType.speaking
    ? SPEAKING_CRITERION_GROUPS
    : WRITING_CRITERION_GROUPS;
}

export function validateIeltsCriterionBreakdown(
  assignmentType: AssignmentType,
  rubricBreakdown: IeltsCriterionScore[],
): void {
  const expectedGroups = getExpectedIeltsCriteria(assignmentType);
  const expectedNames = new Set(expectedGroups.flat());
  const receivedNames = new Set<string>();

  if (rubricBreakdown.length !== expectedGroups.length) {
    throw new Error(buildCriteriaMessage(assignmentType));
  }

  for (const score of rubricBreakdown) {
    if (!expectedNames.has(score.criterion)) {
      throw new Error(buildCriteriaMessage(assignmentType));
    }
    if (receivedNames.has(score.criterion)) {
      throw new Error("IELTS criteria must not be duplicated.");
    }
    if (!isValidIeltsBandValue(score.points)) {
      throw new Error("IELTS band values must use valid 0.5 increments.");
    }
    receivedNames.add(score.criterion);
  }

  for (const group of expectedGroups) {
    const matchedCount = group.filter((name) => receivedNames.has(name)).length;
    if (matchedCount !== 1) {
      throw new Error(buildCriteriaMessage(assignmentType));
    }
  }
}

export function calculateIeltsManualBand(
  rubricBreakdown: IeltsCriterionScore[],
): number {
  const total = rubricBreakdown.reduce((sum, item) => sum + item.points, 0);
  return roundIeltsBand(total / rubricBreakdown.length);
}

function buildCriteriaMessage(assignmentType: AssignmentType): string {
  const label =
    assignmentType === AssignmentType.speaking ? "speaking" : "writing";
  return `Grade must use the official IELTS ${label} criteria.`;
}
