import { useState, useCallback } from 'react';

const CURRENT_KEY = 'aparture-briefing-current';
const HISTORY_KEY = 'aparture-briefing-history';
const MAX_HISTORY = 14;

function readStoredCurrent() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useBriefing() {
  const [current, setCurrent] = useState(readStoredCurrent);
  const [history, setHistory] = useState(readStoredHistory);

  const saveBriefing = useCallback((date, briefing) => {
    const entry = { date, briefing };
    setCurrent(entry);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CURRENT_KEY, JSON.stringify(entry));
    }
    setHistory((prev) => {
      const filtered = prev.filter((b) => b.date !== date);
      const next = [entry, ...filtered].slice(0, MAX_HISTORY);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return { current, history, saveBriefing };
}
