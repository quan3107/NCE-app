/** Reading question pages isolate unchanged controls from passage typing and bound mount work. */
import { memo, useEffect, useState } from 'react';
import type { IeltsQuestion } from '@lib/ielts';
import { Button } from '@components/ui/button';
import { QuestionEditor } from './QuestionEditor';
import type { CompletionFormatOption, QuestionTypeOption } from './questionEditor.logic';
type Props = {
  questions: IeltsQuestion[]; start: number; sectionId: string;
  questionTypes: QuestionTypeOption[]; completionFormats: CompletionFormatOption[];
  update: (sectionId: string, questionId: string, question: IeltsQuestion) => void;
  remove: (sectionId: string, questionId: string) => void;
};
const pageSize = 5;
export const ReadingQuestionList = memo(function ReadingQuestionList({ questions, start, sectionId, questionTypes, completionFormats, update, remove }: Props) {
  const [page, setPage] = useState(0);
  const [previousCount, setPreviousCount] = useState(questions.length);
  const lastPage = Math.max(0, Math.ceil(questions.length / pageSize) - 1);
  const activePage = Math.min(page, lastPage);
  // Newly added questions should be immediately editable; deletions keep the current page valid.
  useEffect(() => {
    if (questions.length > previousCount) setPage(lastPage);
    setPreviousCount(questions.length);
  }, [questions.length, previousCount, lastPage]);
  const offset = activePage * pageSize;
  return <>
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>Questions {start + offset}–{start + Math.min(offset + pageSize, questions.length) - 1}</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous questions</Button>
        <Button type="button" variant="outline" size="sm" disabled={activePage === lastPage} onClick={() => setPage(activePage + 1)}>Next questions</Button>
      </div>
    </div>
    {questions.slice(offset, offset + pageSize).map((question, index) => <QuestionEditor
      key={question.id} question={question} questionNumber={start + offset + index}
      onChange={updated => update(sectionId, question.id, updated)}
      onDelete={() => remove(sectionId, question.id)} showDelete={questions.length > 1}
      questionTypes={questionTypes} completionFormats={completionFormats}
    />)}
  </>;
});
