/** Reading regressions: page navigation and stable delegates must preserve every draft edit. */
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { IeltsReadingConfig } from '@lib/ielts';
const { renders, config } = vi.hoisted(() => ({ renders: { count: 0 }, config: { question_types: { reading: [] }, completion_formats: [] } }));
// Exercise the real configuration selectors: recreating filtered arrays defeated memoization in production.
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: config }) }));
vi.mock('../src/features/assignments/components/ielts/QuestionEditor', () => ({
  QuestionEditor: ({ question, questionNumber, onChange }: { question: { prompt: string }; questionNumber: number; onChange: (q: unknown) => void }) => {
    renders.count++;
    return <textarea aria-label={`Question ${questionNumber}`} value={question.prompt} onChange={e => onChange({ ...question, prompt: e.target.value })} />;
  },
}));
const { IeltsReadingContentEditor } = await import('../src/features/assignments/components/ielts/IeltsReadingContentEditor');
afterEach(cleanup);
test('passage typing avoids unchanged question rendering; edits survive question/passage pages', () => {
  const initial = { sections: [1, 2].map(section => ({ id: `p${section}`, title: `Passage ${section}`, passage: `Passage text ${section}`, questions: Array.from({ length: 7 }, (_, i) => ({ id: `p${section}q${i}`, type: 'completion', prompt: `Prompt ${i}`, correctAnswer: `Answer ${i}` })) })) } as unknown as IeltsReadingConfig;
  let draft = initial;
  function Harness() {
    const [value, setValue] = useState(initial);
    draft = value;
    return <IeltsReadingContentEditor value={value} onChange={setValue} />;
  }
  render(<Harness />);
  const before = renders.count;
  fireEvent.change(screen.getByLabelText('Passage text'), { target: { value: 'Edited passage' } });
  expect(renders.count).toBe(before);
  fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'Edited question one' } });
  expect(draft.sections[0].passage).toBe('Edited passage');
  fireEvent.click(screen.getByRole('button', { name: 'Next questions' }));
  fireEvent.change(screen.getByLabelText('Question 7'), { target: { value: 'Edited last question' } });
  fireEvent.click(screen.getByRole('button', { name: 'Previous questions' }));
  expect(screen.getByLabelText('Question 1')).toHaveProperty('value', 'Edited question one');
  fireEvent.click(screen.getByRole('tab', { name: 'Passage 2' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Passage 1' }));
  expect(screen.getByLabelText('Passage text')).toHaveProperty('value', 'Edited passage');
  expect(draft.sections[0].questions[6].prompt).toBe('Edited last question');
  expect(draft.sections[0].questions[6].correctAnswer).toBe('Answer 6');
  expect(draft.sections).toHaveLength(2);
  expect(draft.sections.every(section => section.questions.length === 7)).toBe(true);
});
