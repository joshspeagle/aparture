import { useCallback, useState } from 'react';

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

function persist(events) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify({ events }));
  }
}

function makeId() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useFeedback() {
  const [events, setEvents] = useState(() => readInitialEvents());

  const replaceStarOrDismiss = useCallback((arxivId, buildNext) => {
    setEvents((prev) => {
      const existing = prev.find(
        (e) => (e.type === 'star' || e.type === 'dismiss') && e.arxivId === arxivId
      );
      const next = buildNext(existing);
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
      });
    },
    [replaceStarOrDismiss]
  );

  const addStar = useCallback((paper) => toggleReaction('star', paper), [toggleReaction]);
  const addDismiss = useCallback((paper) => toggleReaction('dismiss', paper), [toggleReaction]);

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

  // Phase 1.5.1 B3: filter-override events record when the user manually
  // changed a paper's filter verdict before scoring. The suggest-profile
  // flow uses these as a signal that the profile may be too narrow or too
  // broad for the filter stage.
  const addFilterOverride = useCallback((paper) => {
    setEvents((prev) => {
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
      const next = [...prev, event];
      persist(next);
      return next;
    });
  }, []);

  const getNewSince = useCallback((cutoff) => events.filter((e) => e.timestamp > cutoff), [events]);

  return {
    events,
    addStar,
    addDismiss,
    addPaperComment,
    addGeneralComment,
    addFilterOverride,
    getNewSince,
  };
}
