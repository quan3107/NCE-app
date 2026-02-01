/**
 * Location: features/assignments/components/ielts/IeltsSpeakingContentPreview.tsx
 * Purpose: Render IELTS speaking parts with cue card and question lists.
 * Why: Gives teachers a full preview of speaking prompts and timing.
 */

import type { IeltsSpeakingConfig } from '@lib/ielts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { BulletList, InfoTile } from './IeltsPreviewShared';

export function IeltsSpeakingContentPreview({ value }: { value: IeltsSpeakingConfig }) {
  return (
    <div className="space-y-6">
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Part 1</CardTitle>
          <CardDescription>Introduction and interview questions</CardDescription>
        </CardHeader>
        <CardContent>
          <BulletList items={value.part1.questions} emptyLabel="No Part 1 questions yet." />
        </CardContent>
      </Card>
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Part 2</CardTitle>
          <CardDescription>Cue card and preparation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[12px] bg-muted/20 p-4 text-sm">
            <p className="font-medium mb-2">Topic</p>
            <p className="text-sm text-foreground">
              {value.part2.cueCard.topic || 'No topic yet.'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoTile label="Prep Time" value={`${value.part2.prepSeconds} sec`} />
            <InfoTile label="Talk Time" value={`${value.part2.talkSeconds} sec`} />
          </div>
          <BulletList
            items={value.part2.cueCard.bulletPoints}
            emptyLabel="No cue card bullet points yet."
          />
        </CardContent>
      </Card>
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Part 3</CardTitle>
          <CardDescription>Discussion questions</CardDescription>
        </CardHeader>
        <CardContent>
          <BulletList items={value.part3.questions} emptyLabel="No Part 3 questions yet." />
        </CardContent>
      </Card>
    </div>
  );
}
