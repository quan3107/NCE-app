/**
 * Location: features/assignments/components/ielts/IeltsTypeCards.tsx
 * Purpose: Render IELTS skill type cards using backend-driven metadata.
 * Why: Keeps assignment type copy/icons/theme configurable and aligned across teacher flows.
 */

import { Card } from '@components/ui/card';
import { cn } from '@components/ui/utils';
import {
  getIeltsTypeMetadataFallback,
  useIeltsTypeMetadata,
} from '@features/ielts-config/typeMetadata.api';
import type { IeltsAssignmentType } from '@lib/ielts';

import {
  resolveTypeIcon,
  resolveTypeTheme,
} from './typeMetadata.ui';

type IeltsTypeCardsProps = {
  value: IeltsAssignmentType | null;
  onChange: (value: IeltsAssignmentType) => void;
};

export function IeltsTypeCards({ value, onChange }: IeltsTypeCardsProps) {
  const { data } = useIeltsTypeMetadata();
  const types = data ?? getIeltsTypeMetadataFallback();

  if (types.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground border-dashed">
        No IELTS assignment types are currently available.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {types.map((item) => {
        const Icon = resolveTypeIcon(item.icon);
        const theme = resolveTypeTheme(item.theme);
        const isActive = value === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className="text-left group"
            aria-pressed={isActive}
            aria-label={`${item.title}: ${item.description}`}
          >
            <Card
              className={cn(
                'p-5 transition-all duration-200 border-2',
                'hover:shadow-md hover:scale-[1.02]',
                isActive && 'ring-2 ring-primary/40 shadow-md ielts-card-active',
              )}
              style={{ borderColor: isActive ? theme.borderColor : undefined }}
            >
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-10 items-center justify-center rounded-full border-2 bg-white transition-colors',
                  )}
                  style={{
                    borderColor: theme.borderColor,
                    color: theme.borderColor,
                    backgroundColor: isActive ? theme.colorFrom : '#FFFFFF',
                  }}
                >
                  <Icon className="size-5" />
                </span>
                <div className="space-y-1.5">
                  <div className={cn('font-semibold text-base', isActive && 'text-primary')}>
                    {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </div>
                </div>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
