/**
 * Location: features/assignments/components/ielts/student/StudentIeltsSpeakingAttempt.tsx
 * Purpose: Render student IELTS speaking recording upload controls.
 * Why: Keeps the main IELTS attempt form focused on type orchestration.
 */

import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { FileUploader } from '@components/common/FileUploader';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type { SubmissionFile } from '@domain';
import type { IeltsSpeakingConfig } from '@lib/ielts';
import type {
  StudentIeltsAttemptState,
  StudentIeltsRecording,
} from './studentIeltsAttempt.logic';

type SpeakingPart = 'part1' | 'part2' | 'part3';

type StudentIeltsSpeakingAttemptProps = {
  config: IeltsSpeakingConfig;
  attempt: StudentIeltsAttemptState;
  onChange: (attempt: StudentIeltsAttemptState) => void;
  onUploadBusyChange?: (busy: boolean) => void;
};

const partLabels: Record<SpeakingPart, string> = {
  part1: 'Part 1',
  part2: 'Part 2',
  part3: 'Part 3',
};

const toSyntheticRecordingFile = (fileId: string): SubmissionFile => ({
  id: fileId,
  name: 'Uploaded recording',
  size: 0,
  mime: 'audio/*',
  checksum: '',
  bucket: '',
  objectKey: '',
});

export function StudentIeltsSpeakingAttempt({
  config,
  attempt,
  onChange,
  onUploadBusyChange,
}: StudentIeltsSpeakingAttemptProps) {
  const [busyParts, setBusyParts] = useState<Partial<Record<SpeakingPart, boolean>>>({});

  useEffect(() => {
    onUploadBusyChange?.(Object.values(busyParts).some(Boolean));
  }, [busyParts, onUploadBusyChange]);

  return (
    <div className="space-y-4">
      {(['part1', 'part2', 'part3'] as SpeakingPart[]).map(part => {
        const recording = attempt.speakingRecordings[part];
        const uploadedFile =
          getRecordingFile(recording);
        return (
          <section key={part} className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mic className="size-4 text-muted-foreground" />
                <Label>{partLabels[part]}</Label>
              </div>
              {part === 'part2' && <Badge variant="outline">Cue card</Badge>}
            </div>
            {part === 'part2' ? (
              <div className="text-sm">
                <p className="font-medium">{config.part2.cueCard.topic}</p>
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {config.part2.cueCard.bulletPoints.map(point => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {config[part].questions.map(question => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-2">
                <Label>Upload recording</Label>
                <FileUploader
                  value={uploadedFile ? [uploadedFile] : []}
                  onBusyChange={(busy) =>
                    setBusyParts(current => ({
                      ...current,
                      [part]: busy,
                    }))
                  }
                  onChange={(files) => {
                    const file = files[files.length - 1];
                    const nextRecordings = { ...attempt.speakingRecordings };
                    if (!file) {
                      delete nextRecordings[part];
                    } else {
                      nextRecordings[part] = {
                        id: file.id,
                        durationSeconds: recording?.durationSeconds ?? 1,
                        file,
                      };
                    }
                    onChange({
                      ...attempt,
                      speakingRecordings: nextRecordings,
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${part}-duration`}>Duration (seconds)</Label>
                <Input
                  id={`${part}-duration`}
                  type="number"
                  min={1}
                  value={recording?.durationSeconds ?? ''}
                  onChange={event =>
                    onChange({
                      ...attempt,
                      speakingRecordings: {
                        ...attempt.speakingRecordings,
                        [part]: {
                          id: recording?.id ?? '',
                          durationSeconds: Number(event.target.value) || 0,
                          ...(recording?.file ? { file: recording.file } : {}),
                        },
                      },
                    })
                  }
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const getRecordingFile = (recording?: StudentIeltsRecording): SubmissionFile | null => {
  if (!recording) {
    return null;
  }
  return 'file' in recording && recording.file
    ? recording.file
    : toSyntheticRecordingFile(recording.id);
};
