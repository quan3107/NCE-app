/**
 * Location: features/assignments/components/ielts/SpeakingBuilder.tsx
 * Purpose: Render the IELTS Speaking authoring form (Parts 1-3).
 * Why: Provides structured inputs for cues, timing, and question lists.
 */

import { Card } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type { IeltsSpeakingConfig } from '@lib/ielts';
import { StringListEditor } from './StringListEditor';

type SpeakingBuilderProps = {
  value: IeltsSpeakingConfig;
  onChange: (value: IeltsSpeakingConfig) => void;
};

export function SpeakingBuilder({ value, onChange }: SpeakingBuilderProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 border-2 bg-card shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="section-badge">1</span>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Part 1: Introduction Questions</h3>
            <p className="text-xs text-muted-foreground">
              Short warm-up questions asked by the examiner.
            </p>
          </div>
        </div>
        <StringListEditor
          label="Part 1 Questions"
          values={value.part1.questions}
          onChange={(questions) => onChange({ ...value, part1: { questions } })}
          placeholder="Enter a Part 1 question"
          addLabel="Add Part 1 question"
        />
      </Card>

      <Card className="p-6 border-2 bg-card shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="section-badge">2</span>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Part 2: Cue Card</h3>
            <p className="text-xs text-muted-foreground">
              Student receives a cue card and prepares before speaking.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Topic</Label>
          <Input
            value={value.part2.cueCard.topic}
            onChange={(event) =>
              onChange({
                ...value,
                part2: {
                  ...value.part2,
                  cueCard: { ...value.part2.cueCard, topic: event.target.value },
                },
              })
            }
            placeholder="Cue card topic"
          />
        </div>

        <StringListEditor
          label="Bullet Points"
          values={value.part2.cueCard.bulletPoints}
          onChange={(bulletPoints) =>
            onChange({
              ...value,
              part2: {
                ...value.part2,
                cueCard: { ...value.part2.cueCard, bulletPoints },
              },
            })
          }
          placeholder="Add a prompt point"
          addLabel="Add bullet point"
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Preparation Time (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={value.part2.prepSeconds}
              onChange={(event) =>
                onChange({
                  ...value,
                  part2: {
                    ...value.part2,
                    prepSeconds: Number(event.target.value || 0),
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Talk Time (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={value.part2.talkSeconds}
              onChange={(event) =>
                onChange({
                  ...value,
                  part2: {
                    ...value.part2,
                    talkSeconds: Number(event.target.value || 0),
                  },
                })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 border-2 bg-card shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="section-badge">3</span>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Part 3: Discussion Questions</h3>
            <p className="text-xs text-muted-foreground">
              Deeper follow-up questions on the Part 2 topic.
            </p>
          </div>
        </div>
        <StringListEditor
          label="Part 3 Questions"
          values={value.part3.questions}
          onChange={(questions) => onChange({ ...value, part3: { questions } })}
          placeholder="Enter a Part 3 question"
          addLabel="Add Part 3 question"
        />
      </Card>
    </div>
  );
}
