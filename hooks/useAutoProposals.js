import { useCallback, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { rememberEvaluated } from '../lib/profile/autoProposals.js';

// Proposals the editor prepared after a briefing, waiting for the reader,
// plus the ids of feedback an automatic round has already weighed
// (lib/profile/autoProposals.js). localStorage-backed like the other hooks.
const KEY = 'aparture-auto-proposals';

function read() {
  if (typeof window === 'undefined') return { pending: null, evaluatedIds: [] };
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    return {
      pending: raw?.pending?.response ? raw.pending : null,
      evaluatedIds: Array.isArray(raw?.evaluatedIds) ? raw.evaluatedIds : [],
    };
  } catch {
    return { pending: null, evaluatedIds: [] };
  }
}

export function useAutoProposals() {
  const [state, setState] = useState(read);

  const update = useCallback((fn) => {
    setState((prev) => {
      const next = fn(prev);
      safeSetItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // A finished round: `pending` is {response, sentEvents, createdAt,
  // briefingDate} when it found something to propose, else null.
  const recordRound = useCallback(
    ({ pending, evaluatedIds }) =>
      update((prev) => ({
        pending: pending ?? prev.pending,
        evaluatedIds: rememberEvaluated(prev.evaluatedIds, evaluatedIds ?? []),
      })),
    [update]
  );

  const clearPending = useCallback(() => update((prev) => ({ ...prev, pending: null })), [update]);

  return {
    pending: state.pending,
    evaluatedIds: state.evaluatedIds,
    recordRound,
    clearPending,
  };
}
