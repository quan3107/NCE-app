/**
 * Location: features/nce-content/components/NceObjectiveEditor.tsx
 * Purpose: Edit one NCE lesson objective.
 * Why: Keeps objective fields reusable between create and edit lesson screens.
 */

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Trash2 } from 'lucide-react';
import type { NceObjectiveInput } from '../types';

type Props = {
  index: number;
  value: NceObjectiveInput;
  onChange: (nextValue: NceObjectiveInput) => void;
  onRemove: () => void;
};

export function NceObjectiveEditor({ index, value, onChange, onRemove }: Props) {
  const update = <Key extends keyof NceObjectiveInput>(
    key: Key,
    nextValue: NceObjectiveInput[Key],
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Objective {index + 1}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove objective">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`objective-code-${index}`}>Code</Label>
          <Input
            id={`objective-code-${index}`}
            value={value.code}
            onChange={(event) => update('code', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`objective-title-${index}`}>Title</Label>
          <Input
            id={`objective-title-${index}`}
            value={value.title}
            onChange={(event) => update('title', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`objective-category-${index}`}>Category</Label>
          <Input
            id={`objective-category-${index}`}
            value={value.category}
            onChange={(event) => update('category', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`objective-threshold-${index}`}>Mastery Threshold</Label>
          <Input
            id={`objective-threshold-${index}`}
            type="number"
            min={1}
            max={100}
            value={value.masteryThreshold}
            onChange={(event) => update('masteryThreshold', Number(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`objective-order-${index}`}>Sort Order</Label>
          <Input
            id={`objective-order-${index}`}
            type="number"
            min={0}
            value={value.sortOrder}
            onChange={(event) => update('sortOrder', Number(event.target.value))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`objective-description-${index}`}>Description</Label>
        <Textarea
          id={`objective-description-${index}`}
          value={value.description ?? ''}
          onChange={(event) => update('description', event.target.value)}
        />
      </div>
    </div>
  );
}
