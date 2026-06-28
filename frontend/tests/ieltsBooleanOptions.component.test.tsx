/**
 * Location: tests/ieltsBooleanOptions.component.test.tsx
 * Purpose: Verify IELTS boolean option failures stay scoped to their option family.
 * Why: A yes/no config failure should not hide true/false controls or unrelated questions.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, test, vi } from 'vitest';

import { IeltsQuestionListEditor } from '../src/features/assignments/components/ielts/IeltsQuestionListEditor';
import { QuestionEditor } from '../src/features/assignments/components/ielts/QuestionEditor';
import type { IeltsQuestion, IeltsQuestionType } from '../src/lib/ielts';

const questionTypes: { value: IeltsQuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false_not_given', label: 'True / False / Not Given' },
  { value: 'yes_no_not_given', label: 'Yes / No / Not Given' },
];

const trueFalsePayload = {
  type: 'true_false',
  version: 1,
  options: [
    { value: 'true', label: 'True', score: 1, enabled: true, sort_order: 1 },
    { value: 'false', label: 'False', score: 0, enabled: true, sort_order: 2 },
    { value: 'not_given', label: 'Not Given', score: 0, enabled: true, sort_order: 3 },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderWithQueryClient(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function mockBooleanOptionFetches() {
  const requestedTypes: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const type = url.searchParams.get('type') ?? '';
    requestedTypes.push(type);

    if (type === 'true_false') {
      return new Response(JSON.stringify(trueFalsePayload), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Yes/no config unavailable' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/json' },
    });
  });

  return requestedTypes;
}

test('question editor keeps true-false controls when yes-no options fail', async () => {
  const requestedTypes = mockBooleanOptionFetches();
  const question: IeltsQuestion = {
    id: 'question-1',
    type: 'true_false_not_given',
    prompt: 'The passage says classes start Monday.',
    options: [],
    correctAnswer: 'true',
  };

  renderWithQueryClient(
    <QuestionEditor
      question={question}
      questionNumber={1}
      onChange={vi.fn()}
      onDelete={vi.fn()}
      showDelete={false}
      questionTypes={questionTypes}
    />,
  );

  await waitFor(() => {
    assert.ok(requestedTypes.includes('true_false'));
    assert.ok(requestedTypes.includes('yes_no'));
  });

  await waitFor(() => {
    assert.equal(screen.queryByText('Unable to load boolean answer options.'), null);
    assert.ok(screen.getByText('Correct Answer'));
    assert.ok(screen.getByText('True'));
  });
});

test('question list editor does not show boolean errors for non-boolean questions', async () => {
  const requestedTypes = mockBooleanOptionFetches();
  const question: IeltsQuestion = {
    id: 'question-1',
    type: 'multiple_choice',
    prompt: 'Choose the correct heading.',
    options: ['Heading A', 'Heading B'],
    correctAnswer: '0',
  };

  renderWithQueryClient(
    <IeltsQuestionListEditor
      questions={[question]}
      onChange={vi.fn()}
      typeOptions={questionTypes}
    />,
  );

  await waitFor(() => {
    assert.ok(requestedTypes.includes('yes_no'));
  });

  assert.equal(screen.queryByText('Unable to load boolean answer options.'), null);
  assert.ok(screen.getByText('Correct Answer'));
});
