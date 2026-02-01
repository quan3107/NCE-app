/**
 * Location: lib/use-auto-save.ts
 * Purpose: Auto-save hook for IELTS authoring forms with localStorage backup.
 * Why: Prevents data loss during browser crashes or accidental navigation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveState<T> {
  data: T;
  timestamp: number;
  version: string;
  assignmentId?: string;
}

interface UseAutoSaveOptions {
  key: string;
  debounceMs?: number;
  maxAgeDays?: number;
  version?: string;
}

interface UseAutoSaveReturn<T> {
  status: SaveStatus;
  lastSaved: Date | null;
  hasDraft: boolean;
  draftTimestamp: Date | null;
  clearDraft: () => void;
  restoreDraft: () => T | null;
  draftData: T | null;
}

const DEFAULT_DEBOUNCE_MS = 1000;
const DEFAULT_MAX_AGE_DAYS = 7;
const STORAGE_VERSION = '1.0';

export function useAutoSave<T>(
  data: T,
  options: UseAutoSaveOptions
): UseAutoSaveReturn<T> {
  const { key, debounceMs = DEFAULT_DEBOUNCE_MS, maxAgeDays = DEFAULT_MAX_AGE_DAYS } = options;
  
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<Date | null>(null);
  const [draftData, setDraftData] = useState<T | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<T | null>(null);
  const isFirstRenderRef = useRef(true);
  const initialDataRef = useRef<T | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const storageKey = `ielts_autosave_${key}`;
      const saved = localStorage.getItem(storageKey);
      
      if (saved) {
        const parsed: AutoSaveState<T> = JSON.parse(saved);
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - parsed.timestamp > maxAgeMs;
        
        if (!isExpired) {
          setHasDraft(true);
          setDraftTimestamp(new Date(parsed.timestamp));
          setDraftData(parsed.data);
        } else {
          // Clear expired draft
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error('Error checking for draft:', error);
    }
  }, [key, maxAgeDays]);

  // Store initial data on first render
  useEffect(() => {
    if (isFirstRenderRef.current) {
      initialDataRef.current = data;
    }
  }, [data]);

  // Auto-save when data changes
  useEffect(() => {
    // Skip on first render - don't save initial data
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousDataRef.current = data;
      return;
    }

    // Don't save if data matches initial data (prevents "Saved just now" on fresh loads)
    if (JSON.stringify(data) === JSON.stringify(initialDataRef.current)) {
      return;
    }

    // Don't save if data hasn't actually changed from previous
    if (previousDataRef.current && JSON.stringify(data) === JSON.stringify(previousDataRef.current)) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setStatus('saving');

    // Debounce the save
    timeoutRef.current = setTimeout(() => {
      try {
        const storageKey = `ielts_autosave_${key}`;
        const state: AutoSaveState<T> = {
          data,
          timestamp: Date.now(),
          version: STORAGE_VERSION,
        };
        
        localStorage.setItem(storageKey, JSON.stringify(state));
        setStatus('saved');
        setLastSaved(new Date());
        setHasDraft(true);
        setDraftTimestamp(new Date());
        previousDataRef.current = data;
      } catch (error) {
        console.error('Error auto-saving:', error);
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, key, debounceMs]);

  const clearDraft = useCallback(() => {
    try {
      const storageKey = `ielts_autosave_${key}`;
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftTimestamp(null);
      setDraftData(null);
      previousDataRef.current = null;
      initialDataRef.current = null;
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [key]);

  const restoreDraft = useCallback((): T | null => {
    return draftData;
  }, [draftData]);

  return {
    status,
    lastSaved,
    hasDraft,
    draftTimestamp,
    clearDraft,
    restoreDraft,
    draftData,
  };
}

/**
 * Hook to check if there's a conflicting draft when loading an existing assignment
 */
export function useDraftConflict<T>(
  assignmentId: string,
  serverData: T | null
): {
  hasConflict: boolean;
  draftData: T | null;
  draftTimestamp: Date | null;
  clearConflict: () => void;
} {
  const [hasConflict, setHasConflict] = useState(false);
  const [draftData, setDraftData] = useState<T | null>(null);
  const [draftTimestamp, setDraftTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    if (!serverData) return;

    try {
      const storageKey = `ielts_autosave_${assignmentId}`;
      const saved = localStorage.getItem(storageKey);
      
      if (saved) {
        const parsed: AutoSaveState<T> = JSON.parse(saved);
        const maxAgeMs = DEFAULT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        const isExpired = Date.now() - parsed.timestamp > maxAgeMs;
        
        if (!isExpired) {
          // Check if draft is different from server data
          const isDifferent = JSON.stringify(parsed.data) !== JSON.stringify(serverData);
          
          if (isDifferent) {
            setHasConflict(true);
            setDraftData(parsed.data);
            setDraftTimestamp(new Date(parsed.timestamp));
          }
        }
      }
    } catch (error) {
      console.error('Error checking for draft conflict:', error);
    }
  }, [assignmentId, serverData]);

  const clearConflict = useCallback(() => {
    setHasConflict(false);
    setDraftData(null);
    setDraftTimestamp(null);
  }, []);

  return {
    hasConflict,
    draftData,
    draftTimestamp,
    clearConflict,
  };
}
