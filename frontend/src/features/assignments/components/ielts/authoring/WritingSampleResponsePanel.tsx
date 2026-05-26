/**
 * Location: features/assignments/components/ielts/authoring/WritingSampleResponsePanel.tsx
 * Purpose: Render reusable IELTS writing sample-response controls.
 * Why: Task 1 and Task 2 share the same model-answer, visibility, and timing UI.
 */

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@components/ui/collapsible';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { RichTextEditor } from '@components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Switch } from '@components/ui/switch';
import { cn } from '@components/ui/utils';
import type { ShowSampleTiming } from '@lib/ielts';
import { countWords, isWithinWordLimit } from '@lib/ielts';
import { BookOpen, ChevronDown } from 'lucide-react';

type SampleTimingOption = {
  value: string;
  label: string;
};

type WritingSampleResponsePanelProps = {
  date?: string;
  htmlIdPrefix: string;
  onChangeDate: (date: string) => void;
  onChangeResponse: (text: string) => void;
  onChangeShowToStudents: (checked: boolean) => void;
  onChangeTiming: (timing: ShowSampleTiming) => void;
  sampleResponse?: string;
  sampleTiming?: ShowSampleTiming;
  sampleTimingOptions: SampleTimingOption[];
  showToStudents?: boolean;
};

function WordCountDisplay({ text, max = 1000 }: { text?: string; max?: number }) {
  const wordCount = countWords(text);
  const isOverLimit = wordCount > max;

  return (
    <span className={cn('text-xs', isOverLimit && 'text-destructive font-medium')}>
      {wordCount}/{max} words
    </span>
  );
}

export function WritingSampleResponsePanel({
  date,
  htmlIdPrefix,
  onChangeDate,
  onChangeResponse,
  onChangeShowToStudents,
  onChangeTiming,
  sampleResponse,
  sampleTiming,
  sampleTimingOptions,
  showToStudents,
}: WritingSampleResponsePanelProps) {
  const hasSample = Boolean(sampleResponse);
  const hasWords = countWords(sampleResponse) > 0;

  return (
    <Collapsible className="mt-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full items-center justify-between p-2 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Sample Response</span>
            {hasSample && (
              <Badge variant="secondary" className="text-xs">
                Added
              </Badge>
            )}
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-2 pt-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${htmlIdPrefix}-sample-response`}>Model Answer</Label>
            <WordCountDisplay text={sampleResponse} max={1000} />
          </div>
          <RichTextEditor
            value={sampleResponse || ''}
            onChange={onChangeResponse}
            placeholder="Enter a model answer that demonstrates what a good response looks like..."
          />
          {!isWithinWordLimit(sampleResponse) && (
            <p className="text-xs text-destructive">Sample response exceeds 1000 word limit</p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor={`${htmlIdPrefix}-show-sample`} className="text-sm">
              Show to Students
            </Label>
            <p className="text-xs text-muted-foreground">
              Students can view this sample response
            </p>
          </div>
          <Switch
            id={`${htmlIdPrefix}-show-sample`}
            checked={showToStudents || false}
            onCheckedChange={onChangeShowToStudents}
            disabled={!sampleResponse || !hasWords}
          />
        </div>

        {showToStudents && (
          <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="space-y-2">
              <Label>When should students see this?</Label>
              <Select value={sampleTiming || 'immediate'} onValueChange={onChangeTiming}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sampleTimingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sampleTiming === 'specific_date' && (
              <div className="space-y-2">
                <Label>Select date and time</Label>
                <Input
                  type="datetime-local"
                  value={date || ''}
                  onChange={(event) => onChangeDate(event.target.value)}
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
  );
}
