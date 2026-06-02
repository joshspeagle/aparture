import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfile } from '../../../hooks/useProfile.js';

describe('useProfile', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes with empty profile when no state exists', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    expect(result.current.profile.content).toBe('');
    expect(result.current.profile.revisions).toEqual([]);
    expect(result.current.migrationNotice).toBeNull();
  });

  it('migrates Phase 1 profile-md on first load', () => {
    window.localStorage.setItem('aparture-profile-md', 'I study flows.');
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    expect(result.current.profile.content).toBe('I study flows.');
  });

  it('updateProfile writes content and appends a manual revision', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('My new profile');
    });
    expect(result.current.profile.content).toBe('My new profile');
    expect(result.current.profile.revisions).toHaveLength(1);
    expect(result.current.profile.revisions[0].source).toBe('manual');
  });

  it('saveSuggested writes content, cutoff, and a suggested revision', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.saveSuggested('Revised profile', 1700000000000, 'rationale text');
    });
    expect(result.current.profile.content).toBe('Revised profile');
    expect(result.current.profile.lastFeedbackCutoff).toBe(1700000000000);
    expect(result.current.profile.revisions[0].source).toBe('suggested');
    expect(result.current.profile.revisions[0].rationale).toBe('rationale text');
  });

  it('revertToRevision restores earlier content with a new manual revision entry', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('v1');
    });
    act(() => {
      result.current.updateProfile('v2');
    });
    // revisions[0] is the most recent revision, archived when v1 was overwritten
    // by v2. Its content field holds 'v1' — the state we want to revert to.
    const v1RevisionId = result.current.profile.revisions[0].createdAt;
    act(() => {
      result.current.revertToRevision(v1RevisionId);
    });
    expect(result.current.profile.content).toBe('v1');
  });

  it('bounds revisions[] to 20 entries', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    for (let i = 0; i < 25; i += 1) {
      act(() => {
        result.current.updateProfile(`revision ${i}`);
      });
    }
    expect(result.current.profile.revisions.length).toBeLessThanOrEqual(20);
  });

  it('surfaces migration notice when Phase 1 profile conflicts with scoringCriteria', () => {
    window.localStorage.setItem('aparture-profile-md', 'new content');
    const { result } = renderHook(() => useProfile({ scoringCriteria: 'old content' }));
    expect(result.current.migrationNotice).not.toBeNull();
    expect(result.current.migrationNotice.type).toBe('phase1-conflict');
  });

  it('dismisses migration notice via dismissMigrationNotice', () => {
    window.localStorage.setItem('aparture-profile-md', 'a');
    const { result } = renderHook(() => useProfile({ scoringCriteria: 'b' }));
    expect(result.current.migrationNotice).not.toBeNull();
    act(() => {
      result.current.dismissMigrationNotice();
    });
    expect(result.current.migrationNotice).toBeNull();
  });

  // Regression: clicking "Clear history" empties revisions[], which re-armed an
  // old Phase 1.5 recovery heuristic. With the legacy `aparture-profile-md` key
  // already cleaned up, that heuristic used to re-run migration and overwrite
  // the user's edited profile with config.scoringCriteria. The profile content
  // must survive clearHistory + reload.
  it('preserves edited profile content after clearHistory and a remount', () => {
    const config = { scoringCriteria: 'default scoring criteria' };

    // 1. User edits their profile away from the default scoringCriteria.
    const first = renderHook(() => useProfile(config));
    act(() => {
      first.result.current.updateProfile('My carefully edited research profile');
    });
    expect(first.result.current.profile.content).toBe('My carefully edited research profile');
    expect(first.result.current.profile.revisions.length).toBeGreaterThan(0);

    // 2. User clicks "Clear history" — revisions become [].
    act(() => {
      first.result.current.clearHistory();
    });
    expect(first.result.current.profile.revisions).toEqual([]);
    expect(first.result.current.profile.content).toBe('My carefully edited research profile');
    first.unmount();

    // Sanity: the legacy Phase 1 key is gone, which is exactly the condition
    // that previously triggered the destructive recovery path.
    expect(window.localStorage.getItem('aparture-profile-md')).toBeNull();

    // 3. Re-mount the hook (simulates a page reload). Content must be intact and
    // must NOT have been replaced by config.scoringCriteria.
    const second = renderHook(() => useProfile(config));
    expect(second.result.current.profile.content).toBe('My carefully edited research profile');
    expect(second.result.current.profile.content).not.toBe('default scoring criteria');
  });

  // The genuine Phase 1.5 recovery (legacy key still present) still runs, and
  // the pre-migration content is stashed into revisions rather than discarded.
  it('still runs Phase 1.5 recovery when the legacy key exists, preserving prior content', () => {
    // Corrupted state: revisions empty, content === a stale default that does
    // not match the real config, legacy key still present.
    window.localStorage.setItem(
      'aparture-profile',
      JSON.stringify({
        content: 'stale default content',
        updatedAt: 1,
        lastFeedbackCutoff: 0,
        revisions: [],
      })
    );
    window.localStorage.setItem('aparture-profile-md', 'the real phase-1 profile');

    const { result } = renderHook(() =>
      useProfile({ scoringCriteria: 'current real scoring criteria' })
    );

    // Migration recovered the Phase 1 content...
    expect(result.current.profile.content).toBe('the real phase-1 profile');
    // ...and the pre-migration content was preserved, not discarded.
    expect(
      result.current.profile.revisions.some((r) => r.content === 'stale default content')
    ).toBe(true);
  });
});
