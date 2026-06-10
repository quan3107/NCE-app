/**
 * Location: src/types/domain/grades.ts
 * Purpose: Define shared grade domain types for frontend grading flows.
 * Why: Keeps grading contracts independent from mock-specific definitions.
 */

export type Grade = {
  id: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  rubricBreakdown: { criteria: string; points: number; maxPoints: number }[];
  rawScore: number;
  adjustments: number;
  finalScore: number;
  band?: number;
  maxScore: number;
  feedback: string;
  feedbackLabel: 'teacher feedback' | 'teacher-reviewed AI-assisted feedback';
  studentAiFeedback?: {
    label: 'provisional AI feedback';
    status: string;
    feedback: Record<string, unknown>;
  };
  gradedAt: Date;
  gradedBy: string;
};
