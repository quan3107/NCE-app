/**
 * Location: features/assignments/components/ielts/authoring/ListeningAssignmentForm.tsx
 * Purpose: Render the listening authoring form per Figma layout.
 * Why: Matches audio upload, playback limit, and section list design.
 */

import { Plus, Upload } from 'lucide-react';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import type { IeltsListeningConfig } from '@lib/ielts';

type ListeningAssignmentFormProps = {
  value: IeltsListeningConfig;
  onChange: (value: IeltsListeningConfig) => void;
  onAudioSelect: (sectionId: string, file: File | null) => void;
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `listening-${Date.now()}-${Math.random()}`;

export function ListeningAssignmentForm({
  value,
  onChange,
  onAudioSelect,
}: ListeningAssignmentFormProps) {
  const addSection = () => {
    const nextSections = [
      ...value.sections,
      {
        id: createId(),
        title: `Section ${value.sections.length + 1}`,
        audioFileId: null,
        playback: { limitPlays: 1 },
        questions: [],
      },
    ];
    onChange({ ...value, sections: nextSections });
  };

  const updateSection = (index: number, patch: Partial<IeltsListeningConfig['sections'][0]>) => {
    const nextSections = value.sections.map((section, idx) =>
      idx === index ? { ...section, ...patch } : section,
    );
    onChange({ ...value, sections: nextSections });
  };

  const toSelectValue = (limitPlays?: number) =>
    limitPlays === 0 ? '999' : String(limitPlays ?? 1);

  const toLimitPlays = (value: string) => (value === '999' ? 0 : Number(value));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Listening Sections</CardTitle>
            <CardDescription>Upload audio and create questions for each section</CardDescription>
          </div>
          <Button onClick={addSection} size="sm">
            <Plus className="mr-2 size-4" />
            Add Section
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {value.sections.map((section, index) => (
          <Card key={section.id} className="border-2">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{section.title}</h4>
                <Badge variant="secondary">{section.questions.length} questions</Badge>
              </div>

              <div className="space-y-2">
                <Label>Audio File</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(event) =>
                      onAudioSelect(section.id, event.target.files?.[0] ?? null)
                    }
                  />
                  <Button variant="outline">
                    <Upload className="mr-2 size-4" />
                    Upload
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Playback Limit</Label>
                <Select
                  value={toSelectValue(section.playback?.limitPlays)}
                  onValueChange={(value) =>
                    updateSection(index, { playback: { limitPlays: toLimitPlays(value) } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 time (IELTS standard)</SelectItem>
                    <SelectItem value="2">2 times</SelectItem>
                    <SelectItem value="999">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" size="sm" className="w-full">
                <Plus className="mr-2 size-4" />
                Add Questions to Section
              </Button>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
