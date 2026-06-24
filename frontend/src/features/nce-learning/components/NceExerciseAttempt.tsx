/**
 * Location: features/nce-learning/components/NceExerciseAttempt.tsx
 * Purpose: Render a student answer control for one NCE exercise.
 * Why: Students need consistent draft and submit controls for exercise attempts.
 */

import type { NceExercise } from '@features/nce-content/types';
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
    .filter(([key]) => key !== 'audioKey')
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

const stringValueFromResponse = (response: NceAttemptResponse) => {
  const value = response.answer ?? response.text ?? response.value;
  return typeof value === 'string' ? value : '';
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

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        Audio
      </p>
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
  const matches = matchesFromResponse(response);
  const hasResponseContent = matchingContent
    ? Object.values(matches).some((value) => value.trim().length > 0)
    : answer.trim().length > 0;

  const setMatch = (term: string, value: string) => {
    onResponseChange({
      ...response,
      matches: {
        ...matches,
        [term]: value,
      },
    });
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
          disabled={submitted || isSaving || !hasResponseContent}
        >
          {isSaving ? 'Saving' : 'Save draft'}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitted || isSubmitting || !hasResponseContent}
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
