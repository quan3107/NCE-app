/**
 * Location: features/assignments/components/ielts/authoring/SortableSectionCard.tsx
 * Purpose: Draggable section card for Listening form reordering.
 * Why: Provides intuitive drag-and-drop for reordering listening sections.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { cn } from '@components/ui/utils';

interface SortableSectionCardProps {
  id: string;
  index: number;
  title: string;
  questionCount: number;
  children: React.ReactNode;
}

export function SortableSectionCard({
  id,
  index,
  title,
  questionCount,
  children,
}: SortableSectionCardProps) {
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
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4 text-muted-foreground" />
            </Button>
            <h4 className="font-medium">{title}</h4>
          </div>
          <Badge variant="secondary">{questionCount} questions</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
