import { useCallback, useMemo, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { isFilterVerdict } from '../lib/profile/feedbackStatus.js';

const FEEDBACK_KEY = 'aparture-feedback';

function readInitialEvents() {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(FEEDBACK_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed?.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

// Persist via safeSetItem so a QuotaExceededError can't throw out of the
// state updaters that call this mid-click — a raw setItem here used to crash
// the interaction and lose the user's input. On quota failure, log and keep
// the in-memory state for the session (standard fallback; see safeStorage.js).
function persist(events) {
  if (typeof window === 'undefined') return;
  const ok = safeSetItem(FEEDBACK_KEY, JSON.stringify({ events }));
  if (!ok) {
    console.warn(
      '[useFeedback] localStorage quota exceeded; feedback events could not be persisted (in-memory state preserved for this session)'
    );
  }
}

function makeId() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// The single star/dismiss event literal — both the toggling (addStar/
// addDismiss) and non-toggling (ensureStar/ensureDismiss) paths build their
// replacement event here.
function makeReactionEvent(type, paper) {
  return {
    id: makeId(),
    type,
    arxivId: paper.arxivId,
    paperTitle: paper.paperTitle,
    quickSummary: paper.quickSummary,
    score: paper.score,
    timestamp: Date.now(),
    briefingDate: paper.briefingDate,
  };
}

export function useFeedback() {
  const [events, setEvents] = useState(() => readInitialEvents());

  const replaceStarOrDismiss = useCallback((arxivId, buildNext) => {
    setEvents((prev) => {
      const existing = prev.find(
        (e) => (e.type === 'star' || e.type === 'dismiss') && e.arxivId === arxivId
      );
      const next = buildNext(existing);
      // Keep-unchanged shortcircuit: buildNext returning the EXISTING event
      // means "leave the log as-is" — no persist round-trip, no reorder
      // (splice-and-reappend would move the event to the tail).
      if (next && next === existing) return prev;
      const filtered = prev.filter(
        (e) => !((e.type === 'star' || e.type === 'dismiss') && e.arxivId === arxivId)
      );
      const result = next ? [...filtered, next] : filtered;
      persist(result);
      return result;
    });
  }, []);

  const toggleReaction = useCallback(
    (type, paper) => {
      replaceStarOrDismiss(paper.arxivId, (existing) => {
        if (existing?.type === type) return null;
        return makeReactionEvent(type, paper);
      });
    },
    [replaceStarOrDismiss]
  );

  const addStar = useCallback((paper) => toggleReaction('star', paper), [toggleReaction]);
  const addDismiss = useCallback((paper) => toggleReaction('dismiss', paper), [toggleReaction]);

  // Non-toggling variants for the score-review gate handlers. The gate's
  // msStarredIds Set toggles independently of the feedback log, so calling
  // the toggling addStar there could silently REMOVE a pre-existing star
  // event while the gate UI shows the paper as starred. ensure* is a no-op
  // when the latest star/dismiss event for the paper already matches
  // (returning `existing` hits replaceStarOrDismiss's keep-unchanged
  // shortcircuit), and otherwise replaces the opposing reaction
  // (latest-wins, like addStar).
  const ensureReaction = useCallback(
    (type, paper) => {
      replaceStarOrDismiss(paper.arxivId, (existing) => {
        if (existing?.type === type) return existing; // already in the desired state
        return makeReactionEvent(type, paper);
      });
    },
    [replaceStarOrDismiss]
  );

  const ensureStar = useCallback((paper) => ensureReaction('star', paper), [ensureReaction]);
  const ensureDismiss = useCallback((paper) => ensureReaction('dismiss', paper), [ensureReaction]);

  const addPaperComment = useCallback((paper, text) => {
    setEvents((prev) => {
      const event = {
        id: makeId(),
        type: 'paper-comment',
        arxivId: paper.arxivId,
        paperTitle: paper.paperTitle,
        quickSummary: paper.quickSummary,
        score: paper.score,
        text,
        timestamp: Date.now(),
        briefingDate: paper.briefingDate,
      };
      const next = [...prev, event];
      persist(next);
      return next;
    });
  }, []);

  const addGeneralComment = useCallback((text, briefingDate, briefingId) => {
    setEvents((prev) => {
      const event = {
        id: makeId(),
        type: 'general-comment',
        text,
        timestamp: Date.now(),
        briefingDate,
        ...(briefingId ? { briefingId } : {}),
      };
      const next = [...prev, event];
      persist(next);
      return next;
    });
  }, []);

  // Filter-override events record that the user disagreed with a paper's
  // Stage 2 verdict; suggest-profile reads them as a "profile too narrow /
  // too broad for the filter" signal. Recorded when the pill is CLICKED
  // (App.setFilterVerdict) — they used to be diffed out of the buckets when
  // scoring started, which silently dropped every override made after a
  // run. Latest-wins per (paper, run day): re-clicking replaces the event,
  // and moving a paper back to the filter's own verdict removes it.
  // Verdicts outside YES/MAYBE/NO are refused outright, so mock or corrupt
  // data (the dry run's old `verdict: 123`) can never become feedback.
  const recordFilterOverride = useCallback((paper) => {
    if (!paper?.arxivId) return;
    if (!isFilterVerdict(paper.originalVerdict) || !isFilterVerdict(paper.newVerdict)) return;
    setEvents((prev) => {
      const sameKey = (e) =>
        e.type === 'filter-override' &&
        e.arxivId === paper.arxivId &&
        e.briefingDate === paper.briefingDate;
      const existing = prev.filter(sameKey);
      if (paper.originalVerdict === paper.newVerdict) {
        if (existing.length === 0) return prev;
        const next = prev.filter((e) => !sameKey(e));
        persist(next);
        return next;
      }
      if (
        existing.length === 1 &&
        existing[0].originalVerdict === paper.originalVerdict &&
        existing[0].newVerdict === paper.newVerdict
      ) {
        return prev; // already recorded exactly this override
      }
      const event = {
        id: makeId(),
        type: 'filter-override',
        arxivId: paper.arxivId,
        paperTitle: paper.paperTitle,
        summary: paper.summary ?? '',
        justification: paper.justification ?? '',
        originalVerdict: paper.originalVerdict,
        newVerdict: paper.newVerdict,
        timestamp: Date.now(),
        briefingDate: paper.briefingDate,
      };
      // Dropping every same-key event also folds duplicates left by the
      // old append-only logger into the single latest one.
      const next = [...prev.filter((e) => !sameKey(e)), event];
      persist(next);
      return next;
    });
  }, []);

  const addScopedFeedback = useCallback(({ scope, text, briefingDate }) => {
    if (!text || !text.trim()) return;
    setEvents((prev) => {
      const dedupeKey =
        scope.kind === 'bucket'
          ? `bucket:${scope.bucket}:${briefingDate}`
          : `${scope.kind}:${briefingDate}`;
      const matches = (e) => {
        if (e.type !== 'scoped-feedback') return false;
        const k =
          e.scope.kind === 'bucket'
            ? `bucket:${e.scope.bucket}:${e.briefingDate}`
            : `${e.scope.kind}:${e.briefingDate}`;
        return k === dedupeKey;
      };
      const filtered = prev.filter((e) => !matches(e));
      const event = {
        id: makeId(),
        type: 'scoped-feedback',
        scope,
        text: text.trim(),
        timestamp: Date.now(),
        briefingDate,
      };
      const next = [...filtered, event];
      persist(next);
      return next;
    });
  }, []);

  const getNewSince = useCallback((cutoff) => events.filter((e) => e.timestamp > cutoff), [events]);

  // Memoized so the returned object is referentially stable across unrelated
  // renders (App.jsx publishes it into the store's reactContext on every
  // render and relies on the reference only changing when events change).
  return useMemo(
    () => ({
      events,
      addStar,
      addDismiss,
      ensureStar,
      ensureDismiss,
      addPaperComment,
      addGeneralComment,
      recordFilterOverride,
      addScopedFeedback,
      getNewSince,
    }),
    [
      events,
      addStar,
      addDismiss,
      ensureStar,
      ensureDismiss,
      addPaperComment,
      addGeneralComment,
      recordFilterOverride,
      addScopedFeedback,
      getNewSince,
    ]
  );
}
