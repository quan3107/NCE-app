/**
 * Location: tests/contact-flow.component.test.tsx
 * Purpose: Define the public contact form submission and recovery states.
 * Why: Users need truthful loading, success, validation-error, and retry behavior.
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function fillContactForm(
  values: Partial<Record<'name' | 'email' | 'subject' | 'message', string>> = {},
) {
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: values.name ?? 'Ada Lovelace' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: values.email ?? 'ada@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: values.subject ?? 'Course access' },
  });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: values.message ?? 'Please help me access my course.' },
  });
}

function mockContactRequests(
  submit: (init: RequestInit) => Promise<Response>,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/v1/cms/contact-page-content')) {
      return new Response(JSON.stringify(contactContent), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/contact') && init?.method === 'POST') {
      return submit(init);
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });
}

test('freezes one submission snapshot and clears only after generic success', async () => {
  let resolveSubmission: ((response: Response) => void) | undefined;
  const submission = new Promise<Response>((resolve) => { resolveSubmission = resolve; });
  const fetchSpy = mockContactRequests(async () => submission);

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  const pendingButton = await screen.findByRole('button', { name: 'Sending…' });
  assert.ok(pendingButton.matches(':disabled'));
  assert.ok(screen.getByLabelText('Message').matches(':disabled'));
  assert.ok(resolveSubmission);
  resolveSubmission(new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  }));

  await screen.findByRole('status');
  assert.equal((screen.getByLabelText('Name') as HTMLInputElement).value, '');

  const postCall = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');
  assert.ok(postCall);
  const body = JSON.parse(String(postCall[1]?.body)) as Record<string, string>;
  assert.match(body.idempotencyKey, /^[0-9a-f-]{36}$/i);
  assert.deepEqual({ ...body, idempotencyKey: '<generated>' }, {
    idempotencyKey: '<generated>',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    subject: 'Course access',
    message: 'Please help me access my course.',
    website: '',
  });

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New message' } });
  await waitFor(() => assert.ok(screen.queryByRole('status') === null));
});

test('reuses one idempotency key when an unchanged submission is retried', async () => {
  const bodies: Array<Record<string, string>> = [];
  let attempt = 0;
  mockContactRequests(async (init) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, string>);
    attempt += 1;
    if (attempt === 1) throw new TypeError('connection lost');
    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('status');

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0]?.idempotencyKey, bodies[1]?.idempotencyKey);
});

test('reuses one idempotency key after canonical-equivalent and reverted edits', async () => {
  const bodies: Array<Record<string, string>> = [];
  let attempt = 0;
  mockContactRequests(async (init) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, string>);
    attempt += 1;
    if (attempt === 1) throw new TypeError('response lost');
    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: '  Ada Lovelace  ' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'ADA@EXAMPLE.COM' },
  });
  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: 'Different request' },
  });
  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: 'Course access' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('status');

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0]?.idempotencyKey, bodies[1]?.idempotencyKey);
});

test('validates trimmed canonical values before sending', async () => {
  let postCount = 0;
  mockContactRequests(async () => {
    postCount += 1;
    return new Response(JSON.stringify({ accepted: true }), { status: 202 });
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm({ name: ' a ', message: '          ' });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  assert.ok(await screen.findByText(/name must be at least 2 characters after trimming/i));
  assert.ok(screen.getByText(/message must be at least 10 characters after trimming/i));
  assert.equal(postCount, 0);
});

test.each([
  'a..b@example.com',
  '.a@example.com',
  'é@example.com',
])('rejects backend-invalid email %s without posting', async (email) => {
  let postCount = 0;
  mockContactRequests(async () => {
    postCount += 1;
    return new Response(JSON.stringify({ accepted: true }), { status: 202 });
  });

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm({ email });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  assert.ok(await screen.findByText(/enter a valid email address/i));
  assert.equal(postCount, 0);
});

test('editing one field preserves unrelated client validation errors', async () => {
  mockContactRequests(async () =>
    new Response(JSON.stringify({ accepted: true }), { status: 202 }),
  );

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  assert.ok(await screen.findByText(/name must be at least 2 characters/i));
  assert.ok(screen.getByText(/enter a valid email address/i));
  assert.ok(screen.getByText(/subject must be at least 3 characters/i));
  assert.ok(screen.getByText(/message must be at least 10 characters/i));

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Ada Lovelace' },
  });

  await waitFor(() =>
    assert.ok(screen.queryByText(/name must be at least 2 characters/i) === null),
  );
  assert.ok(screen.getByText(/enter a valid email address/i));
  assert.ok(screen.getByText(/subject must be at least 3 characters/i));
  assert.ok(screen.getByText(/message must be at least 10 characters/i));
});

test('editing one field preserves unrelated backend validation errors', async () => {
  mockContactRequests(async () =>
    new Response(JSON.stringify({
      message: 'Validation failed.',
      details: {
        formErrors: [],
        fieldErrors: {
          email: ['Email is not accepted.'],
          message: ['Message is not accepted.'],
        },
      },
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
  );

  renderContact();
  await screen.findByRole('heading', { name: 'Contact us' });
  fillContactForm();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  assert.ok(await screen.findByText('Message is not accepted.'));
  assert.ok(screen.getByText('Email is not accepted.'));
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'A different valid message.' },
  });
  await waitFor(() => assert.ok(screen.queryByText('Message is not accepted.') === null));
  assert.ok(screen.getByText('Email is not accepted.'));
});
