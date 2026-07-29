/**
 * Location: src/features/marketing/contactAttemptRegistry.ts
 * Purpose: Preserve unresolved contact retry identities for the lifetime of one browser tab.
 * Why: A lost success response must remain safely retryable after the contact route remounts.
 */
import type { ContactFormPayload } from './contactForm';

type ContactAttempt = {
  createdAt: number;
  expiresAt: number;
  fingerprint: string;
  idempotencyKey: string;
};

const STORAGE_KEY = 'nce.contact-attempts.v1';
const ATTEMPT_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_ATTEMPTS = 20;
let fallbackAttempts: ContactAttempt[] = [];
// Failed writes make storage stale, so memory stays authoritative until resynced.
let persistentWritesSucceeded = true;

function isContactAttempt(value: unknown): value is ContactAttempt {
  if (typeof value !== 'object' || value === null) return false;
  const attempt = value as Partial<ContactAttempt>;
  return (
    typeof attempt.createdAt === 'number'
    && typeof attempt.expiresAt === 'number'
    && typeof attempt.fingerprint === 'string'
    && typeof attempt.idempotencyKey === 'string'
  );
}

function writeAttempts(attempts: ContactAttempt[]): void {
  fallbackAttempts = attempts;
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    persistentWritesSucceeded = true;
  } catch {
    persistentWritesSucceeded = false;
  }
}

function readAttempts(now: number): ContactAttempt[] {
  let storedAttempts = fallbackAttempts;
  if (persistentWritesSucceeded) {
    try {
      const stored = globalThis.sessionStorage.getItem(STORAGE_KEY);
      const parsed = stored === null ? [] : JSON.parse(stored) as unknown;
      storedAttempts = Array.isArray(parsed) ? parsed.filter(isContactAttempt) : [];
    } catch {
      // Malformed or unavailable storage falls back to the current tab process.
    }
  }

  const activeAttempts = storedAttempts
    .filter((attempt) => attempt.expiresAt > now)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_ATTEMPTS);
  writeAttempts(activeAttempts);
  return activeAttempts;
}

async function fingerprintPayload(payload: ContactFormPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
}

export async function getContactAttempt(
  payload: ContactFormPayload,
): Promise<ContactAttempt> {
  const fingerprint = await fingerprintPayload(payload);
  const now = Date.now();
  const attempts = readAttempts(now);
  const existingAttempt = attempts.find(
    (attempt) => attempt.fingerprint === fingerprint,
  );
  if (existingAttempt) return existingAttempt;

  const attempt = {
    createdAt: now,
    expiresAt: now + ATTEMPT_TTL_MS,
    fingerprint,
    idempotencyKey: globalThis.crypto.randomUUID(),
  };
  writeAttempts([attempt, ...attempts].slice(0, MAX_ATTEMPTS));
  return attempt;
}

export function resolveContactAttempt(fingerprint: string): void {
  const now = Date.now();
  writeAttempts(
    readAttempts(now).filter((attempt) => attempt.fingerprint !== fingerprint),
  );
}
