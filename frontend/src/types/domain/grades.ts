/**
 * Location: src/types/domain/grades.ts
 * Purpose: Define shared grade domain types for frontend grading flows.
 * Why: Keeps grading contracts independent from mock-specific definitions.
 */

export type GradeScoreDisplay =
  | { kind: 'ielts_band'; value: number; max: 9 }
  | { kind: 'points'; value: number; max: number };

export type GradeRubricBreakdownItem = {
  criteria: string;
  points: number;
  maxPoints: number;
  scale: 'ielts_band' | 'points';
};

export type Grade = {
  id: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  rubricBreakdown: GradeRubricBreakdownItem[];
  rawScore: number;
  adjustments: number;
  finalScore: number;
  band?: number;
  maxScore: number;
  scoreDisplay: GradeScoreDisplay;
  feedback: string;
  provisionalOnly?: boolean;
  feedbackLabel: 'teacher feedback' | 'teacher-reviewed AI-assisted feedback';
  studentAiFeedback?: {
    label: 'provisional AI feedback';
    status: string;
    feedback: Record<string, unknown>;
  };
  gradedAt?: Date;
  gradedBy?: string;
};
