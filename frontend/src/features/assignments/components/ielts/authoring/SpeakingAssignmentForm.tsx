/**
 * Location: features/assignments/components/ielts/authoring/SpeakingAssignmentForm.tsx
 * Purpose: Render the speaking authoring form per Figma layout.
 * Why: Matches the Part 1/2/3 tabbed configuration UI.
 */

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Textarea } from '@components/ui/textarea';
import type { IeltsSpeakingConfig } from '@lib/ielts';

type SpeakingAssignmentFormProps = {
  value: IeltsSpeakingConfig;
  onChange: (value: IeltsSpeakingConfig) => void;
};

export function SpeakingAssignmentForm({ value, onChange }: SpeakingAssignmentFormProps) {
  const updatePart1 = (questions: string[]) => {
    onChange({ ...value, part1: { questions } });
  };

  const updatePart3 = (questions: string[]) => {
    onChange({ ...value, part3: { questions } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speaking Parts</CardTitle>
        <CardDescription>Configure all three parts of the speaking test</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="part1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="part1">Part 1</TabsTrigger>
            <TabsTrigger value="part2">Part 2</TabsTrigger>
            <TabsTrigger value="part3">Part 3</TabsTrigger>
          </TabsList>

          <TabsContent value="part1" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Introduction and interview (4-5 minutes)</p>
            {value.part1.questions.map((question, index) => (
              <div key={`part1-${index}`} className="flex gap-2">
                <Input
                  value={question}
                  onChange={(event) => {
                    const next = [...value.part1.questions];
                    next[index] = event.target.value;
                    updatePart1(next);
                  }}
                  placeholder={`Question ${index + 1}`}
                />
                {value.part1.questions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updatePart1(value.part1.questions.filter((_, idx) => idx !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => updatePart1([...value.part1.questions, ''])}
            >
              <Plus className="mr-2 size-4" />
              Add Question
            </Button>
          </TabsContent>

          <TabsContent value="part2" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Individual long turn (3-4 minutes with 1 minute preparation)
            </p>
            <div className="space-y-2">
              <Label>Topic/Cue Card</Label>
              <Textarea
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
                placeholder="Describe a place you have visited..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Bullet Points</Label>
              {value.part2.cueCard.bulletPoints.map((bullet, index) => (
                <Input
                  key={`bullet-${index}`}
                  value={bullet}
                  onChange={(event) => {
                    const next = [...value.part2.cueCard.bulletPoints];
                    next[index] = event.target.value;
                    onChange({
                      ...value,
                      part2: {
                        ...value.part2,
                        cueCard: { ...value.part2.cueCard, bulletPoints: next },
                      },
                    });
                  }}
                  placeholder={`Point ${index + 1}: e.g., "Where it is"`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preparation Time (seconds)</Label>
                <Input
                  type="number"
                  value={value.part2.prepSeconds}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      part2: {
                        ...value.part2,
                        prepSeconds: parseInt(event.target.value, 10) || 60,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Talk Time (seconds)</Label>
                <Input
                  type="number"
                  value={value.part2.talkSeconds}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      part2: {
                        ...value.part2,
                        talkSeconds: parseInt(event.target.value, 10) || 120,
                      },
                    })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="part3" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Two-way discussion (4-5 minutes)</p>
            {value.part3.questions.map((question, index) => (
              <div key={`part3-${index}`} className="flex gap-2">
                <Input
                  value={question}
                  onChange={(event) => {
                    const next = [...value.part3.questions];
                    next[index] = event.target.value;
                    updatePart3(next);
                  }}
                  placeholder={`Discussion question ${index + 1}`}
                />
                {value.part3.questions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updatePart3(value.part3.questions.filter((_, idx) => idx !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => updatePart3([...value.part3.questions, ''])}
            >
              <Plus className="mr-2 size-4" />
              Add Question
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
