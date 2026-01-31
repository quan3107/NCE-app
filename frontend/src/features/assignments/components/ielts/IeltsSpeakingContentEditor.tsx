/**
 * Location: features/assignments/components/ielts/IeltsSpeakingContentEditor.tsx
 * Purpose: Inline editor for IELTS speaking parts (Part 1, 2, and 3).
 * Why: Allows teachers to edit speaking questions, cue card content, and timing.
 */

import type { IeltsSpeakingConfig } from '@lib/ielts';
import { Textarea } from '@components/ui/textarea';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

type IeltsSpeakingContentEditorProps = {
  value: IeltsSpeakingConfig;
  onChange: (updated: IeltsSpeakingConfig) => void;
};

export function IeltsSpeakingContentEditor({ value, onChange }: IeltsSpeakingContentEditorProps) {
  // Part 1 handlers
  const handleAddPart1Question = () => {
    onChange({
      ...value,
      part1: {
        ...value.part1,
        questions: [...value.part1.questions, ''],
      },
    });
  };

  const handleUpdatePart1Question = (index: number, question: string) => {
    const newQuestions = [...value.part1.questions];
    newQuestions[index] = question;
    onChange({
      ...value,
      part1: { ...value.part1, questions: newQuestions },
    });
  };

  const handleDeletePart1Question = (index: number) => {
    const newQuestions = value.part1.questions.filter((_, i) => i !== index);
    if (newQuestions.length === 0) newQuestions.push('');
    onChange({
      ...value,
      part1: { ...value.part1, questions: newQuestions },
    });
  };

  // Part 3 handlers
  const handleAddPart3Question = () => {
    onChange({
      ...value,
      part3: {
        ...value.part3,
        questions: [...value.part3.questions, ''],
      },
    });
  };

  const handleUpdatePart3Question = (index: number, question: string) => {
    const newQuestions = [...value.part3.questions];
    newQuestions[index] = question;
    onChange({
      ...value,
      part3: { ...value.part3, questions: newQuestions },
    });
  };

  const handleDeletePart3Question = (index: number) => {
    const newQuestions = value.part3.questions.filter((_, i) => i !== index);
    if (newQuestions.length === 0) newQuestions.push('');
    onChange({
      ...value,
      part3: { ...value.part3, questions: newQuestions },
    });
  };

  // Part 2 Cue Card handlers
  const handleUpdateCueCardTopic = (topic: string) => {
    onChange({
      ...value,
      part2: {
        ...value.part2,
        cueCard: { ...value.part2.cueCard, topic },
      },
    });
  };

  const handleAddCueCardPoint = () => {
    onChange({
      ...value,
      part2: {
        ...value.part2,
        cueCard: {
          ...value.part2.cueCard,
          bulletPoints: [...value.part2.cueCard.bulletPoints, ''],
        },
      },
    });
  };

  const handleUpdateCueCardPoint = (index: number, point: string) => {
    const newPoints = [...value.part2.cueCard.bulletPoints];
    newPoints[index] = point;
    onChange({
      ...value,
      part2: {
        ...value.part2,
        cueCard: { ...value.part2.cueCard, bulletPoints: newPoints },
      },
    });
  };

  const handleDeleteCueCardPoint = (index: number) => {
    const newPoints = value.part2.cueCard.bulletPoints.filter((_, i) => i !== index);
    if (newPoints.length === 0) newPoints.push('');
    onChange({
      ...value,
      part2: {
        ...value.part2,
        cueCard: { ...value.part2.cueCard, bulletPoints: newPoints },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Part 1 */}
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Part 1</CardTitle>
          <CardDescription>Introduction and interview questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.part1.questions.map((question, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-sm font-medium text-muted-foreground mt-2 min-w-[2ch]">
                {index + 1}.
              </span>
              <Textarea
                value={question}
                onChange={(e) => handleUpdatePart1Question(index, e.target.value)}
                placeholder={`Part 1 question ${index + 1}...`}
                className="flex-1 min-h-[60px] resize-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => handleDeletePart1Question(index)}
                disabled={value.part1.questions.length <= 1}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={handleAddPart1Question}>
            <Plus className="size-4 mr-2" />
            Add Question
          </Button>
        </CardContent>
      </Card>

      {/* Part 2 */}
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Part 2</CardTitle>
          <CardDescription>Cue card and preparation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <Textarea
              value={value.part2.cueCard.topic}
              onChange={(e) => handleUpdateCueCardTopic(e.target.value)}
              placeholder="Describe a time when..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Preparation Time</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={value.part2.prepSeconds}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      part2: { ...value.part2, prepSeconds: parseInt(e.target.value) || 60 },
                    })
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Talk Time</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={30}
                  max={600}
                  value={value.part2.talkSeconds}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      part2: { ...value.part2, talkSeconds: parseInt(e.target.value) || 120 },
                    })
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
            </div>
          </div>

          {/* Cue Card Bullet Points */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Cue Card Bullet Points</label>
            <div className="space-y-2">
              {value.part2.cueCard.bulletPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-muted-foreground">•</span>
                  <Input
                    value={point}
                    onChange={(e) => handleUpdateCueCardPoint(index, e.target.value)}
                    placeholder={`Bullet point ${index + 1}...`}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => handleDeleteCueCardPoint(index)}
                    disabled={value.part2.cueCard.bulletPoints.length <= 1}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={handleAddCueCardPoint}>
                <Plus className="size-4 mr-2" />
                Add Bullet Point
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Part 3 */}
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Part 3</CardTitle>
          <CardDescription>Discussion questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.part3.questions.map((question, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-sm font-medium text-muted-foreground mt-2 min-w-[2ch]">
                {index + 1}.
              </span>
              <Textarea
                value={question}
                onChange={(e) => handleUpdatePart3Question(index, e.target.value)}
                placeholder={`Part 3 question ${index + 1}...`}
                className="flex-1 min-h-[60px] resize-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => handleDeletePart3Question(index)}
                disabled={value.part3.questions.length <= 1}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={handleAddPart3Question}>
            <Plus className="size-4 mr-2" />
            Add Question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
