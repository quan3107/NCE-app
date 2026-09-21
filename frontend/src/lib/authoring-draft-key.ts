/**
 * Location: lib/authoring-draft-key.ts
 * Purpose: Namespace local authoring drafts by their owning account.
 * Why: A shared browser must not restore another teacher's unpublished work.
 */
import { getAuthenticatedQueryScope } from "./authenticated-query-scope";

export function authoringDraftKey(key: string): string {
  const [, userId] = getAuthenticatedQueryScope();
  return `ielts_autosave_${userId}_${key}`;
}
