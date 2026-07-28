/**
 * Location: src/features/marketing/contactForm.ts
 * Purpose: Canonicalize contact form values and map client/server field errors.
 * Why: UI validation must operate on the same trimmed values as the backend contract.
 */
import { ApiError } from '@lib/apiClient';
import type { ContactSubmissionPayload } from './types';

export type ContactField = 'name' | 'email' | 'subject' | 'message';
export type ContactFieldErrors = Partial<Record<ContactField, string>>;
export type ContactFormPayload = Omit<ContactSubmissionPayload, 'idempotencyKey'>;

const CONTACT_FIELDS: ContactField[] = ['name', 'email', 'subject', 'message'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function contactFieldFromName(name: string): ContactField | null {
  return CONTACT_FIELDS.includes(name as ContactField)
    ? (name as ContactField)
    : null;
}

export function withoutContactFieldError(
  errors: ContactFieldErrors,
  field: ContactField,
): ContactFieldErrors {
  if (!errors[field]) return errors;
  const nextErrors = { ...errors };
  delete nextErrors[field];
  return nextErrors;
}

export function withoutDismissedContactErrors(
  errors: ContactFieldErrors,
  dismissedFields: ReadonlySet<ContactField>,
): ContactFieldErrors {
  return CONTACT_FIELDS.reduce<ContactFieldErrors>((visibleErrors, field) => {
    if (!dismissedFields.has(field) && errors[field]) {
      visibleErrors[field] = errors[field];
    }
    return visibleErrors;
  }, {});
}

export function canonicalContactPayload(formData: FormData): ContactFormPayload {
  return {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    subject: String(formData.get('subject') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
    website: String(formData.get('website') ?? ''),
  };
}

export function validateCanonicalContact(
  payload: ContactFormPayload,
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  if (payload.name.length < 2) {
    errors.name = 'Name must be at least 2 characters after trimming.';
  } else if (payload.name.length > 120) {
    errors.name = 'Name must be at most 120 characters after trimming.';
  }
  if (!EMAIL_PATTERN.test(payload.email) || payload.email.length > 254) {
    errors.email = 'Enter a valid email address of at most 254 characters.';
  }
  if (payload.subject.length < 3) {
    errors.subject = 'Subject must be at least 3 characters after trimming.';
  } else if (payload.subject.length > 160) {
    errors.subject = 'Subject must be at most 160 characters after trimming.';
  }
  if (payload.message.length < 10) {
    errors.message = 'Message must be at least 10 characters after trimming.';
  } else if (payload.message.length > 5_000) {
    errors.message = 'Message must be at most 5000 characters after trimming.';
  }
  return errors;
}

export function backendContactFieldErrors(error: unknown): ContactFieldErrors {
  if (!(error instanceof ApiError)) return {};
  const response = error.details;
  if (
    typeof response !== 'object' ||
    response === null ||
    !('details' in response)
  ) {
    return {};
  }
  const responseDetails = response.details;
  if (
    typeof responseDetails !== 'object' ||
    responseDetails === null ||
    !('fieldErrors' in responseDetails)
  ) {
    return {};
  }
  const fieldErrors = responseDetails.fieldErrors;
  if (typeof fieldErrors !== 'object' || fieldErrors === null) return {};

  const errors: ContactFieldErrors = {};
  for (const field of CONTACT_FIELDS) {
    const messages = Reflect.get(fieldErrors, field) as unknown;
    if (Array.isArray(messages) && typeof messages[0] === 'string') {
      errors[field] = messages[0];
    }
  }
  return errors;
}
