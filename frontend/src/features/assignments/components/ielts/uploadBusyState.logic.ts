/**
 * Location: features/assignments/components/ielts/uploadBusyState.logic.ts
 * Purpose: Track pending authoring uploads across nested editors.
 * Why: Lets create/edit flows disable save until every upload has settled.
 */

export type UploadBusyState = Record<string, boolean>;

export const setBusyUploadState = (
  current: UploadBusyState,
  scopeId: string,
  busy: boolean,
): UploadBusyState => {
  if (busy) {
    return { ...current, [scopeId]: true };
  }

  if (!(scopeId in current)) {
    return current;
  }

  const next = { ...current };
  delete next[scopeId];
  return next;
};

export const clearBusyUploadScope = (
  current: UploadBusyState,
  scopePrefix: string,
): UploadBusyState => {
  let changed = false;
  const next: UploadBusyState = {};

  for (const [scopeId, busy] of Object.entries(current)) {
    if (scopeId.startsWith(scopePrefix)) {
      changed = true;
      continue;
    }
    next[scopeId] = busy;
  }

  return changed ? next : current;
};

export const hasBusyUploads = (state: UploadBusyState): boolean =>
  Object.values(state).some(Boolean);
