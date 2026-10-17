// Editorial notes live beside the research profile: in the working slot, in
// each named snapshot, and in every revision, so revert and profile
// switches carry them.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfile } from '../../../hooks/useProfile.js';

const note = (id, scope, text) => ({ id, scope, text, source: 'manual', createdAt: 1 });

beforeEach(() => window.localStorage.clear());

const setUp = () => {
  const hook = renderHook(() => useProfile({ scoringCriteria: '' }));
  act(() => hook.result.current.updateProfile('I study flows.'));
  return hook;
};

describe('useProfile — editorial notes', () => {
  it('starts with none, and reads an older stored profile as having none', () => {
    window.localStorage.setItem(
      'aparture-profile',
      JSON.stringify({ content: 'Old.', updatedAt: 1, lastFeedbackCutoff: 0, revisions: [] })
    );
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    expect(result.current.profile.notes).toEqual([]);
  });

  it('updateNotes saves the notes and archives the previous ones in a revision', () => {
    const { result } = setUp();
    act(() => result.current.updateNotes([note('a', 'selection', 'Prefers released code.')]));
    expect(result.current.profile.notes.map((n) => n.text)).toEqual(['Prefers released code.']);
    expect(result.current.profile.content).toBe('I study flows.');
    const [rev] = result.current.profile.revisions;
    expect(rev).toMatchObject({ source: 'manual', content: 'I study flows.', notes: [] });
    const stored = JSON.parse(window.localStorage.getItem('aparture-profile'));
    expect(stored.notes).toHaveLength(1);
  });

  it('an unchanged note list records nothing', () => {
    const { result } = setUp();
    const notes = [note('a', 'selection', 'Prefers released code.')];
    act(() => result.current.updateNotes(notes));
    const count = result.current.profile.revisions.length;
    act(() => result.current.updateNotes(notes));
    expect(result.current.profile.revisions).toHaveLength(count);
  });

  it('revert puts back the notes from before the change', () => {
    const { result } = setUp();
    act(() => result.current.updateNotes([note('a', 'selection', 'First.')]));
    act(() => result.current.updateNotes([note('a', 'selection', 'Second.')]));
    const target = result.current.profile.revisions[0].createdAt;
    act(() => result.current.revertToRevision(target));
    expect(result.current.profile.notes.map((n) => n.text)).toEqual(['First.']);
  });

  it('each named profile keeps its own notes', () => {
    const { result } = setUp();
    act(() => result.current.saveAs('A'));
    act(() => result.current.updateNotes([note('a', 'writing', 'Lead with results.')]));
    act(() => result.current.saveAs('B'));
    act(() => result.current.updateNotes([]));
    act(() => result.current.switchTo('A'));
    expect(result.current.profile.notes.map((n) => n.text)).toEqual(['Lead with results.']);
    act(() => result.current.switchTo('B'));
    expect(result.current.profile.notes).toEqual([]);
  });

  it('an accepted suggestion that only changes notes still makes a revision', () => {
    const { result } = setUp();
    act(() =>
      result.current.recordSuggestionOutcome({
        kind: 'applied',
        content: 'I study flows.',
        notes: [note('n', 'selection', 'Benchmark-only papers are adjacent.')],
        rationale: '• cites 2610.00001',
        accepted: [{ id: 'note:n1', rationale: 'r', note: { action: 'add' } }],
        rejected: [
          {
            id: 'note:n2',
            rationale: 'r2',
            note: { action: 'add', scope: 'podcast', text: 'Slower.' },
          },
        ],
        appliedAt: 50,
      })
    );
    expect(result.current.profile.notes).toHaveLength(1);
    expect(result.current.profile.revisions[0]).toMatchObject({ source: 'suggested', notes: [] });
    // The rejected note change is remembered for the next suggestion.
    expect(result.current.profile.rejectedSuggestions[0]).toMatchObject({
      note: { action: 'add', scope: 'podcast', text: 'Slower.' },
    });
  });
});
