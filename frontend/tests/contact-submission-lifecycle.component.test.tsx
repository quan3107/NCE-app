/**
 * Location: tests/contact-submission-lifecycle.component.test.tsx
 * Purpose: Define contact submission ordering and retry-key preparation failures.
 * Why: Key preparation and persistence must behave as one visible, serialized lifecycle.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, test, vi } from 'vitest';

import { ContactRoute } from '../src/routes/Contact';

const contactContent = {
  header: { title: 'Contact us', description: 'We can help.' },
  form: { title: 'Send a message', description: 'Tell us what you need.', submitLabel: 'Send message' },
  details: { email: 'support@example.test', phone: '+1 555 0100', address: '1 Learning Way' },
  hours: [{ label: 'Weekdays', value: '09:00-17:00' }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
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

function fillContactForm(subject: string) {
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Ada Lovelace' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: subject } });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Please help me access my course.' },
  });
}

function mockContactRequests(
  submit: (body: Record<string, string>) => Promise<Response>,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/v1/cms/contact-page-content')) {
      return new Response(JSON.stringify(contactContent), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/contact') && init?.method === 'POST') {
      return submit(JSON.parse(String(init.body)) as Record<string, string>);
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });
}

test('serializes key preparation and lets only the active draft reset', async () => {
  const digestResolvers: Array<(value: ArrayBuffer) => void> = [];
  vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(
    () => new Promise<ArrayBuffer>((resolve) => digestResolvers.push(resolve)),
  );
  const postedSubjects: string[] = [];
  mockContactRequests(async (body) => {
    postedSubjects.push(body.subject ?? '');
    if (body.subject === 'Draft B') {
      return new Response(JSON.stringify({ message: 'Draft B failed.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm('Draft A');
  const submitButton = screen.getByRole('button', { name: 'Send message' });

  act(() => {
    fireEvent.click(submitButton);
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'Draft B' },
    });
    fireEvent.click(submitButton);
  });

  await waitFor(() => assert.equal(digestResolvers.length, 1));
  assert.ok(screen.getByRole('button', { name: 'Sending…' }).matches(':disabled'));
  digestResolvers[0]?.(new Uint8Array([1]).buffer);

  await waitFor(() => assert.equal(digestResolvers.length, 2));
  assert.equal((screen.getByLabelText('Subject') as HTMLInputElement).value, 'Draft B');
  digestResolvers[1]?.(new Uint8Array([2]).buffer);

  assert.ok(await screen.findByRole('alert'));
  assert.deepEqual(postedSubjects, ['Draft A', 'Draft B']);
  assert.equal((screen.getByLabelText('Subject') as HTMLInputElement).value, 'Draft B');
});

test.each([
  ['crypto.subtle', (crypto: Crypto) => ({ randomUUID: crypto.randomUUID })],
  ['crypto.randomUUID', (crypto: Crypto) => ({ subtle: crypto.subtle })],
])('surfaces missing %s without posting', async (_case, availableCrypto) => {
  const browserCrypto = globalThis.crypto;
  vi.stubGlobal('crypto', availableCrypto(browserCrypto));
  let postCount = 0;
  mockContactRequests(async () => {
    postCount += 1;
    return new Response(JSON.stringify({ accepted: true }), { status: 202 });
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm('Course access');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  assert.ok(await screen.findByText(/unable to prepare your message/i));
  assert.equal(postCount, 0);
  assert.ok(screen.getByRole('button', { name: 'Send message' }).matches(':enabled'));
});
