/**
 * Location: features/assignments/components/ielts/authoring/WritingAssignmentForm.tsx
 * Purpose: Render the writing authoring form per Figma layout.
 * Why: Matches Task 1/Task 2 prompt structure and visual upload with preview.
 */

import { useEffect, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import { RichTextEditor } from '@components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@components/ui/collapsible';
import { cn } from '@components/ui/utils';
import type { IeltsWritingConfig, IeltsWritingTask1Type, ShowSampleTiming } from '@lib/ielts';
import {
  countWords,
  isWithinWordLimit,
} from '@lib/ielts';
import { useEnabledWritingTaskTypes, useEnabledSampleTimingOptions } from '@features/ielts-config/api';
import { stripHtml } from '@lib/rich-text';
import { RubricSelector } from '@features/rubrics/components/RubricSelector';
import { Maximize2, Trash2, Upload, ChevronDown, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';

type WritingAssignmentFormProps = {
  value: IeltsWritingConfig;
  onChange: (value: IeltsWritingConfig) => void;
  onImageSelect: (file: File | null) => void;
  selectedImageFile?: File | null;
  courseId: string;
  onManageRubrics?: () => void;
};

export function WritingAssignmentForm({
  value,
  onChange,
  onImageSelect,
  selectedImageFile,
  courseId,
  onManageRubrics,
}: WritingAssignmentFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: task1Types, isLoading: isLoadingTask1Types, error: task1TypesError } = useEnabledWritingTaskTypes(1);
  const { data: sampleTimingOptions, isLoading: isLoadingTimingOptions, error: timingOptionsError } = useEnabledSampleTimingOptions();

  // Create preview URL when file changes
  useEffect(() => {
    if (selectedImageFile) {
      const url = URL.createObjectURL(selectedImageFile);
      setPreviewUrl(url);
      setFileName(selectedImageFile.name);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
      setFileName(null);
    }
  }, [selectedImageFile]);

  const handleRemoveImage = () => {
    onImageSelect(null);
    setPreviewUrl(null);
    setFileName(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onImageSelect(file);
  };

  // Word count display component
  const WordCountDisplay = ({ text, max = 1000 }: { text: string | undefined | null; max?: number }) => {
    const wordCount = countWords(text);
    const isOverLimit = wordCount > max;

    return (
      <span className={cn("text-xs", isOverLimit && "text-destructive font-medium")}>
        {wordCount}/{max} words
      </span>
    );
  };

  // Show loading or error state
  if (isLoadingTask1Types || isLoadingTimingOptions) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading IELTS configuration...</p>
        </CardContent>
      </Card>
    );
  }

  if (task1TypesError || timingOptionsError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-destructive">Failed to load IELTS configuration</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please refresh the page or contact support if the problem persists.
          </p>
        </CardContent>
      </Card>
    );
  }

  const task1TypeOptions = task1Types?.map(tt => ({ value: tt.id, label: tt.label })) ?? [];
  const sampleTimingOptionOptions = sampleTimingOptions?.map(sto => ({ value: sto.id, label: sto.label })) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing Tasks</CardTitle>
        <CardDescription>Create Task 1 and Task 2 prompts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>Task 1</Badge>
            <span className="text-sm text-muted-foreground">150 words minimum</span>
          </div>
          <div className="space-y-2">
            <Label>Task 1 Prompt</Label>
            <Textarea
              value={stripHtml(value.task1.prompt)}
              onChange={(e) =>
                onChange({
                  ...value,
                  task1: { ...value.task1, prompt: stripHtml(e.target.value) },
                })
              }
              placeholder="The chart below shows... / You should spend about 20 minutes on this task..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Student Response</Label>
            <RichTextEditor
              value=""
              onChange={() => {}}
              placeholder="Students will write their response here..."
            />
          </div>
          <div className="space-y-2">
            <Label>Visual (Optional - Chart/Graph/Diagram)</Label>
            {!previewUrl ? (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Task 1 visual"
                    className="max-h-48 rounded-lg border object-contain"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="secondary" className="size-8">
                          <Maximize2 className="size-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Task 1 Visual</DialogTitle>
                          <DialogDescription>{fileName}</DialogDescription>
                        </DialogHeader>
                        <img
                          src={previewUrl}
                          alt="Task 1 visual full size"
                          className="w-full rounded-lg"
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="size-8"
                      onClick={handleRemoveImage}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{fileName}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('image-replace-input')?.click()}
                  >
                    <Upload className="mr-2 size-4" />
                    Replace
                  </Button>
                  <Input
                    id="image-replace-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Visual Type Dropdown */}
                <div className="space-y-2 mt-3">
                  <Label>Visual Type (Optional)</Label>
                  <Select
                    value={value.task1.visualType || ''}
                    onValueChange={(val: IeltsWritingTask1Type) =>
                      onChange({
                        ...value,
                        task1: { ...value.task1, visualType: val },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select visual type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {task1TypeOptions.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    For your reference only - students won't see this
                  </p>
                </div>

              </div>
            )}

            {/* Task 1 Rubric Selector */}
            <div className="mt-4 space-y-3">
              <RubricSelector
                courseId={courseId}
                value={value.task1.rubricId}
                onChange={(rubricId) =>
                  onChange({
                    ...value,
                    task1: { ...value.task1, rubricId },
                  })
                }
                label="Task 1 Rubric (Optional)"
                onManageRubrics={onManageRubrics}
              />
            </div>
          </div>

          {/* Task 1 Sample Response */}
          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-2 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Sample Response</span>
                  {value.task1.sampleResponse && (
                    <Badge variant="secondary" className="text-xs">
                      Added
                    </Badge>
                  )}
                </div>
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 px-2 pt-2">
              {/* Word count + textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task1-sample-response">Model Answer</Label>
                  <WordCountDisplay text={value.task1.sampleResponse} max={1000} />
                </div>
                <RichTextEditor
                  value={value.task1.sampleResponse || ''}
                  onChange={(text) => {
                    onChange({
                      ...value,
                      task1: { ...value.task1, sampleResponse: text },
                    });
                  }}
                  placeholder="Enter a model answer that demonstrates what a good response looks like..."
                />
                {!isWithinWordLimit(value.task1.sampleResponse) && (
                  <p className="text-xs text-destructive">
                    Sample response exceeds 1000 word limit
                  </p>
                )}
              </div>

              {/* Show to students toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="task1-show-sample" className="text-sm">
                    Show to Students
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Students can view this sample response
                  </p>
                </div>
                <Switch
                  id="task1-show-sample"
                  checked={value.task1.showSampleToStudents || false}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      task1: { ...value.task1, showSampleToStudents: checked },
                    })
                  }
                  disabled={!value.task1.sampleResponse || countWords(value.task1.sampleResponse) === 0}
                />
              </div>

              {/* Timing controls - only show if enabled */}
              {value.task1.showSampleToStudents && (
                <div className="space-y-3 rounded-lg border border-border/50 p-3">
                  <div className="space-y-2">
                    <Label>When should students see this?</Label>
                    <Select
                      value={value.task1.showSampleTiming || 'immediate'}
                      onValueChange={(val: ShowSampleTiming) =>
                        onChange({
                          ...value,
                          task1: { ...value.task1, showSampleTiming: val },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleTimingOptionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {value.task1.showSampleTiming === 'specific_date' && (
                    <div className="space-y-2">
                      <Label>Select date and time</Label>
                      <Input
                        type="datetime-local"
                        value={value.task1.showSampleDate || ''}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            task1: { ...value.task1, showSampleDate: e.target.value },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Based on your computer's local time
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="space-y-4 pt-6 border-t">
          <div className="flex items-center gap-2">
            <Badge>Task 2</Badge>
            <span className="text-sm text-muted-foreground">250 words minimum</span>
          </div>
          <div className="space-y-2">
            <Label>Task 2 Prompt</Label>
            <Textarea
              value={stripHtml(value.task2.prompt)}
              onChange={(e) =>
                onChange({
                  ...value,
                  task2: { ...value.task2, prompt: stripHtml(e.target.value) },
                })
              }
              placeholder="Some people believe that... Discuss both views and give your opinion..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Student Response</Label>
            <RichTextEditor
              value=""
              onChange={() => {}}
              placeholder="Students will write their response here..."
            />
          </div>

          {/* Task 2 Rubric Selector */}
          <div className="mt-4 space-y-3">
            <RubricSelector
              courseId={courseId}
              value={value.task2.rubricId}
              onChange={(rubricId) =>
                onChange({
                  ...value,
                  task2: { ...value.task2, rubricId },
                })
              }
              label="Task 2 Rubric (Optional)"
              onManageRubrics={onManageRubrics}
            />
          </div>

          {/* Task 2 Sample Response */}
          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-2 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Sample Response</span>
                  {value.task2.sampleResponse && (
                    <Badge variant="secondary" className="text-xs">
                      Added
                    </Badge>
                  )}
                </div>
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 px-2 pt-2">
              {/* Word count + textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task2-sample-response">Model Answer</Label>
                  <WordCountDisplay text={value.task2.sampleResponse} max={1000} />
                </div>
                <RichTextEditor
                  value={value.task2.sampleResponse || ''}
                  onChange={(text) => {
                    onChange({
                      ...value,
                      task2: { ...value.task2, sampleResponse: text },
                    });
                  }}
                  placeholder="Enter a model answer that demonstrates what a good response looks like..."
                />
                {!isWithinWordLimit(value.task2.sampleResponse) && (
                  <p className="text-xs text-destructive">
                    Sample response exceeds 1000 word limit
                  </p>
                )}
              </div>

              {/* Show to students toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="task2-show-sample" className="text-sm">
                    Show to Students
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Students can view this sample response
                  </p>
                </div>
                <Switch
                  id="task2-show-sample"
                  checked={value.task2.showSampleToStudents || false}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      task2: { ...value.task2, showSampleToStudents: checked },
                    })
                  }
                  disabled={!value.task2.sampleResponse || countWords(value.task2.sampleResponse) === 0}
                />
              </div>

              {/* Timing controls - only show if enabled */}
              {value.task2.showSampleToStudents && (
                <div className="space-y-3 rounded-lg border border-border/50 p-3">
                  <div className="space-y-2">
                    <Label>When should students see this?</Label>
                    <Select
                      value={value.task2.showSampleTiming || 'immediate'}
                      onValueChange={(val: ShowSampleTiming) =>
                        onChange({
                          ...value,
                          task2: { ...value.task2, showSampleTiming: val },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleTimingOptionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {value.task2.showSampleTiming === 'specific_date' && (
                    <div className="space-y-2">
                      <Label>Select date and time</Label>
                      <Input
                        type="datetime-local"
                        value={value.task2.showSampleDate || ''}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            task2: { ...value.task2, showSampleDate: e.target.value },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Based on your computer's local time
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
