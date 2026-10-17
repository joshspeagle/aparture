import { describe, it, expect } from 'vitest';
import {
  rationaleCitesPaper,
  rationaleQuotesText,
  resolveSuggestionOutcome,
} from '../../../lib/profile/suggestOutcome.js';

const star = {
  id: 'star',
  type: 'star',
  arxivId: '2504.01234',
  paperTitle: 'Conditional Mean Flows for Simulation-Based Inference',
};
const dismiss = {
  id: 'dismiss',
  type: 'dismiss',
  arxivId: '2504.02345',
  paperTitle: 'Head pruning',
};
const uncitedStar = { id: 'uncited', type: 'star', arxivId: '2504.09999', paperTitle: 'Other' };
const note = {
  id: 'note',
  type: 'scoped-feedback',
  scope: { kind: 'score-review' },
  text: 'Scoring was too compressed, everything landed at six or seven.',
};
const general = { id: 'general', type: 'general-comment', text: 'Briefing nailed it.' };

const change = (id, rationale) => ({
  id,
  rationale,
  edit: { type: 'insert', anchor: 'x', content: 'y' },
});

describe('rationaleCitesPaper', () => {
  it('matches the arXiv id with or without a version suffix or prefix', () => {
    expect(rationaleCitesPaper('Based on the star on 2504.01234.', star)).toBe(true);
    expect(rationaleCitesPaper('See arXiv:2504.01234v2 for details', star)).toBe(true);
    expect(rationaleCitesPaper('Based on 2504.01234v3', { ...star, arxivId: '2504.01234v1' })).toBe(
      true
    );
  });

  it('does not match a different id that merely shares a prefix', () => {
    expect(rationaleCitesPaper('Based on 2504.012345', star)).toBe(false);
    expect(rationaleCitesPaper('Based on 12504.01234', star)).toBe(false);
  });

  it('matches the full title, ignoring case and quotes', () => {
    expect(
      rationaleCitesPaper(
        'You starred “Conditional mean flows for simulation-based inference”.',
        star
      )
    ).toBe(true);
    // Short titles are too ambiguous to match by text.
    expect(rationaleCitesPaper('head pruning came up', dismiss)).toBe(false);
  });
});

describe('rationaleQuotesText', () => {
  it('matches a short note quoted whole, or any five-word run of a longer one', () => {
    expect(rationaleQuotesText('Per your comment "Briefing nailed it."', general.text)).toBe(true);
    expect(
      rationaleQuotesText(
        'Your note said everything landed at six or seven, so the rubric was tightened.',
        note.text
      )
    ).toBe(true);
    expect(rationaleQuotesText('Tightened the rubric.', note.text)).toBe(false);
  });
});

describe('resolveSuggestionOutcome', () => {
  const sentEvents = [star, dismiss, uncitedStar, note, general];

  it('incorporates nothing when no change was accepted (reject-all / no-change)', () => {
    const out = resolveSuggestionOutcome({
      sentEvents,
      changes: [change('c1', 'Based on 2504.01234')],
      acceptedIds: [],
    });
    expect(out.accepted).toEqual([]);
    expect(out.rejected.map((c) => c.id)).toEqual(['c1']);
    expect(out.incorporatedEventIds).toEqual([]);
    expect(
      resolveSuggestionOutcome({ sentEvents, changes: [], acceptedIds: [] }).incorporatedEventIds
    ).toEqual([]);
  });

  it('incorporates paper events cited by an accepted change; rejected-only and uncited ones stay pending', () => {
    const out = resolveSuggestionOutcome({
      sentEvents,
      changes: [
        change('c1', 'Based on the star on 2504.01234, added flows.'),
        change('c2', 'The dismiss on 2504.02345 suggests narrowing.'),
      ],
      acceptedIds: new Set(['c1']),
    });
    expect(out.incorporatedEventIds).toContain('star');
    expect(out.incorporatedEventIds).not.toContain('dismiss'); // behind the rejected change
    expect(out.incorporatedEventIds).not.toContain('uncited'); // never cited
  });

  it('notes count once a change is accepted, unless only a rejected change quotes them', () => {
    const out = resolveSuggestionOutcome({
      sentEvents,
      changes: [
        change('c1', 'Based on 2504.01234, added flows.'),
        change('c2', 'Your note says everything landed at six or seven; loosened scoring.'),
      ],
      acceptedIds: ['c1'],
    });
    expect(out.incorporatedEventIds).toContain('general'); // unquoted, a change was accepted
    expect(out.incorporatedEventIds).not.toContain('note'); // quoted only by the rejected c2
  });

  it('a note quoted by an accepted change is incorporated even if a rejected one quotes it too', () => {
    const out = resolveSuggestionOutcome({
      sentEvents: [note],
      changes: [
        change('c1', 'Everything landed at six or seven, so the rubric now spreads scores.'),
        change('c2', 'Everything landed at six or seven; also dropped a topic.'),
      ],
      acceptedIds: ['c1'],
    });
    expect(out.incorporatedEventIds).toEqual(['note']);
  });
});
