/// <reference lib="dom" />
/**
 * Location: tests/notificationVisuals.test.ts
 * Purpose: Validate notification visual token resolution and fallback behavior.
 * Why: Ensures backend-provided visual metadata stays safe and predictable in the UI.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNotificationAccentClass,
  resolveNotificationAccentToken,
  resolveNotificationIconToken,
} from '../src/features/notifications/notificationVisuals';

test('resolveNotificationIconToken keeps valid icon tokens', () => {
  assert.equal(resolveNotificationIconToken('clock', 'due_soon'), 'clock');
  assert.equal(resolveNotificationIconToken('check-circle', 'graded'), 'check-circle');
});

test('resolveNotificationAccentToken keeps valid accent tokens', () => {
  assert.equal(resolveNotificationAccentToken('warning', 'due_soon'), 'warning');
  assert.equal(resolveNotificationAccentToken('success', 'graded'), 'success');
});

test('notification visuals fall back by type when token is missing', () => {
  assert.equal(resolveNotificationIconToken(undefined, 'due_soon'), 'clock');
  assert.equal(resolveNotificationAccentToken(undefined, 'due_soon'), 'warning');
  assert.equal(resolveNotificationIconToken(undefined, 'weekly_digest'), 'inbox');
  assert.equal(resolveNotificationAccentToken(undefined, 'weekly_digest'), 'neutral');
});

test('getNotificationAccentClass maps resolved accent tokens to css classes', () => {
  assert.equal(getNotificationAccentClass('success', 'graded'), 'text-green-500');
  assert.equal(getNotificationAccentClass('warning', 'due_soon'), 'text-orange-500');
  assert.equal(getNotificationAccentClass('neutral', 'weekly_digest'), 'text-muted-foreground');
  assert.equal(getNotificationAccentClass('info', 'reminder'), 'text-blue-500');
});

test('unknown visual tokens warn once per token and fall back safely', () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    assert.equal(resolveNotificationIconToken('invalid-icon', 'due_soon'), 'clock');
    assert.equal(resolveNotificationIconToken('invalid-icon', 'due_soon'), 'clock');
    assert.equal(resolveNotificationAccentToken('invalid-accent', 'graded'), 'success');
    assert.equal(resolveNotificationAccentToken('invalid-accent', 'graded'), 'success');
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 2);
  assert.equal(String(warnings[0][0]).includes('unknown notification visual token'), true);
  assert.equal(String(warnings[1][0]).includes('unknown notification visual token'), true);
});
