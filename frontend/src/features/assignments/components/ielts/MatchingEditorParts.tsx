/**
 * Location: features/assignments/components/ielts/MatchingEditorParts.tsx
 * Purpose: Render individual matching statements and droppable option cards.
 * Why: Keeps MatchingEditor focused on drag/drop orchestration and state updates.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, X } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import type { MatchingItem, MatchingOption } from '@lib/ielts';

export function SortableMatchingItem({
  item,
  matchedOption,
  onStatementChange,
  onRemove,
}: {
  item: MatchingItem;
  matchedOption: MatchingOption | null;
  onStatementChange: (statement: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { type: 'item', item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border"
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-2">
        <Input
          value={item.statement}
          onChange={(e) => onStatementChange(e.target.value)}
          placeholder="Enter statement..."
          className="text-sm"
        />
        {matchedOption ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Matched with:</span>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
              {matchedOption.label}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Drag to an option to match
          </span>
        )}
      </div>
      <Button variant="ghost" size="icon" className="size-8" onClick={onRemove}>
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

export function DroppableOption({
  option,
  matchedItems,
  onLabelChange,
  onRemove,
  onUnmatch,
}: {
  option: MatchingOption;
  matchedItems: MatchingItem[];
  onLabelChange: (label: string) => void;
  onRemove: () => void;
  onUnmatch: (itemId: string) => void;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: option.id,
    data: { type: 'option', option },
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 rounded-lg border-2 transition-colors ${
        isOver ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Input
          value={option.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Label (e.g., A, B, C...)"
          className="w-24 text-sm font-medium"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 ml-auto"
          onClick={onRemove}
        >
          <X className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="space-y-1 min-h-[40px]">
        {matchedItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Drop items here
          </p>
        ) : (
          matchedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 bg-background rounded border text-xs"
            >
              <span className="truncate flex-1">{item.statement || 'Empty statement'}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => onUnmatch(item.id)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
