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
});
