/**
 * Location: features/assignments/components/ielts/IeltsReadingContentEditor.tsx
 * Purpose: Inline editor for IELTS reading passages with editable passage text
 *          and question management (add/remove/edit questions with type selection).
 * Why: Allows teachers to edit reading content directly in the detail view while
 *      maintaining the same two-column layout as the preview.
 */

import { useState, useMemo } from 'react';
import type { IeltsReadingConfig, IeltsQuestion, IeltsReadingSection } from '@lib/ielts';
import { IELTS_READING_QUESTION_TYPES } from '@lib/ielts';
import { Textarea } from '@components/ui/textarea';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { QuestionEditor } from './QuestionEditor';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';

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

const createReadingSection = (index: number): IeltsReadingSection => ({
  id: createId(),
  title: `Passage ${index + 1}`,
  passage: '',
  questions: [createQuestion()],
});

type IeltsReadingContentEditorProps = {
  value: IeltsReadingConfig;
  onChange: (updated: IeltsReadingConfig) => void;
};

export function IeltsReadingContentEditor({ value, onChange }: IeltsReadingContentEditorProps) {
  const sections = value.sections ?? [];
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '');

  const ranges = useMemo(() => {
    let cursor = 1;
    return sections.map((section) => {
      const start = cursor;
      const count = section.questions?.length ?? 0;
      const end = count > 0 ? cursor + count - 1 : null;
      cursor += count;
      return { start, end };
    });
  }, [sections]);

  const handleAddSection = () => {
    const newSection = createReadingSection(sections.length);
    onChange({
      ...value,
      sections: [...sections, newSection],
    });
    setActiveSectionId(newSection.id);
  };

  const handleDeleteSection = (sectionId: string) => {
    const newSections = sections.filter((s) => s.id !== sectionId);
    if (newSections.length === 0) {
      // Keep at least one section
      const newSection = createReadingSection(0);
      onChange({ ...value, sections: [newSection] });
      setActiveSectionId(newSection.id);
    } else {
      onChange({ ...value, sections: newSections });
      if (activeSectionId === sectionId) {
        setActiveSectionId(newSections[0]?.id ?? '');
      }
    }
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<IeltsReadingSection>) => {
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
      // Keep at least one question
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
  const activeRange = ranges[activeSectionIndex];

  return (
    <div className="rounded-[14px] border bg-card overflow-hidden">
      {/* Header with passage tabs */}
      <div className="flex-none p-3 border-b bg-muted/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Reading Text:</span>
          <Tabs value={activeSectionId} onValueChange={setActiveSectionId} className="w-auto">
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-0 rounded-none">
              {sections.map((section, index) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="tabs-pill"
                >
                  <span>Passage {index + 1}</span>
                  {sections.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(section.id);
                      }}
                      className="passage-remove-btn"
                      title="Delete passage"
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={handleAddSection}
            title="Add passage"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeSection && (
          <div className="grid lg:grid-cols-2 divide-x min-h-[500px] reading-panels-container">
            {/* Left column - Passage editor */}
            <div className="flex flex-col overflow-hidden bg-muted/5">
              <div className="flex-none p-4 border-b bg-muted/10 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-medium text-muted-foreground">Title:</span>
                  <Input
                    value={activeSection.title}
                    onChange={(e) =>
                      handleUpdateSection(activeSection.id, { title: e.target.value })
                    }
                    placeholder="Passage title..."
                    className="h-8 text-sm flex-1 max-w-[300px]"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-visible">
                <Textarea
                  value={activeSection.passage}
                  onChange={(e) =>
                    handleUpdateSection(activeSection.id, { passage: e.target.value })
                  }
                  placeholder="Enter the reading passage text here..."
                  className="min-h-[400px] resize-none text-sm leading-relaxed bg-background"
                />
              </div>
            </div>

            {/* Right column - Questions editor */}
            <div className="flex flex-col overflow-hidden bg-background">
              <div className="flex-none p-4 border-b bg-muted/5 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Questions</h3>
                {activeRange && activeRange.end && (
                  <span className="text-xs font-medium px-3 py-1.5 rounded-md bg-muted text-muted-foreground">
                    Questions {activeRange.start}-{activeRange.end}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-visible">
                <div className="space-y-4">
                  {activeSection.questions.map((question, index) => (
                    <QuestionEditor
                      key={question.id}
                      question={question}
                      questionNumber={activeRange?.start ? activeRange.start + index : index + 1}
                      onChange={(updated) =>
                        handleUpdateQuestion(activeSection.id, question.id, updated)
                      }
                      onDelete={() => handleDeleteQuestion(activeSection.id, question.id)}
                      showDelete={activeSection.questions.length > 1}
                      questionTypes={IELTS_READING_QUESTION_TYPES}
                    />
                  ))}
                  
                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm"
                    onClick={() => handleAddQuestion(activeSection.id)}
                  >
                    <Plus className="size-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex-none p-3 border-t bg-muted/10 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={activeSectionIndex <= 0}
          onClick={() => setActiveSectionId(sections[activeSectionIndex - 1]?.id ?? '')}
        >
          <ChevronLeft className="size-4 mr-1" />
          Previous Passage
        </Button>
        <span className="text-sm text-muted-foreground">
          Passage {activeSectionIndex + 1} of {sections.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={activeSectionIndex >= sections.length - 1}
          onClick={() => setActiveSectionId(sections[activeSectionIndex + 1]?.id ?? '')}
        >
          Next Passage
          <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
