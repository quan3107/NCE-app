/**
 * Location: features/assignments/components/ielts/IeltsListeningContentEditor.tsx
 * Purpose: Inline editor for IELTS listening sections with audio, transcript, and questions.
 * Why: Allows teachers to edit listening content directly including section management
 *      and question editing with full type selection.
 */

import { useState } from 'react';
import type { IeltsListeningConfig, IeltsQuestion, IeltsListeningSection } from '@lib/ielts';
import { IELTS_LISTENING_QUESTION_TYPES } from '@lib/ielts';
import { Textarea } from '@components/ui/textarea';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { QuestionEditor } from './QuestionEditor';
import { Plus, X, Headphones } from 'lucide-react';

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `ielts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createQuestion = (): IeltsQuestion => ({
  id: createId(),
  type: 'multiple_choice',
  prompt: '',
  options: ['', ''],
  correctAnswer: '',
});

const createListeningSection = (index: number): IeltsListeningSection => ({
  id: createId(),
  title: `Section ${index + 1}`,
  audioFileId: null,
  transcript: '',
  playback: { limitPlays: 1 },
  questions: [createQuestion()],
});

type IeltsListeningContentEditorProps = {
  value: IeltsListeningConfig;
  onChange: (updated: IeltsListeningConfig) => void;
};

export function IeltsListeningContentEditor({ value, onChange }: IeltsListeningContentEditorProps) {
  const sections = value.sections ?? [];
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '');

  const handleAddSection = () => {
    const newSection = createListeningSection(sections.length);
    onChange({
      ...value,
      sections: [...sections, newSection],
    });
    setActiveSectionId(newSection.id);
  };

  const handleDeleteSection = (sectionId: string) => {
    const newSections = sections.filter((s) => s.id !== sectionId);
    if (newSections.length === 0) {
      const newSection = createListeningSection(0);
      onChange({ ...value, sections: [newSection] });
      setActiveSectionId(newSection.id);
    } else {
      onChange({ ...value, sections: newSections });
      if (activeSectionId === sectionId) {
        setActiveSectionId(newSections[0]?.id ?? '');
      }
    }
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<IeltsListeningSection>) => {
    const newSections = sections.map((section) =>
      section.id === sectionId ? { ...section, ...updates } : section
    );
    onChange({ ...value, sections: newSections });
  };

  const handleAddQuestion = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    
    const newQuestions = [...section.questions, createQuestion()];
    handleUpdateSection(sectionId, { questions: newQuestions });
  };

  const handleDeleteQuestion = (sectionId: string, questionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    
    const newQuestions = section.questions.filter((q) => q.id !== questionId);
    if (newQuestions.length === 0) {
      newQuestions.push(createQuestion());
    }
    handleUpdateSection(sectionId, { questions: newQuestions });
  };

  const handleUpdateQuestion = (sectionId: string, questionId: string, updated: IeltsQuestion) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    
    const newQuestions = section.questions.map((q) =>
      q.id === questionId ? updated : q
    );
    handleUpdateSection(sectionId, { questions: newQuestions });
  };

  const activeSection = sections.find((s) => s.id === activeSectionId);
  const activeSectionIndex = sections.findIndex((s) => s.id === activeSectionId);

  return (
    <div className="space-y-4">
      <Tabs value={activeSectionId} onValueChange={setActiveSectionId}>
        <div className="flex items-center gap-2 flex-wrap">
          <TabsList className="flex flex-wrap gap-2 bg-transparent p-0 rounded-none">
            {sections.map((section, index) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="tabs-pill"
              >
                <span>Section {index + 1}</span>
                {sections.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSection(section.id);
                    }}
                    className="passage-remove-btn"
                    title="Delete section"
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={handleAddSection}
            title="Add section"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} className="space-y-4 mt-4">
            <div className="rounded-[14px] border bg-card p-6 space-y-6">
              {/* Section header */}
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground min-w-[60px]">
                      Title:
                    </label>
                    <Input
                      value={section.title}
                      onChange={(e) =>
                        handleUpdateSection(section.id, { title: e.target.value })
                      }
                      placeholder="Section title..."
                      className="flex-1"
                    />
                  </div>
                  
                  {/* Audio placeholder */}
                  <div className="flex items-center gap-3">
                    <Headphones className="size-4 text-muted-foreground" />
                    <div className="flex-1 rounded-lg border border-dashed border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Audio file management coming soon
                      </p>
                    </div>
                  </div>

                  {/* Playback limit */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground min-w-[100px]">
                      Play Limit:
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={section.playback?.limitPlays ?? 1}
                      onChange={(e) =>
                        handleUpdateSection(section.id, {
                          playback: { limitPlays: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">times</span>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Transcript</label>
                <Textarea
                  value={section.transcript}
                  onChange={(e) =>
                    handleUpdateSection(section.id, { transcript: e.target.value })
                  }
                  placeholder="Enter the audio transcript here..."
                  className="min-h-[150px] resize-none"
                />
              </div>

              {/* Questions */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Questions</h4>
                  <span className="text-xs text-muted-foreground">
                    {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {section.questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    questionNumber={index + 1}
                    onChange={(updated) =>
                      handleUpdateQuestion(section.id, question.id, updated)
                    }
                    onDelete={() => handleDeleteQuestion(section.id, question.id)}
                    showDelete={section.questions.length > 1}
                    questionTypes={IELTS_LISTENING_QUESTION_TYPES}
                  />
                  ))}
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleAddQuestion(section.id)}
                  >
                    <Plus className="size-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
