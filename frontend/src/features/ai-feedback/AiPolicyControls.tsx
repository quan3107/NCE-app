/**
 * Location: features/ai-feedback/AiPolicyControls.tsx
 * Purpose: Render teacher controls for IELTS AI feedback policy.
 * Why: Assignment authoring and editing flows need one consistent policy editor.
 */

import { Bot, Eye, Image, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Label } from '@components/ui/label';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Switch } from '@components/ui/switch';
import type {
  IeltsAiProviderTier,
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsObjectiveExplanationsMode,
  IeltsWritingFeedbackMode,
} from '@lib/ielts';
import {
  buildAiFeedbackPolicyView,
  normalizeAiPolicyForAssignmentType,
} from './ui.logic';

type AiPolicyControlsProps = {
  type: IeltsAssignmentType;
  value: IeltsAssignmentConfig;
  onChange: (value: IeltsAssignmentConfig) => void;
};

const writingModes: Array<{
  value: IeltsWritingFeedbackMode;
  label: string;
  description: string;
}> = [
  {
    value: 'off',
    label: 'Off',
    description: 'No AI writing draft is generated for teacher review.',
  },
  {
    value: 'teacher_reviewed',
    label: 'Teacher-reviewed',
    description: 'AI drafts remain hidden until a teacher approves them.',
  },
  {
    value: 'instant_student_visible',
    label: 'Instant provisional',
    description: 'Students can see provisional feedback until teacher-final feedback replaces it.',
  },
];

const providerTiers: Array<{ value: IeltsAiProviderTier; label: string; description: string }> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Use the backend default route for this assignment.',
  },
  {
    value: 'low_cost',
    label: 'Low cost',
    description: 'Prefer the economical route for routine feedback.',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Prefer the higher-capability route for complex tasks.',
  },
];

export function AiPolicyControls({ type, value, onChange }: AiPolicyControlsProps) {
  const view = buildAiFeedbackPolicyView(type, value);

  const updatePolicy = (patch: Partial<IeltsAssignmentConfig['aiPolicy']>) => {
    onChange({
      ...value,
      aiPolicy: normalizeAiPolicyForAssignmentType(type, {
        ...value.aiPolicy,
        ...patch,
      }),
    });
  };

  const objectiveValue: IeltsObjectiveExplanationsMode = view.policy.objectiveExplanations;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" />
              AI Feedback Policy
            </CardTitle>
            <CardDescription>Controls what AI support can appear for this assignment.</CardDescription>
          </div>
          <Badge variant={view.policy.writingFeedbackMode === 'off' ? 'secondary' : 'default'}>
            {view.writingFeedbackLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Writing feedback</Label>
            {!view.writingFeedbackSupported && (
              <p className="text-xs text-muted-foreground">
                Writing feedback is only available for IELTS writing assignments.
              </p>
            )}
          </div>
          <RadioGroup
            value={view.policy.writingFeedbackMode}
            onValueChange={(mode) =>
              updatePolicy({ writingFeedbackMode: mode as IeltsWritingFeedbackMode })
            }
            className="grid gap-3 md:grid-cols-3"
            aria-label="Writing feedback mode"
          >
            {writingModes.map((mode) => (
              <Label
                key={mode.value}
                className="flex min-h-[112px] cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem
                  value={mode.value}
                  disabled={!view.writingFeedbackSupported && mode.value !== 'off'}
                />
                <span className="space-y-1">
                  <span className="block font-medium">{mode.label}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    {mode.description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="objective-explanations" className="flex items-center gap-2">
                  <Eye className="size-4" />
                  Objective explanations
                </Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  On-demand explanations for scored reading and listening questions.
                </p>
              </div>
              <Switch
                id="objective-explanations"
                checked={objectiveValue === 'on_demand_student_visible'}
                disabled={!view.objectiveExplanationsSupported}
                onCheckedChange={(checked) =>
                  updatePolicy({
                    objectiveExplanations: checked ? 'on_demand_student_visible' : 'off',
                  })
                }
              />
            </div>
            {!view.objectiveExplanationsSupported && (
              <p className="mt-3 text-xs text-muted-foreground">
                Explanations are disabled for writing and speaking assignments.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <Label className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Provider tier
            </Label>
            <Select
              value={view.policy.providerTier}
              onValueChange={(tier) => updatePolicy({ providerTier: tier as IeltsAiProviderTier })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider tier" />
              </SelectTrigger>
              <SelectContent>
                {providerTiers.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              {providerTiers.find((tier) => tier.value === view.policy.providerTier)?.description}
            </p>
          </div>
        </div>

        {type === 'writing' && view.imageContext.status !== 'not-visual-writing' && (
          <Alert
            className={
              view.imageContext.status === 'available'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : undefined
            }
          >
            <Image className="size-4" />
            <AlertTitle>Task 1 image context</AlertTitle>
            <AlertDescription>{view.imageContext.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
