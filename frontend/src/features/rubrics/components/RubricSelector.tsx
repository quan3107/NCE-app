/**
 * Location: features/rubrics/components/RubricSelector.tsx
 * Purpose: Reusable component to select a rubric from course rubrics
 * Why: Provides consistent rubric selection UI across the application
 */

import { useState } from 'react';
import { useCourseRubricsQuery } from '@features/rubrics/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Button } from '@components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { ChevronDown, BookOpen, Settings } from 'lucide-react';
import { cn } from '@components/ui/utils';

type RubricLevel = {
  label: string;
  points: number;
  desc: string;
};

type RubricCriterion = {
  criterion: string;
  weight: number;
  levels: RubricLevel[];
};

type Rubric = {
  id: string;
  courseId: string;
  name: string;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type RubricSelectorProps = {
  courseId: string;
  value: string | null | undefined;
  onChange: (rubricId: string | null) => void;
  label?: string;
  disabled?: boolean;
  onManageRubrics?: () => void;
};

export function RubricSelector({
  courseId,
  value,
  onChange,
  label = 'Rubric (Optional)',
  disabled = false,
  onManageRubrics,
}: RubricSelectorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const rubricsQuery = useCourseRubricsQuery(courseId);

  const selectedRubric = rubricsQuery.data?.find((r: Rubric) => r.id === value);

  const handleChange = (newValue: string) => {
    onChange(newValue === 'none' ? null : newValue);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {onManageRubrics && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={onManageRubrics}
          >
            <Settings className="mr-1 size-3" />
            Manage Rubrics
          </Button>
        )}
      </div>

      {rubricsQuery.isLoading ? (
        <div className="h-10 animate-pulse rounded-md bg-muted" />
      ) : rubricsQuery.error ? (
        <p className="text-sm text-destructive">Failed to load rubrics</p>
      ) : (
        <Select
          value={value || 'none'}
          onValueChange={handleChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a rubric..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {rubricsQuery.data?.map((rubric: Rubric) => (
              <SelectItem key={rubric.id} value={rubric.id}>
                {rubric.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedRubric && (
        <Collapsible open={showPreview} onOpenChange={setShowPreview}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex w-full items-center justify-between p-2 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-muted-foreground" />
                <span className="text-sm">Preview Rubric Criteria</span>
              </div>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  showPreview && 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{selectedRubric.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedRubric.criteria.map((criterion: RubricCriterion, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{criterion.criterion}</span>
                      <span className="text-xs text-muted-foreground">{criterion.weight}%</span>
                    </div>
                    <div className="space-y-1">
                      {criterion.levels.map((level: RubricLevel, levelIdx: number) => (
                        <div
                          key={levelIdx}
                          className="flex items-start gap-2 rounded bg-muted/50 p-2"
                        >
                          <span className="shrink-0 text-xs font-medium">{level.label}</span>
                          <span className="text-xs text-muted-foreground">({level.points} pts)</span>
                          <span className="text-xs">{level.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  Total Weight: {selectedRubric.criteria.reduce((sum: number, c: RubricCriterion) => sum + c.weight, 0)}%
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
