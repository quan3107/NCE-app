/**
 * Location: features/assignments/components/ielts/student/StudentIeltsAttemptForm.tsx
 * Purpose: Render student-facing IELTS attempt controls by assignment type.
 * Why: Lets students submit reading, listening, writing, and speaking IELTS payloads.
 */

import { useEffect, useState } from 'react';
import { AlertCircle, Clock, PenLine, Volume2 } from 'lucide-react';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';
import { Textarea } from '@components/ui/textarea';
import { getQuestionTypeLabel } from '@features/assignments/components/ielts/IeltsPreviewShared';
import { apiClient } from '@lib/apiClient';
import type {
  IeltsAssignmentConfig,
  IeltsAssignmentType,
  IeltsListeningConfig,
  IeltsReadingConfig,
  IeltsSpeakingConfig,
  IeltsWritingConfig,
} from '@lib/ielts';
import {
  getAnswerTargetsForQuestion,
  type StudentIeltsAnswerTarget,
} from './studentIeltsAnswerTargets';
import type { StudentIeltsAttemptState } from './studentIeltsAttempt.logic';
import { StudentIeltsSpeakingAttempt } from './StudentIeltsSpeakingAttempt';

type StudentIeltsAttemptFormProps = {
  type: IeltsAssignmentType;
  config: IeltsAssignmentConfig;
  attempt: StudentIeltsAttemptState;
  nextAttempt: number;
  maxAttempts: number | null;
  onChange: (attempt: StudentIeltsAttemptState) => void;
  onUploadBusyChange?: (busy: boolean) => void;
};

type FileContentLocation = {
  url: string;
  mime: string;
};

const setAnswerValue = (
  attempt: StudentIeltsAttemptState,
  questionId: string,
  value: string,
): StudentIeltsAttemptState => ({
  ...attempt,
  answers: {
    ...attempt.answers,
    [questionId]: value,
  },
});

