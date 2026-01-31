/**
 * Location: features/assignments/components/ielts/authoring/ListeningAssignmentForm.tsx
 * Purpose: Render the listening authoring form per Figma layout.
 * Why: Matches audio upload, playback limit, section list, and question editing design.
 */

import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import type { IeltsListeningConfig, IeltsQuestion } from '@lib/ielts';
import { IELTS_LISTENING_QUESTION_TYPES, createIeltsAssignmentConfig } from '@lib/ielts';
import type { UploadFile } from '@lib/mock-data';
import { QuestionEditor } from '../QuestionEditor';

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
  // Track uploaded images for diagram labeling questions
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadFile>>({});

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

  // Question management handlers
  const handleAddQuestion = (sectionIndex: number) => {
    const section = value.sections[sectionIndex];
    const baseConfig = createIeltsAssignmentConfig('listening');
    const baseSection = baseConfig.sections[0];
    const newQuestion: IeltsQuestion = {
      ...baseSection.questions[0],
      id: createId(),
      type: 'multiple_choice',
      prompt: '',
      options: ['', '', '', ''],
      correctAnswer: '',
    };
    updateSection(sectionIndex, {
      questions: [...section.questions, newQuestion],
    });
  };

  const handleUpdateQuestion = (
    sectionIndex: number,
    questionId: string,
    updatedQuestion: IeltsQuestion
  ) => {
    const section = value.sections[sectionIndex];
    const updatedQuestions = section.questions.map((q) =>
      q.id === questionId ? updatedQuestion : q
    );
    updateSection(sectionIndex, { questions: updatedQuestions });
  };

  const handleDeleteQuestion = (sectionIndex: number, questionId: string) => {
    const section = value.sections[sectionIndex];
    const updatedQuestions = section.questions.filter((q) => q.id !== questionId);
    updateSection(sectionIndex, { questions: updatedQuestions });
  };

  // Image upload handler for diagram labeling
  const handleImageUpload = async (file: File): Promise<string> => {
    // Create UploadFile for temporary blob URL
    const imageId = createId();
    const uploadFile: UploadFile = {
      id: imageId,
      name: file.name,
      size: file.size,
      mime: file.type,
      url: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    };
    
    setUploadedImages((prev) => ({ ...prev, [imageId]: uploadFile }));
    return imageId;
  };

  // Image removal handler
  const handleImageRemove = (imageId: string) => {
    setUploadedImages((prev) => {
      const next = { ...prev };
      // Revoke object URL to prevent memory leaks
      if (next[imageId]?.url) {
        URL.revokeObjectURL(next[imageId].url);
      }
      delete next[imageId];
      return next;
    });
  };

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

              {/* Questions list */}
              <div className="space-y-3">
                {section.questions.map((question, questionIndex) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    questionNumber={questionIndex + 1}
                    questionTypes={IELTS_LISTENING_QUESTION_TYPES}
                    onChange={(updated) => handleUpdateQuestion(index, question.id, updated)}
                    onDelete={() => handleDeleteQuestion(index, question.id)}
                    showDelete={section.questions.length > 1}
                    onImageUpload={handleImageUpload}
                    onImageRemove={handleImageRemove}
                    uploadedImages={uploadedImages}
                  />
                ))}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => handleAddQuestion(index)}
              >
                <Plus className="mr-2 size-4" />
                Add Question to Section
              </Button>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
