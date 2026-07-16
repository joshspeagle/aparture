import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGateTitle, GATE_WAITING_TITLE } from '../../../hooks/useGateTitle.js';

describe('useGateTitle', () => {
  beforeEach(() => {
    document.title = 'Aparture';
  });

  it('does not touch the title for non-review stages', () => {
    renderHook(({ stage }) => useGateTitle(stage), { initialProps: { stage: 'scoring' } });
    expect(document.title).toBe('Aparture');
  });

  it.each(['filter-review', 'score-review', 'pre-briefing-review'])(
    'sets the waiting title when the stage is %s',
    (stage) => {
      renderHook(({ stage: s }) => useGateTitle(s), { initialProps: { stage } });
      expect(document.title).toBe(GATE_WAITING_TITLE);
    }
  );

  it('restores the previous title when processing resumes', () => {
    const { rerender } = renderHook(({ stage }) => useGateTitle(stage), {
      initialProps: { stage: 'filter-review' },
    });
    expect(document.title).toBe(GATE_WAITING_TITLE);
    rerender({ stage: 'scoring' });
    expect(document.title).toBe('Aparture');
  });

  it('restores the previous title on unmount', () => {
    const { unmount } = renderHook(({ stage }) => useGateTitle(stage), {
      initialProps: { stage: 'score-review' },
    });
    expect(document.title).toBe(GATE_WAITING_TITLE);
    unmount();
    expect(document.title).toBe('Aparture');
  });

  it('stays on the waiting title across consecutive review stages', () => {
    const { rerender } = renderHook(({ stage }) => useGateTitle(stage), {
      initialProps: { stage: 'filter-review' },
    });
    rerender({ stage: 'score-review' });
    expect(document.title).toBe(GATE_WAITING_TITLE);
    rerender({ stage: 'idle' });
    expect(document.title).toBe('Aparture');
  });

  it('handles a null/undefined stage without touching the title', () => {
    renderHook(({ stage }) => useGateTitle(stage), { initialProps: { stage: null } });
    expect(document.title).toBe('Aparture');
  });
});
