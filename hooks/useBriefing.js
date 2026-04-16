import { useState, useCallback } from 'react';

const CURRENT_KEY = 'aparture-briefing-current';
const HISTORY_KEY = 'aparture-briefing-history';
const MAX_HISTORY = 90;

function generateId() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Backfill legacy entries that lack id / timestamp / archived. */
function migrateEntry(entry, index) {
  if (entry.id && entry.timestamp !== undefined && entry.archived !== undefined) {
    return entry;
  }
  return {
    id: entry.id ?? `legacy-${entry.date ?? index}`,
    date: entry.date ?? 'unknown',
    timestamp: entry.timestamp ?? (entry.date ? new Date(entry.date + 'T00:00:00').getTime() : 0),
    briefing: entry.briefing,
    generationMetadata: entry.generationMetadata,
    archived: entry.archived ?? false,
  };
}

function readStoredCurrent() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateEntry(parsed, 0);
  } catch {
    return null;
  }
}

function readStoredHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    return entries.map((b, i) => migrateEntry(b, i));
  } catch {
    return [];
  }
}

export function useBriefing() {
  const [current, setCurrent] = useState(readStoredCurrent);
  const [history, setHistory] = useState(readStoredHistory);

  const saveBriefing = useCallback((date, briefing, generationMetadata) => {
    const id = generateId();
    const entry = {
      id,
      date,
      timestamp: Date.now(),
      briefing,
      archived: false,
      ...(generationMetadata !== undefined ? { generationMetadata } : {}),
    };
    setCurrent(entry);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CURRENT_KEY, JSON.stringify(entry));
    }
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
    return id;
  }, []);

  const deleteBriefing = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
    setCurrent((prev) => {
      if (prev?.id === id) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CURRENT_KEY);
        }
        return null;
      }
      return prev;
    });
  }, []);

  const toggleArchive = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, archived: !b.archived } : b));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return { current, history, saveBriefing, deleteBriefing, toggleArchive };
}
