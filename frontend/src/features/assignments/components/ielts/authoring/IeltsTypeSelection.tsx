/**
 * Location: features/assignments/components/ielts/authoring/IeltsTypeSelection.tsx
 * Purpose: Render the IELTS assignment type selection grid per Figma design.
 * Why: Matches the dedicated selection screen before authoring details.
 */

import { BookOpen, Headphones, Mic, PenTool } from 'lucide-react';

import { Card, CardContent } from '@components/ui/card';
import type { IeltsAssignmentType } from '@lib/ielts';
import { cn } from '@components/ui/utils';

type TypeCard = {
  id: IeltsAssignmentType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
};

const typeCards: TypeCard[] = [
  {
    id: 'reading',
    title: 'Reading',
    description: 'Create a reading test with passages and questions',
    icon: <BookOpen className="size-8 text-blue-600" />,
    color: 'from-blue-50 to-blue-100',
    borderColor: 'border-blue-200',
  },
  {
    id: 'listening',
    title: 'Listening',
    description: 'Build a listening test with audio sections',
    icon: <Headphones className="size-8 text-purple-600" />,
    color: 'from-purple-50 to-purple-100',
    borderColor: 'border-purple-200',
  },
  {
    id: 'writing',
    title: 'Writing',
    description: 'Design Task 1 and Task 2 writing prompts',
    icon: <PenTool className="size-8 text-green-600" />,
    color: 'from-green-50 to-green-100',
    borderColor: 'border-green-200',
  },
  {
    id: 'speaking',
    title: 'Speaking',
    description: 'Set up speaking test with all three parts',
    icon: <Mic className="size-8 text-orange-600" />,
    color: 'from-orange-50 to-orange-100',
    borderColor: 'border-orange-200',
  },
];

type IeltsTypeSelectionProps = {
  onSelect: (value: IeltsAssignmentType) => void;
};

export function IeltsTypeSelection({ onSelect }: IeltsTypeSelectionProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {typeCards.map((type) => (
        <Card
          key={type.id}
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2',
            type.borderColor,
            `bg-gradient-to-br ${type.color}`,
          )}
          onClick={() => onSelect(type.id)}
        >
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">{type.icon}</div>
            <h3 className="mb-2">{type.title}</h3>
            <p className="text-sm text-muted-foreground">{type.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
