import { describe, it, expect } from 'vitest';
import { docsToEvents } from '../../../../lib/briefing/v2/feedbackDocs.js';

const NOW = '2026-10-18T06:00:00Z';

const paperDoc = (data) => ({
  id: `2026-10-17__paper__2610.00001`,
  data: { date: '2026-10-17', kind: 'paper', key: '2610.00001', id: '2610.00001', ...data },
});

describe('docsToEvents', () => {
  it('turns page state into change events', () => {
    const { events } = docsToEvents(
      [
        paperDoc({
          star: true,
          knew: true,
          comment: 'Want SBI baselines.',
          updatedAt: '2026-10-17T13:00:00Z',
        }),
        {
          id: '2026-10-17__answer__q1',
          data: {
            date: '2026-10-17',
            kind: 'answer',
            key: 'q1',
            question: 'q1',
            answer: 'Only with code',
          },
        },
        {
          id: '2026-10-17__proposal__p1',
          data: {
            date: '2026-10-17',
            kind: 'proposal',
            key: 'p1',
            proposal: 'p1',
            decision: 'accept',
          },
        },
        {
          id: '2026-10-17__general__note',
          data: { date: '2026-10-17', kind: 'general', comment: 'More dynamics.' },
        },
      ],
      {},
      NOW
    );
    expect(events.map((e) => [e.type, e.id ?? e.question ?? e.proposal ?? null])).toEqual(
      expect.arrayContaining([
        ['star', '2610.00001'],
        ['already-knew', '2610.00001'],
        ['comment', '2610.00001'],
        ['answer', 'q1'],
        ['proposal-decision', 'p1'],
        ['comment', null],
      ])
    );
    expect(events.every((e) => e.source === 'page' && e.date === '2026-10-17')).toBe(true);
  });

  it('is idempotent across re-ingestion and records reversals', () => {
    const first = docsToEvents([paperDoc({ star: true })], {}, NOW);
    const again = docsToEvents([paperDoc({ star: true })], first.cursor, NOW);
    expect(again.events).toEqual([]);
    const flipped = docsToEvents([paperDoc({ star: false, dismiss: true })], first.cursor, NOW);
    expect(flipped.events.map((e) => e.type).sort()).toEqual(['dismiss', 'unstar']);
  });

  it('skips documents without a date or a known kind', () => {
    const { events } = docsToEvents(
      [
        { id: 'x', data: { kind: 'paper', star: true } },
        { id: 'y', data: { date: '2026-10-17', kind: 'mystery', star: true } },
      ],
      {},
      NOW
    );
    expect(events).toEqual([]);
  });
});
