/**
 * Location: features/assignments/components/ielts/authoring/IeltsTypeSelection.tsx
 * Purpose: Render the IELTS assignment type selection grid using backend-driven metadata.
 * Why: Removes hardcoded card text/icons/themes and keeps the screen configurable.
 */

import { Card, CardContent } from '@components/ui/card';
import { cn } from '@components/ui/utils';
import {
  getIeltsTypeMetadataFallback,
  useIeltsTypeMetadata,
} from '@features/ielts-config/typeMetadata.api';
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
  const { data } = useIeltsTypeMetadata();
  const typeCards = data ?? getIeltsTypeMetadataFallback();

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
          <Card
            key={type.id}
            className={cn('cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2')}
            style={buildTypeCardBackgroundStyle(type.theme)}
            onClick={() => onSelect(type.id)}
          >
            <CardContent className="p-8 text-center">
              <div className="mb-4 flex justify-center">
                <Icon className="size-8" style={buildTypeIconStyle(type.theme)} />
              </div>
              <h3 className="mb-2">{type.title}</h3>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
