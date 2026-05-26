/**
 * Location: features/assignments/components/ielts/MatchingEditor.tsx
 * Purpose: Drag-and-drop matching editor for IELTS matching question types.
 * Why: Provides intuitive UI for creating matching_headings, matching_information, etc.
 */

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import type { MatchingItem, MatchingOption } from '@lib/ielts';
import { DroppableOption, SortableMatchingItem } from './MatchingEditorParts';

type MatchingEditorProps = {
  items: MatchingItem[];
  options: MatchingOption[];
  onChange: (items: MatchingItem[], options: MatchingOption[]) => void;
};

export function MatchingEditor({ items, options, onChange }: MatchingEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Only allow dropping items onto options
    if (activeData?.type === 'item' && overData?.type === 'option') {
      const itemId = active.id as string;
      const optionId = over.id as string;

      // Update the item's matchId
      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, matchId: optionId } : item
      );
      onChange(updatedItems, options);
    }
  };

  const addItem = () => {
    const newItem: MatchingItem = {
      id: crypto.randomUUID(),
      statement: '',
      matchId: null,
    };
    onChange([...items, newItem], options);
  };

  const addOption = () => {
    const nextLabel = String.fromCharCode(65 + options.length); // A, B, C, D...
    const newOption: MatchingOption = {
      id: crypto.randomUUID(),
      label: options.length >= 26 ? `Option ${options.length + 1}` : nextLabel,
    };
    onChange(items, [...options, newOption]);
  };

  const updateItemStatement = (id: string, statement: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, statement } : item
    );
    onChange(updatedItems, options);
  };

  const updateOptionLabel = (id: string, label: string) => {
    const updatedOptions = options.map((option) =>
      option.id === id ? { ...option, label } : option
    );
    onChange(items, updatedOptions);
  };

  const removeItem = (id: string) => {
    if (items.length <= 2) return; // Minimum 2 items
    const updatedItems = items.filter((item) => item.id !== id);
    onChange(updatedItems, options);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return; // Minimum 2 options
    // Also unmatch any items matched to this option
    const updatedItems = items.map((item) =>
      item.matchId === id ? { ...item, matchId: null } : item
    );
    const updatedOptions = options.filter((option) => option.id !== id);
    onChange(updatedItems, updatedOptions);
  };

  const unmatchItem = (itemId: string) => {
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, matchId: null } : item
    );
    onChange(updatedItems, options);
  };

  const getMatchedOption = (item: MatchingItem) => {
    if (!item.matchId) return null;
    return options.find((opt) => opt.id === item.matchId) || null;
  };

  const getMatchedItems = (optionId: string) => {
    return items.filter((item) => item.matchId === optionId);
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left side - Statements */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Statements to Match</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="size-4 mr-1" />
                Add
              </Button>
            </div>

            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <SortableMatchingItem
                    key={item.id}
                    item={item}
                    matchedOption={getMatchedOption(item)}
                    onStatementChange={(statement) =>
                      updateItemStatement(item.id, statement)
                    }
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          {/* Right side - Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Options</Label>
              <Button variant="outline" size="sm" onClick={addOption}>
                <Plus className="size-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {options.map((option) => (
                <DroppableOption
                  key={option.id}
                  option={option}
                  matchedItems={getMatchedItems(option.id)}
                  onLabelChange={(label) => updateOptionLabel(option.id, label)}
                  onRemove={() => removeOption(option.id)}
                  onUnmatch={unmatchItem}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <p className="font-medium mb-1">How to use:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Enter statements on the left</li>
            <li>Enter option labels on the right (A, B, C...)</li>
            <li>Drag statements from left to right to create matches</li>
            <li>Click X on a matched item to unmatch it</li>
          </ul>
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="p-3 bg-background rounded-lg border shadow-lg opacity-80">
            <p className="text-sm truncate">
              {activeItem.statement || 'Empty statement'}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
