/**
 * Location: features/assignments/components/ielts/StringListEditor.tsx
 * Purpose: Provide a compact editor for ordered string lists.
 * Why: Reuses the same UI for speaking questions, cue-card bullets, and options.
 */

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { cn } from '@components/ui/utils';

type StringListEditorProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  dense?: boolean;
};

export function StringListEditor({
  label,
  values,
  onChange,
  placeholder,
  addLabel = 'Add item',
  dense = false,
}: StringListEditorProps) {
  const handleUpdate = (index: number, nextValue: string) => {
    const next = values.map((item, idx) => (idx === index ? nextValue : item));
    onChange(next);
  };

  const handleRemove = (index: number) => {
    const next = values.filter((_, idx) => idx !== index);
    onChange(next.length ? next : ['']);
  };

  const handleAdd = () => {
    onChange([...values, '']);
  };

  return (
    <div className="space-y-3">
      <div className={cn('text-sm font-medium', dense && 'text-xs uppercase tracking-wide')}>
        {label}
      </div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <Input
              value={value}
              placeholder={placeholder}
              onChange={(event) => handleUpdate(index, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              className="shrink-0"
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-2 size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
