/**
 * Location: features/assignments/components/ielts/IeltsTypeCards.tsx
 * Purpose: Render the IELTS skill type selector as a card grid.
 * Why: Matches PRD requirement for a visual 4-skill selector and improves scanability.
 */

import { BookOpenText, Headphones, Mic2, PenLine } from 'lucide-react';

import { Card } from '@components/ui/card';
import { cn } from '@components/ui/utils';
import type { IeltsAssignmentType } from '@lib/ielts';

type IeltsTypeCardsProps = {
  value: IeltsAssignmentType | null;
  onChange: (value: IeltsAssignmentType) => void;
};

const IELTS_TYPES: Array<{
  value: IeltsAssignmentType;
  label: string;
  description: string;
  icon: typeof BookOpenText;
}> = [
  {
    value: 'reading',
    label: 'Reading',
    description: 'Passage-based questions and answer keys.',
    icon: BookOpenText,
  },
  {
    value: 'listening',
    label: 'Listening',
    description: 'Audio sections with playback control.',
    icon: Headphones,
  },
  {
    value: 'writing',
    label: 'Writing',
    description: 'Task 1 visuals + Task 2 essays.',
    icon: PenLine,
  },
  {
    value: 'speaking',
    label: 'Speaking',
    description: 'Part 1-3 prompts and cue cards.',
    icon: Mic2,
  },
];

export function IeltsTypeCards({ value, onChange }: IeltsTypeCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {IELTS_TYPES.map((item) => {
        const Icon = item.icon;
        const isActive = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className="text-left group"
            aria-pressed={isActive}
            aria-label={`${item.label}: ${item.description}`}
          >
            <Card
              className={cn(
                'p-5 transition-all duration-200 border-2',
                'hover:border-primary/60 hover:shadow-md hover:scale-[1.02]',
                isActive && 'border-primary/70 ring-2 ring-primary/40 shadow-md ielts-card-active',
                !isActive && 'border-border'
              )}
            >
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-10 items-center justify-center rounded-full border-2 bg-white text-muted-foreground transition-colors',
                    isActive && 'border-primary/50 text-primary bg-primary/5',
                    !isActive && 'group-hover:border-primary/30 group-hover:text-primary/70'
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <div className={cn(
                    "font-semibold text-base",
                    isActive && "text-primary"
                  )}>{item.label}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{item.description}</div>
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
