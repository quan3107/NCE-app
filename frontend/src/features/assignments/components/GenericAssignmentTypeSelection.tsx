/**
 * Location: features/assignments/components/GenericAssignmentTypeSelection.tsx
 * Purpose: Present the supported generic assignment response types.
 * Why: Teachers need a clear entry point for text, link, and file workflows.
 */
import { FileUp, Link, TextCursorInput } from 'lucide-react';

import { Card, CardContent } from '@components/ui/card';
import { cn } from '@components/ui/utils';

export type GenericAssignmentType = 'file' | 'link' | 'text';

const genericTypes: Array<{
  type: GenericAssignmentType;
  title: string;
  description: string;
  icon: typeof FileUp;
}> = [
  {
    type: 'text',
    title: 'Text Response',
    description: 'Students write and submit a response in the app.',
    icon: TextCursorInput,
  },
  {
    type: 'link',
    title: 'Link Response',
    description: 'Students submit a validated web link.',
    icon: Link,
  },
  {
    type: 'file',
    title: 'File Upload',
    description: 'Students upload one or more policy-compliant files.',
    icon: FileUp,
  },
];

export function GenericAssignmentTypeSelection({ onSelect }: { onSelect: (type: GenericAssignmentType) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {genericTypes.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.type} type="button" className="text-left" onClick={() => onSelect(item.type)}>
            <Card
              className={cn(
                'h-full transition-colors',
                'hover:border-primary hover:bg-primary/5 focus-within:border-primary',
              )}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
