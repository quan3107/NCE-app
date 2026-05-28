/**
 * Location: tests/apiBaseUrl.test.ts
 * Purpose: Verify local loopback API host resolution.
 * Why: Prevents localhost/127.0.0.1 cookie host mismatches during dev auth.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveApiBaseUrl } from '../src/lib/apiBaseUrl';

test('aligns localhost API host to 127.0.0.1 frontend host in dev', () => {
  const resolved = resolveApiBaseUrl('http://localhost:4000/api/v1', {
    isDev: true,
    locationHostname: '127.0.0.1',
  });

  assert.equal(resolved, 'http://127.0.0.1:4000/api/v1');
});

test('aligns 127.0.0.1 API host to localhost frontend host in dev', () => {
  const resolved = resolveApiBaseUrl('http://127.0.0.1:4000/api/v1', {
    isDev: true,
    locationHostname: 'localhost',
  });

  assert.equal(resolved, 'http://localhost:4000/api/v1');
});

test('keeps non-loopback API hosts unchanged', () => {
  const resolved = resolveApiBaseUrl('https://api.example.test/api/v1', {
    isDev: true,
    locationHostname: 'localhost',
  });

  assert.equal(resolved, 'https://api.example.test/api/v1');
});

test('does not rewrite loopback hosts outside dev mode', () => {
  const resolved = resolveApiBaseUrl('http://localhost:4000/api/v1', {
    isDev: false,
    locationHostname: '127.0.0.1',
  });

  assert.equal(resolved, 'http://localhost:4000/api/v1');
});
