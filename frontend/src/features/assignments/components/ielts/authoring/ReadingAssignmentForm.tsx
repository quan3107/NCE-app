/**
 * Location: features/assignments/components/ielts/authoring/ReadingAssignmentForm.tsx
 * Purpose: Render the reading authoring form per Figma layout.
 * Why: Matches the passage accordion and question editor design.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import type { IeltsQuestion, IeltsQuestionType, IeltsReadingConfig } from '@lib/ielts';
import { IELTS_READING_QUESTION_TYPES } from '@lib/ielts';

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `reading-${Date.now()}-${Math.random()}`;

const createQuestion = (): IeltsQuestion => ({
  id: createId(),
  type: 'multiple_choice',
  prompt: '',
  options: ['', '', '', ''],
  correctAnswer: '',
});

export function ReadingAssignmentForm({
  value,
  onChange,
}: {
  value: IeltsReadingConfig;
  onChange: (value: IeltsReadingConfig) => void;
}) {
  const [expandedPassage, setExpandedPassage] = useState(0);

  const addPassage = () => {
    const nextSections = [
      ...value.sections,
      {
        id: createId(),
        title: `Passage ${value.sections.length + 1}`,
        passage: '',
        questions: [],
      },
    ];
    onChange({ ...value, sections: nextSections });
  };

  const updatePassage = (index: number, patch: Partial<IeltsReadingConfig['sections'][0]>) => {
    const nextSections = value.sections.map((section, idx) =>
      idx === index ? { ...section, ...patch } : section,
    );
    onChange({ ...value, sections: nextSections });
  };

  const addQuestion = (passageIndex: number) => {
    const questions = [...value.sections[passageIndex].questions, createQuestion()];
    updatePassage(passageIndex, { questions });
  };

  const removeQuestion = (passageIndex: number, questionIndex: number) => {
    const questions = value.sections[passageIndex].questions.filter(
      (_, idx) => idx !== questionIndex,
    );
    updatePassage(passageIndex, { questions });
  };

  const updateQuestion = (
    passageIndex: number,
    questionIndex: number,
    patch: Partial<IeltsQuestion>,
  ) => {
    const questions = value.sections[passageIndex].questions.map((question, idx) =>
      idx === questionIndex ? { ...question, ...patch } : question,
    );
    updatePassage(passageIndex, { questions });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reading Passages</CardTitle>
            <CardDescription>Create passages and questions for the reading test</CardDescription>
          </div>
          <Button onClick={addPassage} size="sm">
            <Plus className="mr-2 size-4" />
            Add Passage
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.sections.map((passage, passageIndex) => (
          <Card key={passage.id} className="border-2">
            <CardHeader
              className="cursor-pointer"
              onClick={() =>
                setExpandedPassage(expandedPassage === passageIndex ? -1 : passageIndex)
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{passage.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {passage.questions.length} questions
                  </p>
                </div>
                {expandedPassage === passageIndex ? <ChevronUp /> : <ChevronDown />}
              </div>
            </CardHeader>
            {expandedPassage === passageIndex && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Passage Title</Label>
                  <Input
                    value={passage.title}
                    onChange={(event) =>
                      updatePassage(passageIndex, { title: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passage Content</Label>
                  <Textarea
                    value={passage.passage}
                    onChange={(event) =>
                      updatePassage(passageIndex, { passage: event.target.value })
                    }
                    rows={8}
                    placeholder="Enter the reading passage text..."
                  />
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Questions</Label>
                    <Button onClick={() => addQuestion(passageIndex)} size="sm" variant="outline">
                      <Plus className="mr-2 size-4" />
                      Add Question
                    </Button>
                  </div>

                  {passage.questions.map((question, questionIndex) => (
                    <Card key={question.id} className="bg-muted/30">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <Label>Question {questionIndex + 1}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(passageIndex, questionIndex)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Select
                            value={question.type}
                            onValueChange={(nextValue) =>
                              updateQuestion(passageIndex, questionIndex, {
                                type: nextValue as IeltsQuestionType,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {IELTS_READING_QUESTION_TYPES.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(passageIndex, questionIndex, {
                              prompt: event.target.value,
                            })
                          }
                          placeholder="Enter question text..."
                          rows={2}
                        />
                        {question.type === 'multiple_choice' && (
                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => (
                              <Input
                                key={`${question.id}-${optionIndex}`}
                                value={option}
                                onChange={(event) => {
                                  const nextOptions = [...question.options];
                                  nextOptions[optionIndex] = event.target.value;
                                  updateQuestion(passageIndex, questionIndex, {
                                    options: nextOptions,
                                  });
                                }}
                                placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                              />
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Correct Answer</Label>
                          <Input
                            value={question.correctAnswer}
                            onChange={(event) =>
                              updateQuestion(passageIndex, questionIndex, {
                                correctAnswer: event.target.value,
                              })
                            }
                            placeholder="Enter correct answer"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
