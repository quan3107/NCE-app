/**
 * Location: features/assignments/components/ielts/authoring/SortablePassageCard.tsx
 * Purpose: Draggable passage card for Reading form reordering.
 * Why: Provides intuitive drag-and-drop for reordering passages.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { cn } from '@components/ui/utils';

interface SortablePassageCardProps {
  id: string;
  index: number;
  title: string;
  questionCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function SortablePassageCard({
  id,
  index,
  title,
  questionCount,
  isExpanded,
  onToggle,
  children,
}: SortablePassageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-2',
        isDragging && 'border-primary shadow-lg'
      )}
    >
      <CardHeader
        className="cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
            >
              <GripVertical className="size-4 text-muted-foreground" />
            </Button>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {questionCount} questions
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">{children}</CardContent>
      )}
    </Card>
  );
}
