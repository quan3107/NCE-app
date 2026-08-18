/**
 * Location: features/grades/components/StudentGradePresentation.tsx
 * Purpose: Format student grade scores, feedback, and explanation text.
 * Why: Keeps presentation rules separate from grade loading and AI actions.
 */
import { Award } from 'lucide-react';

import type { Grade } from '@domain';

export const toFeedbackLabel = (label: Grade['feedbackLabel']) =>
  label === 'teacher-reviewed AI-assisted feedback'
    ? 'Teacher-reviewed AI-assisted Feedback'
    : 'Teacher Feedback';

const assertNever = (value: never): never => {
  throw new Error(`Unsupported score display: ${JSON.stringify(value)}`);
};

const formatBandScore = (value: number) => value.toFixed(1);

export const scoreSummary = (grade: Grade) => {
  if (grade.provisionalOnly) {
    return {
      primary: 'Provisional feedback',
      secondary: null,
      className: 'text-sm font-medium',
    };
  }
  if (grade.scoreDisplay.kind === 'ielts_band') {
    return {
      primary: formatBandScore(grade.scoreDisplay.value),
      secondary: null,
      className: 'text-3xl font-medium',
    };
  }
  if (grade.scoreDisplay.kind === 'unavailable') {
    return {
      primary: grade.scoreDisplay.label,
      secondary: null,
      className: 'text-sm font-medium',
    };
  }
  if (grade.scoreDisplay.kind === 'points') {
    const percentage =
      grade.scoreDisplay.max > 0
        ? `${((grade.scoreDisplay.value / grade.scoreDisplay.max) * 100).toFixed(0)}%`
        : null;
    return {
      primary: `${grade.scoreDisplay.value}/${grade.scoreDisplay.max}`,
      secondary: percentage,
      className: 'text-3xl font-medium',
    };
  }
  return assertNever(grade.scoreDisplay);
};

export const rubricScoreLabel = (item: Grade['rubricBreakdown'][number]) =>
  item.scale === 'ielts_band'
    ? `${formatBandScore(item.points)} / ${formatBandScore(item.maxPoints)}`
    : `${item.points}/${item.maxPoints}`;

export const rubricProgressValue = (
  item: Grade['rubricBreakdown'][number],
) => (item.maxPoints > 0 ? (item.points / item.maxPoints) * 100 : 0);

export const explanationText = (
  explanation: Record<string, unknown> | undefined,
) => {
  if (!explanation) {
    return '';
  }
  const preferred =
    explanation.short_explanation ??
    explanation.explanation ??
    explanation.rationale ??
    explanation.feedbackMd ??
    explanation.feedback ??
    explanation.content;
  return typeof preferred === 'string' ? preferred : JSON.stringify(explanation);
};

export const renderFeedbackContent = (feedback: string) => {
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  const flushListItems = () => {
    if (listItems.length === 0) {
      return;
    }
    elements.push(
      <ul key={`list-${elements.length}`} className="space-y-2 ml-4">
        {listItems.map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="size-1.5 rounded-full bg-primary/70 mt-2 flex-shrink-0" />
            <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  feedback.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      flushListItems();
      elements.push(
        <div key={index} className="pt-2 first:pt-0">
          <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
            <Award className="size-5 text-primary" />
            {trimmed.replace('# ', '')}
          </h3>
        </div>,
      );
    } else if (trimmed.startsWith('## ')) {
      flushListItems();
      elements.push(
        <div key={index} className="pt-3">
          <h4 className="text-base font-medium text-foreground/90 mb-2 pl-3 border-l-2 border-primary/40">
            {trimmed.replace('## ', '')}
          </h4>
        </div>,
      );
    } else if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.replace('- ', ''));
    } else if (trimmed) {
      flushListItems();
      elements.push(
        <p key={index} className="text-sm text-foreground/80 leading-relaxed">
          {trimmed}
        </p>,
      );
    }
  });
  flushListItems();
  return elements;
};
