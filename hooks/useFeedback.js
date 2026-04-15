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

  const addStar = useCallback(
    (paper) => {
      replaceStarOrDismiss(paper.arxivId, (existing) => {
        if (existing?.type === 'star') return null;
        return {
          id: makeId(),
          type: 'star',
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

  const addDismiss = useCallback(
    (paper) => {
      replaceStarOrDismiss(paper.arxivId, (existing) => {
        if (existing?.type === 'dismiss') return null;
        return {
          id: makeId(),
          type: 'dismiss',
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

  const addGeneralComment = useCallback((text, briefingDate) => {
    setEvents((prev) => {
      const event = {
        id: makeId(),
        type: 'general-comment',
        text,
        timestamp: Date.now(),
        briefingDate,
      };
      const next = [...prev, event];
      persist(next);
      return next;
    });
  }, []);

  const getNewSince = useCallback((cutoff) => events.filter((e) => e.timestamp > cutoff), [events]);

  const markIncorporated = useCallback(() => {
    // No-op at the feedback-store level — useProfile owns the cutoff value.
  }, []);

  return {
    events,
    addStar,
    addDismiss,
    addPaperComment,
    addGeneralComment,
    getNewSince,
    markIncorporated,
  };
}
