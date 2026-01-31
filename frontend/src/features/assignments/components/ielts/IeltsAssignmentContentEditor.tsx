/**
 * Location: features/assignments/components/ielts/IeltsAssignmentContentEditor.tsx
 * Purpose: Main editor wrapper for IELTS assignments with settings cards and skill-specific editors.
 * Why: Provides unified editing interface for all IELTS skills with shared configuration.
 */

import type {
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsReadingConfig,
  IeltsListeningConfig,
  IeltsWritingConfig,
  IeltsSpeakingConfig,
} from '@lib/ielts';
import { Textarea } from '@components/ui/textarea';
import { Input } from '@components/ui/input';
import { Switch } from '@components/ui/switch';
import { Label } from '@components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { IeltsReadingContentEditor } from './IeltsReadingContentEditor';
import { IeltsListeningContentEditor } from './IeltsListeningContentEditor';
import { IeltsWritingContentEditor } from './IeltsWritingContentEditor';
import { IeltsSpeakingContentEditor } from './IeltsSpeakingContentEditor';

export type IeltsAssignmentContentEditorProps = {
  type: IeltsAssignmentType;
  value: IeltsAssignmentConfig;
  onChange: (updated: IeltsAssignmentConfig) => void;
};

export function IeltsAssignmentContentEditor({
  type,
  value,
  onChange,
}: IeltsAssignmentContentEditorProps) {
  // Update base config (instructions, timing, attempts)
  const handleUpdateBase = (updates: Partial<typeof value>) => {
    onChange({ ...value, ...updates });
  };

  const handleTimingChange = (updates: Partial<typeof value.timing>) => {
    onChange({
      ...value,
      timing: { ...value.timing, ...updates },
    });
  };

  const handleAttemptsChange = (updates: Partial<typeof value.attempts>) => {
    onChange({
      ...value,
      attempts: { ...value.attempts, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      {/* Settings Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Instructions */}
        <Card className="rounded-[14px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Instructions</CardTitle>
            <CardDescription>Student-facing guidance</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={value.instructions}
              onChange={(e) => handleUpdateBase({ instructions: e.target.value })}
              placeholder="Enter instructions for students..."
              className="min-h-[100px] resize-none text-sm"
            />
          </CardContent>
        </Card>

        {/* Timing */}
        <Card className="rounded-[14px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timing</CardTitle>
            <CardDescription>Duration and enforcement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="timing-enabled" className="text-sm cursor-pointer">
                Enable Timer
              </Label>
              <Switch
                id="timing-enabled"
                checked={value.timing.enabled}
                onCheckedChange={(checked) => handleTimingChange({ enabled: checked })}
              />
            </div>

            {value.timing.enabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm">Duration (minutes)</label>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={value.timing.durationMinutes}
                    onChange={(e) =>
                      handleTimingChange({ durationMinutes: parseInt(e.target.value) || 60 })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enforce-timing" className="text-sm cursor-pointer">
                    Enforce Strict Timing
                  </Label>
                  <Switch
                    id="enforce-timing"
                    checked={value.timing.enforce}
                    onCheckedChange={(checked) => handleTimingChange({ enforce: checked })}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Attempts */}
        <Card className="rounded-[14px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attempts</CardTitle>
            <CardDescription>Submission limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="unlimited-attempts" className="text-sm cursor-pointer">
                Unlimited Attempts
              </Label>
              <Switch
                id="unlimited-attempts"
                checked={value.attempts.maxAttempts === null}
                onCheckedChange={(checked) =>
                  handleAttemptsChange({ maxAttempts: checked ? null : 1 })
                }
              />
            </div>

            {value.attempts.maxAttempts !== null && (
              <div className="space-y-2">
                <label className="text-sm">Max Attempts</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={value.attempts.maxAttempts}
                  onChange={(e) =>
                    handleAttemptsChange({ maxAttempts: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skill-specific editors */}
      {type === 'reading' && (
        <IeltsReadingContentEditor
          value={value as IeltsReadingConfig}
          onChange={(updated) => onChange(updated as IeltsAssignmentConfig)}
        />
      )}
      {type === 'listening' && (
        <IeltsListeningContentEditor
          value={value as IeltsListeningConfig}
          onChange={(updated) => onChange(updated as IeltsAssignmentConfig)}
        />
      )}
      {type === 'writing' && (
        <IeltsWritingContentEditor
          value={value as IeltsWritingConfig}
          onChange={(updated) => onChange(updated as IeltsAssignmentConfig)}
        />
      )}
      {type === 'speaking' && (
        <IeltsSpeakingContentEditor
          value={value as IeltsSpeakingConfig}
          onChange={(updated) => onChange(updated as IeltsAssignmentConfig)}
        />
      )}
    </div>
  );
}