function QuestionControl({
  target,
  questionNumber,
  value,
  onChange,
}: {
  target: StudentIeltsAnswerTarget;
  questionNumber: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const { question } = target;
  const options = target.options;
  const selectedValue = normalizeSelectedValue(value, target);

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">
          {getQuestionTypeLabel(question.type, question.format)}
        </p>
        <Label className="text-sm font-medium">
          {questionNumber}. {target.prompt || question.prompt || 'Question'}
        </Label>
      </div>
      {options.length > 0 ? (
        <RadioGroup value={selectedValue} onValueChange={onChange} className="gap-2">
          {options.map((option, optionIndex) => {
            const id = `${target.id}-${optionIndex}`;
            const prefix = String.fromCharCode(65 + optionIndex);
            return (
              <label
                key={id}
                htmlFor={id}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <RadioGroupItem id={id} value={option.value} className="mt-0.5" />
                <span>
                  <span className="font-medium mr-2">{prefix}.</span>
                  {option.label}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      ) : (
        <Input
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="Answer"
        />
      )}
    </div>
  );
}

const normalizeSelectedValue = (
  value: string,
  target: StudentIeltsAnswerTarget,
): string => {
  const optionIndex = Number(value);
  if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < target.options.length) {
    return target.options[optionIndex].value;
  }
  return value;
};

function ListeningAudio({ section }: { section: IeltsListeningConfig['sections'][number] }) {
  const audioFileId = section.audioFileId;
  const [contentLocation, setContentLocation] = useState<FileContentLocation | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!audioFileId) {
      setContentLocation(null);
      setErrorMessage('');
      return;
    }

    let isMounted = true;
    setContentLocation(null);
    setErrorMessage('');

    apiClient<FileContentLocation>(`/api/v1/files/${encodeURIComponent(audioFileId)}/content`)
      .then((location) => {
        if (isMounted) {
          setContentLocation(location);
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Audio is unavailable for this section.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [audioFileId]);

  if (!audioFileId) {
    return (
      <p className="mt-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
        Audio has not been attached for this section.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Volume2 className="size-4 text-muted-foreground" />
        <span>Section audio</span>
      </div>
      {contentLocation ? (
        <audio controls src={contentLocation.url} className="w-full" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {errorMessage || 'Loading audio...'}
        </p>
      )}
      {section.playback?.limitPlays ? (
        <p className="text-xs text-muted-foreground">
          Play limit: {section.playback.limitPlays}
        </p>
      ) : null}
    </div>
  );
}

function ReadingListeningAttempt({
  type,
  config,
  attempt,
  onChange,
}: {
  type: 'reading' | 'listening';
  config: IeltsReadingConfig | IeltsListeningConfig;
  attempt: StudentIeltsAttemptState;
  onChange: (attempt: StudentIeltsAttemptState) => void;
}) {
  let questionNumber = 1;
  return (
    <div className="space-y-4">
      {config.sections.map(section => (
        <section key={section.id} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            {type === 'reading' && 'passage' in section && (
              <p className="mt-2 max-h-52 overflow-auto rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {section.passage}
              </p>
            )}
            {type === 'listening' && (
              <ListeningAudio section={section as IeltsListeningConfig['sections'][number]} />
            )}
          </div>
          <div className="space-y-3">
            {section.questions.map(question => {
              const targets = getAnswerTargetsForQuestion(question);
              return (
                <div key={question.id} className="space-y-3">
                  {targets.map(target => {
                    const currentNumber = questionNumber++;
                    const value = String(attempt.answers[target.id] ?? '');
                    return (
                      <QuestionControl
                        key={target.id}
                        target={target}
                        questionNumber={currentNumber}
                        value={value}
                        onChange={nextValue =>
                          onChange(setAnswerValue(attempt, target.id, nextValue))
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function WritingAttempt({
  config,
  attempt,
  onChange,
}: {
  config: IeltsWritingConfig;
  attempt: StudentIeltsAttemptState;
  onChange: (attempt: StudentIeltsAttemptState) => void;
}) {
  return (
    <div className="space-y-4">
      {(['task1', 'task2'] as const).map(taskId => (
        <section key={taskId} className="space-y-2">
          <div className="flex items-center gap-2">
            <PenLine className="size-4 text-muted-foreground" />
            <Label htmlFor={taskId}>{taskId === 'task1' ? 'Task 1' : 'Task 2'}</Label>
          </div>
          <p className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {config[taskId].prompt}
          </p>
          <Textarea
            id={taskId}
            value={attempt.writing[taskId]}
            rows={7}
            onChange={event =>
              onChange({
                ...attempt,
                writing: {
                  ...attempt.writing,
                  [taskId]: event.target.value,
                },
              })
            }
          />
        </section>
      ))}
    </div>
  );
}

export function StudentIeltsAttemptForm({
  type,
  config,
  attempt,
  nextAttempt,
  maxAttempts,
  onChange,
  onUploadBusyChange,
}: StudentIeltsAttemptFormProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <Clock className="size-4" />
        <AlertDescription>
          Attempt {nextAttempt}
          {maxAttempts ? ` of ${maxAttempts}` : ''} started at{' '}
          {new Date(attempt.startedAt).toLocaleTimeString()}.
          {config.timing.enabled ? ` Time limit: ${config.timing.durationMinutes} minutes.` : ''}
        </AlertDescription>
      </Alert>
      {config.instructions && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>{config.instructions}</AlertDescription>
        </Alert>
      )}
      {type === 'reading' && (
        <ReadingListeningAttempt
          type="reading"
          config={config as IeltsReadingConfig}
          attempt={attempt}
          onChange={onChange}
        />
      )}
      {type === 'listening' && (
        <ReadingListeningAttempt
          type="listening"
          config={config as IeltsListeningConfig}
          attempt={attempt}
          onChange={onChange}
        />
      )}
      {type === 'writing' && (
        <WritingAttempt config={config as IeltsWritingConfig} attempt={attempt} onChange={onChange} />
      )}
      {type === 'speaking' && (
        <StudentIeltsSpeakingAttempt
          config={config as IeltsSpeakingConfig}
          attempt={attempt}
          onChange={onChange}
          onUploadBusyChange={onUploadBusyChange}
        />
      )}
    </div>
  );
}
