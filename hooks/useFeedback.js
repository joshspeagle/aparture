import { useCallback, useMemo, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import {
  isEditableFeedback,
  isFilterVerdict,
  isPendingFeedback,
  isTestFeedback,
} from '../lib/profile/feedbackStatus.js';
import { useAnalyzerStore } from '../stores/analyzerStore.js';

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

// --- Test-run feedback ---
// A Dry Run reacts to mock LLM output (random verdicts and scores,
// placeholder summaries) and a Minimal Test to hard-coded test papers, so
// feedback given while either is running must not steer the real profile.
// Every event created during one is stamped `testMode: true`; the Suggest
// dialog, the "new" counts and real briefings skip it (lib/profile/
// feedbackStatus.js isTestFeedback). Callers that know they are acting on
// test artifacts after the run has ended (e.g. a post-run verdict click on
// a dry run's filter buckets) pass `testMode: true` explicitly.
function testRunActive() {
  const testState = useAnalyzerStore.getState().testState;
  return Boolean(testState?.dryRunInProgress || testState?.minimalTestInProgress);
}

function resolveTestMode(explicit) {
  return explicit === true || testRunActive();
}

function withTestFlag(event, testMode) {
  return testMode ? { ...event, testMode: true } : event;
}

// Latest-wins replacement (stars/dismisses, scoped notes, overrides) only
// ever replaces an event from the SAME partition: a test-run action never
// overwrites or deletes a real event, and vice versa.
function samePartition(event, testMode) {
  return Boolean(event.testMode) === testMode;
}

// The single star/dismiss event literal — both the toggling (addStar/
// addDismiss) and non-toggling (ensureStar/ensureDismiss) paths build their
// replacement event here.
function makeReactionEvent(type, paper, testMode) {
  return withTestFlag(
    {
      id: makeId(),
      type,
      arxivId: paper.arxivId,
      paperTitle: paper.paperTitle,
      quickSummary: paper.quickSummary,
      score: paper.score,
      timestamp: Date.now(),
      briefingDate: paper.briefingDate,
    },
    testMode
  );
}

export function useFeedback() {
  const [events, setEvents] = useState(() => readInitialEvents());

  const replaceStarOrDismiss = useCallback((arxivId, testMode, buildNext) => {
    setEvents((prev) => {
      const isReaction = (e) =>
        (e.type === 'star' || e.type === 'dismiss') &&
        e.arxivId === arxivId &&
        samePartition(e, testMode);
      const existing = prev.find(isReaction);
      const next = buildNext(existing);
      // Keep-unchanged shortcircuit: buildNext returning the EXISTING event
      // means "leave the log as-is" — no persist round-trip, no reorder
      // (splice-and-reappend would move the event to the tail).
      if (next && next === existing) return prev;
      const filtered = prev.filter((e) => !isReaction(e));
      const result = next ? [...filtered, next] : filtered;
      persist(result);
      return result;
    });
  }, []);

  const toggleReaction = useCallback(
    (type, paper) => {
      const testMode = resolveTestMode(paper.testMode);
      replaceStarOrDismiss(paper.arxivId, testMode, (existing) => {
        if (existing?.type === type) return null;
        return makeReactionEvent(type, paper, testMode);
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
      const testMode = resolveTestMode(paper.testMode);
      replaceStarOrDismiss(paper.arxivId, testMode, (existing) => {
        if (existing?.type === type) return existing; // already in the desired state
        return makeReactionEvent(type, paper, testMode);
      });
    },
    [replaceStarOrDismiss]
  );

  const ensureStar = useCallback((paper) => ensureReaction('star', paper), [ensureReaction]);
  const ensureDismiss = useCallback((paper) => ensureReaction('dismiss', paper), [ensureReaction]);

  const addPaperComment = useCallback((paper, text) => {
    const testMode = resolveTestMode(paper.testMode);
    setEvents((prev) => {
      const event = withTestFlag(
        {
          id: makeId(),
          type: 'paper-comment',
          arxivId: paper.arxivId,
          paperTitle: paper.paperTitle,
          quickSummary: paper.quickSummary,
          score: paper.score,
          text,
          timestamp: Date.now(),
          briefingDate: paper.briefingDate,
        },
        testMode
      );
      const next = [...prev, event];
      persist(next);
      return next;
    });
  }, []);

  // options.origin: where the comment was written. 'pre-briefing' marks the
  // Gate 3 note, which briefingClient also sends to the briefing writer as an
  // editorial instruction for that day's briefing.
  const addGeneralComment = useCallback((text, briefingDate, briefingId, options = {}) => {
    const testMode = resolveTestMode(options?.testMode);
    setEvents((prev) => {
      const event = withTestFlag(
        {
          id: makeId(),
          type: 'general-comment',
          text,
          timestamp: Date.now(),
          briefingDate,
          ...(briefingId ? { briefingId } : {}),
          ...(typeof options?.origin === 'string' ? { origin: options.origin } : {}),
        },
        testMode
      );
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
    const testMode = resolveTestMode(paper.testMode);
    setEvents((prev) => {
      const sameKey = (e) =>
        e.type === 'filter-override' &&
        e.arxivId === paper.arxivId &&
        e.briefingDate === paper.briefingDate &&
        samePartition(e, testMode);
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
      const event = withTestFlag(
        {
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
        },
        testMode
      );
      // Dropping every same-key event also folds duplicates left by the
      // old append-only logger into the single latest one.
      const next = [...prev.filter((e) => !sameKey(e)), event];
      persist(next);
      return next;
    });
  }, []);

  const addScopedFeedback = useCallback(({ scope, text, briefingDate, testMode: explicit }) => {
    if (!text || !text.trim()) return;
    const testMode = resolveTestMode(explicit);
    setEvents((prev) => {
      const dedupeKey =
        scope.kind === 'bucket'
          ? `bucket:${scope.bucket}:${briefingDate}`
          : `${scope.kind}:${briefingDate}`;
      const matches = (e) => {
        if (e.type !== 'scoped-feedback') return false;
        if (!samePartition(e, testMode)) return false;
        const k =
          e.scope.kind === 'bucket'
            ? `bucket:${e.scope.bucket}:${e.briefingDate}`
            : `${e.scope.kind}:${e.briefingDate}`;
        return k === dedupeKey;
      };
      const filtered = prev.filter((e) => !matches(e));
      const event = withTestFlag(
        {
          id: makeId(),
          type: 'scoped-feedback',
          scope,
          text: text.trim(),
          timestamp: Date.now(),
          briefingDate,
        },
        testMode
      );
      const next = [...filtered, event];
      persist(next);
      return next;
    });
  }, []);

  // Answer to one of the editor's questions at the end of a briefing.
  // Latest-wins per (briefingDate, questionId); tapping the chosen answer
  // again takes it back. The answer reaches suggest-profile as evidence.
  const recordAnswer = useCallback(
    ({ questionId, question, answer, evidence = [], briefingDate, testMode: explicit }) => {
      if (!questionId || !answer) return;
      const testMode = resolveTestMode(explicit);
      setEvents((prev) => {
        const same = (e) =>
          e.type === 'answer' &&
          e.questionId === questionId &&
          e.briefingDate === briefingDate &&
          samePartition(e, testMode);
        const existing = prev.find(same);
        const filtered = prev.filter((e) => !same(e));
        const next =
          existing?.answer === answer
            ? filtered
            : [
                ...filtered,
                withTestFlag(
                  {
                    id: makeId(),
                    type: 'answer',
                    questionId,
                    question,
                    answer,
                    evidence,
                    timestamp: Date.now(),
                    briefingDate,
                  },
                  testMode
                ),
              ];
        persist(next);
        return next;
      });
    },
    []
  );

  // Delete one event (Feedback panel). For a star or dismiss this is the same
  // as toggling it off; for a comment or note it is the only way to take back
  // a typo or a mistake, which would otherwise be pre-ticked in every Suggest.
  const removeEvent = useCallback((id) => {
    setEvents((prev) => {
      if (!prev.some((e) => e.id === id)) return prev;
      const next = prev.filter((e) => e.id !== id);
      persist(next);
      return next;
    });
  }, []);

  // Edit the text of a comment or note. The new wording hasn't been
  // considered by any suggestion, so an edited event is pending again
  // (editedAt; incorporatedAt cleared — see feedbackStatus). Empty text is
  // refused: delete the event instead.
  const updateEventText = useCallback((id, text) => {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) return;
    setEvents((prev) => {
      const target = prev.find((e) => e.id === id);
      if (!isEditableFeedback(target) || target.text === trimmed) return prev;
      const next = prev.map((e) => {
        if (e.id !== id) return e;
        const { incorporatedAt: _reconsider, ...rest } = e;
        return { ...rest, text: trimmed, editedAt: Date.now() };
      });
      persist(next);
      return next;
    });
  }, []);

  // Remove every test-run event (and legacy dry-run junk such as
  // "filter said 123" overrides) in one go — the Feedback panel's
  // "Clear test feedback" action.
  const clearTestEvents = useCallback(() => {
    setEvents((prev) => {
      if (!prev.some(isTestFeedback)) return prev;
      const next = prev.filter((e) => !isTestFeedback(e));
      persist(next);
      return next;
    });
  }, []);

  // Mark the events behind an ACCEPTED suggested change as incorporated
  // (SuggestDialog → resolveSuggestionOutcome decides which). `at` is the
  // suggested revision's createdAt, so reverting that revision can find
  // them again. An event already incorporated keeps its original stamp.
  const markIncorporated = useCallback((ids, at = Date.now()) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const wanted = new Set(ids);
    setEvents((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        if (!wanted.has(e.id) || e.incorporatedAt) return e;
        changed = true;
        return { ...e, incorporatedAt: at };
      });
      if (!changed) return prev;
      persist(next);
      return next;
    });
  }, []);

  // Reverting to the profile revision created at `since` undoes every change
  // made at or after it, so the events those changes incorporated become
  // pending again.
  const reopenIncorporatedSince = useCallback((since) => {
    if (!Number.isFinite(since)) return;
    setEvents((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        if (!e.incorporatedAt || e.incorporatedAt < since) return e;
        changed = true;
        const { incorporatedAt: _reopened, ...rest } = e;
        return rest;
      });
      if (!changed) return prev;
      persist(next);
      return next;
    });
  }, []);

  // Events that can still inform a profile suggestion: pending ones only.
  // Test-run feedback and incorporated events are never included; `cutoff`
  // is the legacy profile.lastFeedbackCutoff (see feedbackStatus).
  const getNewSince = useCallback(
    (cutoff) => events.filter((e) => isPendingFeedback(e, cutoff)),
    [events]
  );

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
      recordAnswer,
      removeEvent,
      updateEventText,
      clearTestEvents,
      markIncorporated,
      reopenIncorporatedSince,
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
      recordAnswer,
      removeEvent,
      updateEventText,
      clearTestEvents,
      markIncorporated,
      reopenIncorporatedSince,
      getNewSince,
    ]
  );
}
