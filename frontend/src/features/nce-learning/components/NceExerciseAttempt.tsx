/**
 * Location: features/nce-learning/components/NceExerciseAttempt.tsx
 * Purpose: Render a student answer control for one NCE exercise.
 * Why: Students need consistent draft and submit controls for exercise attempts.
 */

import type { NceExercise } from '@features/nce-content/types';
import { RefreshCw } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { useNceAssetContentQuery } from '../api';
import type { NceAttempt, NceAttemptResponse } from '../types';

type Props = {
  courseId: string;
  exercise: NceExercise;
  response: NceAttemptResponse;
  attempt: NceAttempt | null;
  isSaving: boolean;
  isSubmitting: boolean;
  onResponseChange: (response: NceAttemptResponse) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
};

type ContentItem = {
  label: string;
  values: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const formatContentLabel = (key: string) => {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
};

const stringifyContentValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isRecord(value)) {
    return JSON.stringify(value);
  }

  return null;
};

const toContentValues = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map(stringifyContentValue)
      .filter((item): item is string => Boolean(item));
  }

  const displayValue = stringifyContentValue(value);
  return displayValue ? [displayValue] : [];
};

const getContentItems = (content: unknown): ContentItem[] => {
  if (!isRecord(content)) {
    return [];
  }

  return Object.entries(content)
    .filter(([key]) => key !== 'audioKey' && key !== 'blanks')
    .map(([key, value]) => ({
      label: formatContentLabel(key),
      values: toContentValues(value),
    }))
    .filter((item) => item.values.length > 0);
};

const getAudioKey = (content: unknown) => {
  if (!isRecord(content) || typeof content.audioKey !== 'string') {
    return null;
  }

  const key = content.audioKey.trim();
  return key.length > 0 ? key : null;
};

const getStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const getMatchingContent = (content: unknown) => {
  if (!isRecord(content)) {
    return null;
  }

  const terms = getStringArray(content.terms);
  const choices = getStringArray(content.choices);
  if (terms.length === 0 || choices.length === 0) {
    return null;
  }

  return { terms, choices };
};

const getChoiceContent = (content: unknown) => {
  if (!isRecord(content)) {
    return null;
  }

  const choices = getStringArray(content.choices);
  return choices.length > 0 ? choices : null;
};

const stringValueFromResponse = (response: NceAttemptResponse) => {
  const value = response.answer ?? response.text ?? response.value;
  return typeof value === 'string' ? value : '';
};

const countBlankPlaceholders = (value: unknown) => {
  if (typeof value !== 'string') {
    return 0;
  }

  return value.match(/_{2,}/g)?.length ?? 0;
};

const getGapFillBlankCount = (content: unknown) => {
  if (!isRecord(content)) {
    return 0;
  }

  const contentBlanks = getStringArray(content.blanks).filter(
    (blank) => blank.trim().length > 0,
  );
  if (contentBlanks.length > 0) {
    return contentBlanks.length;
  }

  return countBlankPlaceholders(content.sentence);
};

const blanksFromResponse = (
  response: NceAttemptResponse,
  blankCount: number,
) => {
  const blanks = Array.isArray(response.blanks) ? response.blanks : [];

  return Array.from({ length: blankCount }, (_, index) => {
    const value = blanks[index];
    return typeof value === 'string' ? value : '';
  });
};

