/**
 * Location: features/assignments/components/ielts/IeltsAssignmentContentPreview.tsx
 * Purpose: Render the shared IELTS assignment content shell for teacher review.
 * Why: Keeps the detail view aligned with the Figma frame while delegating skill-specific layouts.
 */

import {
  type IeltsAssignmentConfig,
  type IeltsAssignmentType,
  type IeltsReadingConfig,
  type IeltsListeningConfig,
  type IeltsWritingConfig,
  type IeltsSpeakingConfig,
} from '@lib/ielts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { IeltsReadingContentPreview } from './IeltsReadingContentPreview';
import { IeltsListeningContentPreview } from './IeltsListeningContentPreview';
import { IeltsWritingContentPreview } from './IeltsWritingContentPreview';
import { IeltsSpeakingContentPreview } from './IeltsSpeakingContentPreview';

export type IeltsAssignmentContentPreviewProps = {
  type: IeltsAssignmentType;
  value: IeltsAssignmentConfig;
};

export function IeltsAssignmentContentPreview({
  type,
  value,
}: IeltsAssignmentContentPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
            <CardDescription>Student-facing guidance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {value.instructions || 'No instructions provided yet.'}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle className="text-base">Timing</CardTitle>
            <CardDescription>Duration and enforcement</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {value.timing.enabled
                ? `${value.timing.durationMinutes} minutes${value.timing.enforce ? ' (enforced)' : ''}`
                : 'Timing disabled'}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[14px]">
          <CardHeader>
            <CardTitle className="text-base">Attempts</CardTitle>
            <CardDescription>Submission limits</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {value.attempts.maxAttempts === null
                ? 'Unlimited attempts'
                : `${value.attempts.maxAttempts} attempts`}
            </p>
          </CardContent>
        </Card>
      </div>

      {type === 'reading' && (
        <IeltsReadingContentPreview value={value as IeltsReadingConfig} />
      )}
      {type === 'listening' && (
        <IeltsListeningContentPreview value={value as IeltsListeningConfig} />
      )}
      {type === 'writing' && (
        <IeltsWritingContentPreview value={value as IeltsWritingConfig} />
      )}
      {type === 'speaking' && (
        <IeltsSpeakingContentPreview value={value as IeltsSpeakingConfig} />
      )}
    </div>
  );
}
