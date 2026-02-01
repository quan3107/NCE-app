/**
 * Location: features/assignments/components/ielts/IeltsAssignmentBuilder.tsx
 * Purpose: Compose the IELTS authoring UI (shared settings + type-specific builders).
 * Why: Keeps IELTS authoring consistent across create/edit flows.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import {
  createIeltsAssignmentConfig,
  type IeltsAssignmentConfig,
  type IeltsAssignmentType,
  type IeltsListeningConfig,
  type IeltsReadingConfig,
  type IeltsSpeakingConfig,
  type IeltsWritingConfig,
} from '@lib/ielts';

import { IeltsAssignmentPreview } from './IeltsAssignmentPreview';
import { IeltsTypeCards } from './IeltsTypeCards';
import { ListeningBuilder } from './ListeningBuilder';
import { ReadingBuilder } from './ReadingBuilder';
import { SpeakingBuilder } from './SpeakingBuilder';
import { WritingBuilder } from './WritingBuilder';

type IeltsAssignmentBuilderProps = {
  type: IeltsAssignmentType;
  value: IeltsAssignmentConfig;
  onChange: (value: IeltsAssignmentConfig) => void;
  onTypeChange: (type: IeltsAssignmentType, value: IeltsAssignmentConfig) => void;
  showTypeSelector?: boolean;
};

export function IeltsAssignmentBuilder({
  type,
  value,
  onChange,
  onTypeChange,
  showTypeSelector = true,
}: IeltsAssignmentBuilderProps) {
  const handleTypeChange = (nextType: IeltsAssignmentType) => {
    const nextConfig = createIeltsAssignmentConfig(nextType);
    onTypeChange(nextType, nextConfig);
  };

  const updateTiming = (patch: Partial<IeltsAssignmentConfig['timing']>) => {
    onChange({
      ...value,
      timing: {
        ...value.timing,
        ...patch,
      },
    });
  };

  const updateAttempts = (maxAttempts: number | null) => {
    onChange({
      ...value,
      attempts: {
        ...value.attempts,
        maxAttempts,
      },
    });
  };

  return (
    <div className="ielts-authoring space-y-8">
      {showTypeSelector && (
        <div className="space-y-4">
          <Label className="text-base">IELTS Skill</Label>
          <IeltsTypeCards value={type} onChange={handleTypeChange} />
        </div>
      )}

      <Tabs defaultValue="edit" className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50 p-1.5 h-auto">
          <TabsTrigger 
            value="edit" 
            className="data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-sm px-6 py-2.5 text-sm font-medium"
          >
            Edit
          </TabsTrigger>
          <TabsTrigger 
            value="preview"
            className="data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-sm px-6 py-2.5 text-sm font-medium"
          >
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6">
          <Card className="p-6 space-y-5 border-2">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Instructions</Label>
              <Textarea
                rows={4}
                value={value.instructions}
                onChange={(event) => onChange({ ...value, instructions: event.target.value })}
                placeholder="General instructions for students."
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Displayed on the student start screen and during the test.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={value.timing.durationMinutes}
                  onChange={(event) =>
                    updateTiming({ durationMinutes: Number(event.target.value || 0) })
                  }
                  disabled={!value.timing.enabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Timer Enabled</Label>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    checked={value.timing.enabled}
                    onCheckedChange={(checked) => updateTiming({ enabled: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {value.timing.enabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-md border-2 bg-muted/30 p-4">
              <div className="space-y-1 flex-1">
                <Label className="text-sm font-medium">Enforce Timing</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-submit when the timer ends.
                </p>
              </div>
              <Switch
                checked={value.timing.enforce}
                onCheckedChange={(checked) => updateTiming({ enforce: checked })}
                disabled={!value.timing.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Max Attempts</Label>
              <Input
                type="number"
                min={1}
                value={value.attempts.maxAttempts ?? ''}
                onChange={(event) =>
                  updateAttempts(event.target.value ? Number(event.target.value) : null)
                }
                placeholder="Unlimited"
              />
            </div>
          </Card>

          {type === 'reading' && (
            <ReadingBuilder value={value as IeltsReadingConfig} onChange={onChange} />
          )}
          {type === 'listening' && (
            <ListeningBuilder value={value as IeltsListeningConfig} onChange={onChange} />
          )}
          {type === 'writing' && (
            <WritingBuilder value={value as IeltsWritingConfig} onChange={onChange} />
          )}
          {type === 'speaking' && (
            <SpeakingBuilder value={value as IeltsSpeakingConfig} onChange={onChange} />
          )}
        </TabsContent>

        <TabsContent value="preview">
          <IeltsAssignmentPreview type={type} value={value} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
