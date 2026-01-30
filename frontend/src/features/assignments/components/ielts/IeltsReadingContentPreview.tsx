/**
 * Location: features/assignments/components/ielts/IeltsReadingContentPreview.tsx
 * Purpose: Render IELTS reading passages with passage toggles and grouped questions.
 * Why: Mirrors the Figma reading layout with section headings by question type.
 */

import { useMemo } from 'react';
import type { IeltsReadingConfig } from '@lib/ielts';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { EmptyState, QuestionList, getQuestionTypeLabel } from './IeltsPreviewShared';

type IeltsReadingContentPreviewProps = {
  value: IeltsReadingConfig;
};

type ReadingQuestion = IeltsReadingConfig['sections'][number]['questions'][number];

type QuestionGroup = {
  type: ReadingQuestion['type'];
  questions: ReadingQuestion[];
};

export function IeltsReadingContentPreview({ value }: IeltsReadingContentPreviewProps) {
  const sections = value.sections ?? [];
  const totalQuestions = sections.reduce(
    (sum, section) => sum + (section.questions?.length ?? 0),
    0,
  );
  const ranges = useMemo(() => {
    let cursor = 1;
    return sections.map(section => {
      const start = cursor;
      const count = section.questions?.length ?? 0;
      const end = count > 0 ? cursor + count - 1 : null;
      cursor += count;
      return { start, end };
    });
  }, [sections]);

  if (sections.length === 0) {
    return <EmptyState label="No reading passages yet." />;
  }

  return (
    <Tabs defaultValue={sections[0]?.id ?? 'passage-0'}>
      <Card className="rounded-[14px]">
        <CardHeader>
          <CardTitle>Reading Test Overview</CardTitle>
          <CardDescription>
            {sections.length} passage{sections.length === 1 ? '' : 's'} with {totalQuestions}{' '}
            question{totalQuestions === 1 ? '' : 's'} total • {value.timing.durationMinutes}{' '}
            minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-[800px] flex flex-col border rounded-lg overflow-hidden bg-background">
            <div className="flex-none p-3 border-b bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Reading Text:</span>
                <TabsList className="flex flex-wrap gap-2 bg-transparent p-0 rounded-none">
                  {sections.map((section, index) => {
                    const range = ranges[index];
                    const label =
                      range?.end && range.start
                        ? `Passage ${index + 1} (Q${range.start}-${range.end})`
                        : `Passage ${index + 1}`;
                    return (
                      <TabsTrigger
                        key={section.id}
                        value={section.id}
                        className="tabs-pill"
                      >
                        {label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              <Badge variant="outline">Preview Mode</Badge>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              {sections.map((section, index) => (
                <TabsContent key={section.id} value={section.id} className="h-full">
                  <ReadingSectionContent
                    title={section.title || `Passage ${index + 1}`}
                    questionCount={section.questions.length}
                    passage={section.passage}
                    questions={section.questions}
                    startIndex={ranges[index]?.start ?? 1}
                  />
                </TabsContent>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </Tabs>
  );
}

function ReadingSectionContent({
  title,
  questionCount,
  passage,
  questions,
  startIndex,
}: {
  title: string;
  questionCount: number;
  passage: string;
  questions: ReadingQuestion[];
  startIndex: number;
}) {
  const groups = useMemo(() => groupQuestionsByType(questions), [questions]);
  let cursor = startIndex;
  const questionEnd = questionCount > 0 ? startIndex + questionCount - 1 : startIndex;
  const questionRangeLabel =
    questionCount > 0 ? `Questions ${startIndex}-${questionEnd}` : 'No questions';

  return (
    <div className="h-full grid lg:grid-cols-2 divide-x">
      <div className="flex flex-col h-full overflow-hidden min-h-0 bg-muted/5">
        <div className="flex-1 overflow-y-scroll min-h-0 p-6 lg:p-8">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">
                {questionCount} question{questionCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="rounded-[12px] bg-muted/20 p-4 text-sm text-foreground whitespace-pre-wrap">
                {passage || 'No passage text yet.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col h-full overflow-hidden min-h-0 bg-background">
        <div className="flex-none p-4 border-b bg-muted/5 flex items-center justify-between">
          <h3 className="font-semibold">Questions</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {questionRangeLabel}
          </span>
        </div>
        <div className="flex-1 overflow-y-scroll min-h-0 p-6 lg:p-8">
          {groups.length === 0 ? (
            <EmptyState label="No questions yet." />
          ) : (
            <div className="space-y-5">
              {groups.map((group, groupIndex) => {
                const groupStart = cursor;
                const groupEnd = cursor + group.questions.length - 1;
                cursor = groupEnd + 1;
                return (
                  <div
                    key={`${group.type}-${groupIndex}`}
                    className={
                      groupIndex === 0 ? 'space-y-3' : 'space-y-3 border-t border-border pt-4'
                    }
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {groupStart === groupEnd
                          ? `Question ${groupStart}: ${getQuestionTypeLabel(group.type)}`
                          : `Questions ${groupStart}-${groupEnd}: ${getQuestionTypeLabel(group.type)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Answer the following questions using the passage above.
                      </p>
                    </div>
                    <QuestionList questions={group.questions} startIndex={groupStart} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function groupQuestionsByType(questions: ReadingQuestion[]): QuestionGroup[] {
  return questions.reduce<QuestionGroup[]>((acc, question) => {
    const last = acc[acc.length - 1];
    if (last && last.type === question.type) {
      last.questions.push(question);
    } else {
      acc.push({ type: question.type, questions: [question] });
    }
    return acc;
  }, []);
}