const matchesFromResponse = (response: NceAttemptResponse) => {
  if (!isRecord(response.matches)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(response.matches).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

function NceExerciseAudio({
  courseId,
  audioKey,
}: {
  courseId: string;
  audioKey: string;
}) {
  const contentQuery = useNceAssetContentQuery(courseId, audioKey);
  const refreshAudioUrl = () => {
    void contentQuery.refetch();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          Audio
        </p>
        {contentQuery.data && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Refresh audio"
            title="Refresh audio"
            onClick={refreshAudioUrl}
            disabled={contentQuery.isFetching}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {contentQuery.data ? (
        <audio
          controls
          src={contentQuery.data.url}
          aria-label="Exercise audio"
          className="w-full"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {contentQuery.isError ? 'Audio is unavailable.' : 'Loading audio...'}
        </p>
      )}
    </div>
  );
}

export function NceExerciseAttempt({
  courseId,
  exercise,
  response,
  attempt,
  isSaving,
  isSubmitting,
  onResponseChange,
  onSaveDraft,
  onSubmit,
}: Props) {
  const submitted = attempt?.status === 'submitted';
  const scoreText =
    submitted && attempt.score !== null && attempt.maxScore !== null
      ? `Score: ${attempt.score}/${attempt.maxScore}`
      : null;
  const contentItems = getContentItems(exercise.content);
  const audioKey = getAudioKey(exercise.content);
  const matchingContent = getMatchingContent(exercise.content);
  const answer = stringValueFromResponse(response);
  const blankCount = getGapFillBlankCount(exercise.content);
  const isMultiBlankGapFill = exercise.exerciseType === 'gap_fill' && blankCount > 1;
  const choiceContent =
    matchingContent || isMultiBlankGapFill ? null : getChoiceContent(exercise.content);
  const blanks = blanksFromResponse(response, blankCount);
  const matches = matchesFromResponse(response);
  let hasResponseContent = answer.trim().length > 0;
  if (matchingContent) {
    hasResponseContent = Object.values(matches).some((value) => value.trim().length > 0);
  } else if (isMultiBlankGapFill) {
    hasResponseContent = blanks.some((value) => value.trim().length > 0);
  }

  const setMatch = (term: string, value: string) => {
    onResponseChange({
      ...response,
      matches: {
        ...matches,
        [term]: value,
      },
    });
  };

  const setBlank = (index: number, value: string) => {
    const nextBlanks = blanks.map((blank, blankIndex) =>
      blankIndex === index ? value : blank,
    );
    const nextResponse: NceAttemptResponse = { ...response, blanks: nextBlanks };
    delete nextResponse.answer;
    delete nextResponse.text;
    delete nextResponse.value;
    onResponseChange(nextResponse);
  };

  return (
    <div className="rounded-lg border bg-card/70 p-4 space-y-4">
      <div className="space-y-1">
        <p className="font-medium">{exercise.prompt}</p>
        <p className="text-xs uppercase tracking-normal text-muted-foreground">
          {exercise.exerciseType.replace(/_/g, ' ')}
        </p>
      </div>

      {contentItems.length > 0 && (
        <div
          className="space-y-3 rounded-lg border border-dashed bg-background/70 p-3"
          aria-label="Exercise material"
        >
          {contentItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                {item.label}
              </p>
              {item.values.length === 1 ? (
                <p className="text-sm leading-6">{item.values[0]}</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                  {item.values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {audioKey && (
        <div className="rounded-lg border border-dashed bg-background/70 p-3">
          <NceExerciseAudio courseId={courseId} audioKey={audioKey} />
        </div>
      )}

      {matchingContent ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {matchingContent.terms.map((term) => (
            <div key={term} className="space-y-2">
              <Label htmlFor={`nce-match-${exercise.id}-${term}`}>
                Match {term}
              </Label>
              <select
                id={`nce-match-${exercise.id}-${term}`}
                value={matches[term] ?? ''}
                onChange={(event) => setMatch(term, event.target.value)}
                disabled={submitted}
                className="border-input bg-input-background focus-visible:border-primary/50 focus-visible:ring-primary/15 h-10 w-full rounded-[8px] border px-3 py-2 text-sm outline-none focus-visible:bg-card focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a match</option>
                {matchingContent.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : choiceContent ? (
        <div className="space-y-2">
          <Label htmlFor={`nce-answer-${exercise.id}`}>
            Answer for {exercise.prompt}
          </Label>
          <select
            id={`nce-answer-${exercise.id}`}
            value={answer}
            onChange={(event) =>
              onResponseChange({ ...response, answer: event.target.value })
            }
            disabled={submitted}
            className="border-input bg-input-background focus-visible:border-primary/50 focus-visible:ring-primary/15 h-10 w-full rounded-[8px] border px-3 py-2 text-sm outline-none focus-visible:bg-card focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select an answer</option>
            {choiceContent.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </div>
      ) : isMultiBlankGapFill ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {blanks.map((blank, index) => (
            <div key={`${exercise.id}-blank-${index}`} className="space-y-2">
              <Label htmlFor={`nce-blank-${exercise.id}-${index}`}>
                Blank {index + 1} for {exercise.prompt}
              </Label>
              <Textarea
                id={`nce-blank-${exercise.id}-${index}`}
                value={blank}
                onChange={(event) => setBlank(index, event.target.value)}
                disabled={submitted}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`nce-answer-${exercise.id}`}>
            Answer for {exercise.prompt}
          </Label>
          <Textarea
            id={`nce-answer-${exercise.id}`}
            value={answer}
            onChange={(event) =>
              onResponseChange({ ...response, answer: event.target.value })
            }
            disabled={submitted}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={submitted || isSaving || isSubmitting || !hasResponseContent}
        >
          {isSaving ? 'Saving' : 'Save draft'}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitted || isSaving || isSubmitting || !hasResponseContent}
        >
          {isSubmitting ? 'Submitting' : 'Submit attempt'}
        </Button>
        {attempt?.status === 'draft' && (
          <span className="text-sm text-muted-foreground">Draft saved</span>
        )}
        {scoreText && (
          <span className="text-sm font-medium text-foreground">{scoreText}</span>
        )}
        {submitted && !scoreText && (
          <span className="text-sm text-muted-foreground">Submitted for review</span>
        )}
      </div>
    </div>
  );
}
