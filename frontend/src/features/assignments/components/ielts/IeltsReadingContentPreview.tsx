/**
 * Location: features/assignments/components/ielts/IeltsReadingContentPreview.tsx
 * Purpose: Render IELTS reading passages aligned to Figma design.
 * Why: Matches Figma layout with simple passage buttons, Questions header with badge,
 *      and styled question groups with colored headers.
 */

import { useMemo, useState } from 'react';
import type { IeltsReadingConfig, IeltsQuestion } from '@lib/ielts';
import { Badge } from '@components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { getQuestionTypeLabel } from './IeltsPreviewShared';

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
    return (
      <div className="rounded-[14px] border bg-card p-6 text-center text-muted-foreground">
        No reading passages yet.
      </div>
    );
  }

  return (
    <Tabs defaultValue={sections[0]?.id ?? 'passage-0'}>
      <div className="rounded-[14px] border bg-card overflow-hidden">
        {/* Header with passage toggles - matching Figma */}
        <div className="flex-none p-3 border-b bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Reading Text:</span>
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-0 rounded-none">
              {sections.map((section, index) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="tabs-pill !px-3"
                >
                  Passage {index + 1}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <Badge variant="outline" className="text-xs">Preview Mode</Badge>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {sections.map((section, index) => (
            <TabsContent key={section.id} value={section.id} className="mt-0">
              <ReadingSectionContent
                title={section.title || `Passage ${index + 1}`}
                passage={section.passage}
                questions={section.questions}
                startIndex={ranges[index]?.start ?? 1}
                endIndex={ranges[index]?.end ?? ranges[index]?.start ?? 1}
                totalQuestions={totalQuestions}
              />
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  );
}

function ReadingSectionContent({
  title,
  passage,
  questions,
  startIndex,
  endIndex,
}: {
  title: string;
  passage: string;
  questions: ReadingQuestion[];
  startIndex: number;
  endIndex: number;
  totalQuestions: number;
}) {
  const groups = useMemo(() => groupQuestionsByType(questions), [questions]);
  const questionRangeLabel = questions.length > 0 ? `Questions ${startIndex}-${endIndex}` : '';

  return (
    <div className="grid lg:grid-cols-2 divide-x reading-panels-container">
      {/* Left column - Reading passage */}
      <div className="flex flex-col overflow-hidden bg-muted/5 reading-panels-container-child">
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-visible">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <div className="rounded-[10px] bg-muted/20 p-5 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {passage || 'No passage text yet.'}
            </div>
          </div>
        </div>
      </div>

      {/* Right column - Questions */}
      <div className="flex flex-col overflow-hidden bg-background reading-panels-container-child">
        {/* Questions header with badge - matching Figma */}
        <div className="flex-none p-4 border-b bg-muted/5 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Questions</h3>
          {questionRangeLabel && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-md bg-muted text-muted-foreground">
              {questionRangeLabel}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-visible">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No questions yet.</p>
          ) : (
            <div className="space-y-6">
              <QuestionGroups groups={groups} startIndex={startIndex} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionGroups({
  groups,
  startIndex,
}: {
  groups: QuestionGroup[];
  startIndex: number;
}) {
  let cursor = startIndex;

  return (
    <>
      {groups.map((group, groupIndex) => {
        const groupStart = cursor;
        const groupEnd = cursor + group.questions.length - 1;
        cursor = groupEnd + 1;

        const questionRangeText =
          groupStart === groupEnd
            ? `Question ${groupStart}`
            : `Questions ${groupStart}-${groupEnd}`;

        return (
          <div
            key={`${group.type}-${groupIndex}`}
            className={groupIndex > 0 ? 'pt-6 border-t border-border' : ''}
          >
            {/* Question type header - matching Figma with orange/red color */}
            <div className="space-y-1 mb-4">
              <p className="text-sm font-semibold text-orange-600">
                {questionRangeText}: {getQuestionTypeLabel(group.type)}
              </p>
              <p className="text-xs text-muted-foreground">
                Choose the correct letter, A, B, C or D.
              </p>
            </div>

            {/* Questions list */}
            <div className="space-y-3">
              {group.questions.map((question, qIndex) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  questionNumber={groupStart + qIndex}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function QuestionCard({
  question,
  questionNumber,
}: {
  question: ReadingQuestion;
  questionNumber: number;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  return (
    <div className="rounded-[10px] bg-muted/30 p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">
        {questionNumber}. {question.prompt || 'Untitled question'}
      </p>

      {question.options && question.options.length > 0 ? (
        <div className="space-y-2">
          {question.options.map((option, optionIndex) => {
            const prefix = String.fromCharCode(65 + optionIndex); // A, B, C, D
            const isSelected = selectedOption === `${optionIndex}`;

            return (
              <button
                key={`${question.id}-option-${optionIndex}`}
                onClick={() => setSelectedOption(`${optionIndex}`)}
                className={`w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 text-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted/50'
                }`}
              >
                <span className="font-medium shrink-0">{prefix}.</span>
                <span>{option?.trim() || `Option ${optionIndex + 1}`}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No answer options provided.</p>
      )}

      {question.correctAnswer && (
        <p className="text-xs text-muted-foreground mt-2">Answer: {question.correctAnswer}</p>
      )}
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
