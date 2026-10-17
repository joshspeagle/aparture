import { describe, it, expect, vi } from 'vitest';
import {
  MAX_EVALUATED_IDS,
  proposalGate,
  rememberEvaluated,
} from '../../../lib/profile/autoProposals.js';
import { runProposalRound } from '../../../lib/profile/runProposalRound.js';

let n = 0;
const ev = (type, briefingDate, extra = {}) => ({
  id: `e${n++}`,
  type,
  briefingDate,
  timestamp: 1,
  ...extra,
});

describe('proposalGate', () => {
  it('needs four points from at least two briefings', () => {
    const oneDay = [ev('star', 'd1'), ev('star', 'd1'), ev('dismiss', 'd1'), ev('star', 'd1')];
    expect(proposalGate(oneDay)).toMatchObject({ run: false, points: 4, briefings: 1 });
    const twoDays = [...oneDay.slice(0, 3), ev('star', 'd2')];
    expect(proposalGate(twoDays)).toMatchObject({ run: true, points: 4, briefings: 2 });
    expect(proposalGate([ev('star', 'd1'), ev('star', 'd2')])).toMatchObject({
      run: false,
      points: 2,
    });
  });

  it('weighs comments at two points and lets one answer through alone', () => {
    expect(proposalGate([ev('general-comment', 'd1'), ev('paper-comment', 'd2')]).run).toBe(true);
    expect(proposalGate([ev('answer', 'd1')])).toMatchObject({ run: true, points: 4 });
  });

  it('waits while earlier proposals are undecided, and skips events already weighed', () => {
    const events = [ev('answer', 'd1')];
    expect(proposalGate(events, { hasPendingProposal: true }).run).toBe(false);
    expect(proposalGate(events, { evaluatedIds: [events[0].id] })).toMatchObject({
      run: false,
      points: 0,
    });
  });

  it('ignores event types that carry no signal for proposals', () => {
    expect(proposalGate([ev('rejected-suggestion', 'd1'), ev('mystery', 'd2')]).points).toBe(0);
  });
});

describe('rememberEvaluated', () => {
  it('keeps the newest ids, without duplicates, up to the bound', () => {
    expect(rememberEvaluated(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    const many = Array.from({ length: MAX_EVALUATED_IDS + 5 }, (_, i) => `x${i}`);
    const out = rememberEvaluated([], many);
    expect(out).toHaveLength(MAX_EVALUATED_IDS);
    expect(out.at(-1)).toBe(many.at(-1));
  });
});

describe('runProposalRound', () => {
  const base = () => ({
    autoProposals: { evaluatedIds: [], pending: null, recordRound: vi.fn() },
    profile: { content: 'I study flows.', notes: [], rejectedSuggestions: [] },
    config: { briefingModel: 'claude-opus-5.5' },
    briefingHistory: [],
    password: 'pw',
    briefingDate: '2026-10-17',
    now: () => 99,
  });

  it('asks for proposals when the gate opens, and keeps what comes back', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        changes: [
          { id: 'c1', rationale: 'r', edit: { type: 'insert', anchor: 'flows', content: '!' } },
        ],
        noteChanges: [],
      }),
    }));
    const args = base();
    const events = [ev('answer', 'd1')];
    const out = await runProposalRound({ ...args, pendingFeedback: events, fetchImpl });
    expect(out).toMatchObject({ ran: true, found: true });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({ currentProfile: 'I study flows.', provider: 'anthropic' });
    expect(body.feedback.map((e) => e.id)).toEqual([events[0].id]);
    const round = args.autoProposals.recordRound.mock.calls[0][0];
    expect(round.pending).toMatchObject({ createdAt: 99, briefingDate: '2026-10-17' });
    expect(round.pending.response.changes).toHaveLength(1);
    expect(round.evaluatedIds).toEqual([events[0].id]);
  });

  it('a "no change" result keeps nothing pending but marks the events as weighed', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ changes: [], noteChanges: [], noChangeReason: 'Covered.' }),
    }));
    const args = base();
    const events = [ev('answer', 'd1')];
    expect(await runProposalRound({ ...args, pendingFeedback: events, fetchImpl })).toMatchObject({
      ran: true,
      found: false,
    });
    expect(args.autoProposals.recordRound).toHaveBeenCalledWith({
      pending: null,
      evaluatedIds: [events[0].id],
    });
  });

  it('makes no call when the gate stays shut', async () => {
    const fetchImpl = vi.fn();
    const out = await runProposalRound({
      ...base(),
      pendingFeedback: [ev('star', 'd1')],
      fetchImpl,
    });
    expect(out.ran).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
