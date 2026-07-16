// Gate-arrival tab-title signal. When the pipeline parks at any review gate
// (every gate stage ends in '-review': filter-review, score-review,
// pre-briefing-review), the document title flips to a waiting message so a
// backgrounded tab shows that the run needs attention. The previous title is
// restored as soon as the stage changes — resume, stop, or run end all leave
// the review stage, so the cleanup covers every exit path.

import { useEffect } from 'react';

export const GATE_WAITING_TITLE = '⏸ Waiting for your review — Aparture';

export function useGateTitle(stage) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!stage || !stage.endsWith('-review')) return undefined;
    const previousTitle = document.title;
    document.title = GATE_WAITING_TITLE;
    return () => {
      document.title = previousTitle;
    };
  }, [stage]);
}
