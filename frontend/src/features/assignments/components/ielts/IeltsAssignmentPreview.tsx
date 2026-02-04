/**
 * Location: features/assignments/components/ielts/IeltsAssignmentPreview.tsx
 * Purpose: Render a read-only preview summary of the IELTS config.
 * Why: Gives teachers a quick QA check before publishing.
 */

import { Card } from '@components/ui/card';
import type {
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsListeningConfig,
  IeltsReadingConfig,
  IeltsSpeakingConfig,
  IeltsWritingConfig,
} from '@lib/ielts';
import { stripHtml } from '@lib/rich-text';

type IeltsAssignmentPreviewProps = {
  type: IeltsAssignmentType;
  value: IeltsAssignmentConfig;
};

export function IeltsAssignmentPreview({ type, value }: IeltsAssignmentPreviewProps) {
  const timingLabel = value.timing.enabled
    ? `${value.timing.durationMinutes} min${value.timing.enforce ? ' (enforced)' : ''}`
    : 'Timing disabled';

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Instructions</div>
        <p className="mt-2 text-sm">{value.instructions || 'No instructions provided.'}</p>
      </Card>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Timing</div>
        <p className="mt-2 text-sm">{timingLabel}</p>
      </Card>

      {type === 'reading' && (
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Reading Summary</div>
          {(value as IeltsReadingConfig).sections.map((section, index) => (
            <div key={section.id} className="text-sm">
              Passage {index + 1}: {section.questions.length} questions
            </div>
          ))}
        </Card>
      )}

      {type === 'listening' && (
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Listening Summary</div>
          {(value as IeltsListeningConfig).sections.map((section, index) => (
            <div key={section.id} className="text-sm">
              Section {index + 1}: {section.questions.length} questions
            </div>
          ))}
        </Card>
      )}

      {type === 'writing' && (
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Writing Summary</div>
          <p className="text-sm">
            Task 1 prompt length: {stripHtml((value as IeltsWritingConfig).task1.prompt).length} chars
          </p>
          <p className="text-sm">
            Task 2 prompt length: {stripHtml((value as IeltsWritingConfig).task2.prompt).length} chars
          </p>
        </Card>
      )}

      {type === 'speaking' && (
        <Card className="p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Speaking Summary</div>
          <p className="text-sm">
            Part 1 questions: {(value as IeltsSpeakingConfig).part1.questions.length}
          </p>
          <p className="text-sm">
            Part 2 bullets: {(value as IeltsSpeakingConfig).part2.cueCard.bulletPoints.length}
          </p>
          <p className="text-sm">
            Part 3 questions: {(value as IeltsSpeakingConfig).part3.questions.length}
          </p>
        </Card>
      )}
    </div>
  );
}
