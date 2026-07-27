/**
 * Location: tests/contact-flow.component.test.tsx
 * Purpose: Define the public contact form submission and recovery states.
 * Why: Users need truthful loading, success, validation-error, and retry behavior.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, test, vi } from 'vitest';

import { ContactRoute } from '../src/routes/Contact';

const contactContent = {
  header: { title: 'Contact us', description: 'We can help.' },
  form: { title: 'Send a message', description: 'Tell us what you need.', submitLabel: 'Send message' },
  details: { email: 'support@example.test', phone: '+1 555 0100', address: '1 Learning Way' },
  hours: [{ label: 'Weekdays', value: '09:00–17:00' }],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderContact() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ContactRoute />, { wrapper });
}

function fillContactForm() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Course access' } });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Please help me access my course.' },
  });
}

test('submits persisted contact data once and clears the form only after success', async () => {
  let resolveSubmission: ((response: Response) => void) | undefined;
  const submission = new Promise<Response>((resolve) => { resolveSubmission = resolve; });
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/v1/cms/contact-page-content')) {
      return new Response(JSON.stringify(contactContent), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/contact') && init?.method === 'POST') return submission;
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  const pendingButton = await screen.findByRole('button', { name: 'Sending…' });
  assert.ok(pendingButton.hasAttribute('disabled'));
  assert.ok(resolveSubmission);
  resolveSubmission(new Response(JSON.stringify({
    id: '11111111-1111-4111-8111-111111111111',
    status: 'new',
    submittedAt: '2026-07-27T10:00:00.000Z',
  }), { status: 201, headers: { 'content-type': 'application/json' } }));

  await screen.findByRole('status');
  assert.equal((screen.getByLabelText('Name') as HTMLInputElement).value, '');

  const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
  assert.ok(postCall);
  assert.deepEqual(JSON.parse(String(postCall[1]?.body)), {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    subject: 'Course access',
    message: 'Please help me access my course.',
    website: '',
  });
});

test('retains entered data and allows retry after a server validation error', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).endsWith('/api/v1/cms/contact-page-content')) {
      return new Response(JSON.stringify(contactContent), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (init?.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Please check the submitted fields.' }), {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  assert.match((await screen.findByRole('alert')).textContent ?? '', /check the submitted fields/i);
  assert.equal((screen.getByLabelText('Name') as HTMLInputElement).value, 'Ada Lovelace');
  assert.equal(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled'), false);
});
