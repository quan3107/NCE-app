/**
 * Location: features/assignments/components/ielts/authoring/IeltsTypeSelection.tsx
 * Purpose: Render the IELTS assignment type selection grid using backend-driven metadata.
 * Why: Removes hardcoded card text/icons/themes and keeps the screen configurable.
 */

import { Card, CardContent } from '@components/ui/card';
import { useIeltsTypeMetadata } from '@features/ielts-config/typeMetadata.api';
import type { IeltsAssignmentType } from '@lib/ielts';

import {
  buildTypeCardBackgroundStyle,
  buildTypeIconStyle,
  resolveTypeIcon,
} from '../typeMetadata.ui';

type IeltsTypeSelectionProps = {
  onSelect: (value: IeltsAssignmentType) => void;
};

export function IeltsTypeSelection({ onSelect }: IeltsTypeSelectionProps) {
  const { data, error, isLoading } = useIeltsTypeMetadata();
  const typeCards = data ?? [];

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Loading IELTS assignment types...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto border-destructive/30">
        <CardContent className="p-8 text-center text-sm">
          <p className="font-medium text-destructive">Unable to load IELTS assignment types.</p>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (typeCards.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No IELTS assignment types are currently available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {typeCards.map((type) => {
        const Icon = resolveTypeIcon(type.icon);

        return (
          <button
            key={type.id}
            type="button"
            aria-label={type.title}
            className="rounded-xl text-card-foreground cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={buildTypeCardBackgroundStyle(type.theme)}
            onClick={() => onSelect(type.id)}
          >
            <span className="block p-8 text-center">
              <span className="mb-4 flex justify-center">
                <Icon className="size-8" style={buildTypeIconStyle(type.theme)} />
              </span>
              <span className="block mb-2 font-semibold">{type.title}</span>
              <span className="block text-sm text-muted-foreground">{type.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
