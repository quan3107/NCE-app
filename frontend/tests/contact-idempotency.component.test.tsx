/**
 * Location: tests/contact-idempotency.component.test.tsx
 * Purpose: Define retry identity across multiple unresolved contact payloads.
 * Why: Lost responses must not create duplicates when a user switches between drafts.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, test, vi } from 'vitest';

import { getContactAttempt } from '../src/features/marketing/contactAttemptRegistry';
import { ContactRoute } from '../src/routes/Contact';

const contactContent = {
  header: { title: 'Contact us', description: 'We can help.' },
  form: { title: 'Send a message', description: 'Tell us what you need.', submitLabel: 'Send message' },
  details: { email: 'support@example.test', phone: '+1 555 0100', address: '1 Learning Way' },
  hours: [{ label: 'Weekdays', value: '09:00-17:00' }],
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
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
  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: subject },
  });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Please help me access my course.' },
  });
}

test('reuses each unresolved key after switching from payload A to B and back', async () => {
  const bodies: Array<Record<string, string>> = [];
  let attempt = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/v1/cms/contact-page-content')) {
      return new Response(JSON.stringify(contactContent), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/contact') && init?.method === 'POST') {
      bodies.push(JSON.parse(String(init.body)) as Record<string, string>);
      attempt += 1;
      if (attempt < 3) throw new TypeError('response lost');
      return new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });

  fillContactForm('Payload A');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');

  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: 'Payload B' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');

  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: 'Payload A' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('status');

  assert.equal(bodies.length, 3);
  assert.equal(bodies[0]?.idempotencyKey, bodies[2]?.idempotencyKey);
  assert.notEqual(bodies[0]?.idempotencyKey, bodies[1]?.idempotencyKey);
});

test('reuses an unresolved key after a lost response and route remount', async () => {
  const bodies: Array<Record<string, string>> = [];
  let attempt = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/v1/cms/contact-page-content')) {
      return new Response(JSON.stringify(contactContent), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/contact') && init?.method === 'POST') {
      bodies.push(JSON.parse(String(init.body)) as Record<string, string>);
      attempt += 1;
      if (attempt === 1) throw new TypeError('response lost');
      return new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });

  const firstView = renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm('Course access');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');
  firstView.unmount();

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm('Course access');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('status');

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0]?.idempotencyKey, bodies[1]?.idempotencyKey);
});

test('bounds unresolved attempts and replaces expired identities', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-28T00:00:00Z'));
  const payload = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    subject: 'Attempt 0',
    message: 'Please help me access my course.',
    website: '',
  };
  const firstAttempt = await getContactAttempt(payload);

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    await getContactAttempt({ ...payload, subject: `Attempt ${attempt}` });
  }

  const stored = sessionStorage.getItem(sessionStorage.key(0) ?? '');
  assert.ok(stored);
  assert.equal((JSON.parse(stored) as unknown[]).length, 20);
  const replacement = await getContactAttempt(payload);
  assert.notEqual(replacement.idempotencyKey, firstAttempt.idempotencyKey);

  vi.setSystemTime(new Date('2026-07-29T01:00:00Z'));
  const expiredReplacement = await getContactAttempt(payload);
  assert.notEqual(expiredReplacement.idempotencyKey, replacement.idempotencyKey);
});
