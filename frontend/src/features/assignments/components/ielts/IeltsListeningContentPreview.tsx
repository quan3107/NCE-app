/**
 * Location: features/assignments/components/ielts/IeltsListeningContentPreview.tsx
 * Purpose: Render IELTS listening sections with transcript and questions.
 * Why: Gives teachers a full preview of each listening section.
 */

import type { IeltsListeningConfig } from '@lib/ielts';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { EmptyState, QuestionList } from './IeltsPreviewShared';

type IeltsListeningContentPreviewProps = {
  value: IeltsListeningConfig;
};

export function IeltsListeningContentPreview({ value }: IeltsListeningContentPreviewProps) {
  const sections = value.sections ?? [];

  if (sections.length === 0) {
    return <EmptyState label="No listening sections yet." />;
  }

  return (
    <Tabs defaultValue={sections[0]?.id ?? 'section-0'}>
      <TabsList className="flex flex-wrap gap-2 bg-muted/30 p-2 rounded-[12px]">
        {sections.map((section, index) => (
          <TabsTrigger
            key={section.id}
            value={section.id}
            className="tabs-pill"
          >
            {`Section ${index + 1}`}
          </TabsTrigger>
        ))}
      </TabsList>

      {sections.map((section, index) => (
        <TabsContent key={section.id} value={section.id} className="space-y-6">
          <Card className="rounded-[14px]">
            <CardHeader>
              <CardTitle>{section.title || `Section ${index + 1}`}</CardTitle>
              <CardDescription>
                {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {section.audioFileId ? 'Audio attached' : 'No audio file'}
                </Badge>
                {section.playback?.limitPlays && (
                  <Badge variant="outline">Plays: {section.playback.limitPlays}</Badge>
                )}
              </div>
              {section.transcript && (
                <div className="rounded-[12px] bg-muted/20 p-4 text-sm whitespace-pre-wrap">
                  {section.transcript}
                </div>
              )}
              <QuestionList questions={section.questions} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
