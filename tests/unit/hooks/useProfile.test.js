import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfile } from '../../../hooks/useProfile.js';
import {
  BLANK_PROFILE_TEMPLATE,
  STARTER_TEMPLATES,
} from '../../../lib/profile/starterTemplates.js';

describe('useProfile', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('recordSuggestionOutcome: an applied outcome saves content as a suggested revision at appliedAt', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('base profile');
    });
    const cutoffBefore = result.current.profile.lastFeedbackCutoff;
    act(() => {
      result.current.recordSuggestionOutcome({
        kind: 'applied',
        content: 'base profile, revised',
        rationale: '• because',
        accepted: [{ id: 'c1' }],
        rejected: [],
        appliedAt: 1_800_000_000_000,
      });
    });
    expect(result.current.profile.content).toBe('base profile, revised');
    expect(result.current.profile.revisions[0]).toMatchObject({
      content: 'base profile',
      source: 'suggested',
      rationale: '• because',
      createdAt: 1_800_000_000_000,
    });
    // Incorporation is per event now; the legacy cutoff is not advanced.
    expect(result.current.profile.lastFeedbackCutoff).toBe(cutoffBefore);
    // Written through to the active named profile like any committed change.
    expect(result.current.profiles.Default.content).toBe('base profile, revised');
  });

  it('recordSuggestionOutcome: rejected and no-change outcomes leave content and history alone', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('base profile');
    });
    const revisionsBefore = result.current.profile.revisions.length;
    act(() => {
      result.current.recordSuggestionOutcome({
        kind: 'rejected',
        content: 'base profile',
        accepted: [],
        rejected: [{ id: 'c1' }],
      });
      result.current.recordSuggestionOutcome({ kind: 'no-change', noChangeReason: 'covered' });
    });
    expect(result.current.profile.content).toBe('base profile');
    // The old flow wrote a bogus "No changes warranted" revision here.
    expect(result.current.profile.revisions).toHaveLength(revisionsBefore);
  });

  it('recordSuggestionOutcome remembers rejected changes and counts accepted vs rejected (P1-5)', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('base profile');
    });
    const change = (id, anchor) => ({
      id,
      rationale: `rationale ${id}`,
      edit: { type: 'replace', anchor, content: `${anchor}!` },
    });
    act(() => {
      result.current.recordSuggestionOutcome({
        kind: 'applied',
        content: 'base profile!',
        accepted: [change('c1', 'profile')],
        rejected: [change('c2', 'base')],
        appliedAt: 1000,
      });
    });
    act(() => {
      result.current.recordSuggestionOutcome({
        kind: 'rejected',
        content: 'base profile!',
        accepted: [],
        rejected: [change('c3', 'base'), change('c4', 'profile!')],
        appliedAt: 2000,
      });
    });
    act(() => {
      result.current.recordSuggestionOutcome({ kind: 'no-change', appliedAt: 3000 });
    });

    const { profile } = result.current;
    expect(profile.suggestionStats).toEqual({ accepted: 1, rejected: 3, noChange: 1 });
    // Newest first, with the decision time.
    expect(profile.rejectedSuggestions.map((r) => r.rationale)).toEqual([
      'rationale c3',
      'rationale c4',
      'rationale c2',
    ]);
    expect(profile.rejectedSuggestions[0]).toEqual({
      rationale: 'rationale c3',
      edit: { type: 'replace', anchor: 'base', content: 'base!' },
      rejectedAt: 2000,
    });
    // The applied revision records how many of its changes were accepted.
    expect(profile.revisions[0]).toMatchObject({ acceptedCount: 1, rejectedCount: 1 });
    // Memory-only outcomes are persisted too.
    const stored = JSON.parse(window.localStorage.getItem('aparture-profile'));
    expect(stored.suggestionStats).toEqual({ accepted: 1, rejected: 3, noChange: 1 });
    expect(stored.rejectedSuggestions).toHaveLength(3);
  });

  it('caps remembered rejections at 20 and clips long edit text', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    const long = 'x'.repeat(900);
    act(() => {
      result.current.recordSuggestionOutcome({
        kind: 'rejected',
        accepted: [],
        rejected: Array.from({ length: 25 }, (_, i) => ({
          id: `c${i}`,
          rationale: long,
          edit: { type: 'insert', anchor: 'a', content: long },
        })),
        appliedAt: 1,
      });
    });
    const { rejectedSuggestions } = result.current.profile;
    expect(rejectedSuggestions).toHaveLength(20);
    expect(rejectedSuggestions[0].edit.content.length).toBeLessThan(long.length);
    expect(rejectedSuggestions[0].rationale.endsWith('…')).toBe(true);
  });

  it('updateProfile records the source and rationale the caller gives', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('template text', {
        source: 'template',
        rationale: 'Started from the "Focused" template',
      });
    });
    expect(result.current.profile.revisions[0]).toMatchObject({
      content: '',
      source: 'template',
      rationale: 'Started from the "Focused" template',
    });
  });

  it('revertToRevision restores earlier content with a new revert revision entry', () => {
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
    // The revert is its own change: it archives v2 and says what it undid.
    expect(result.current.profile.revisions[0]).toMatchObject({ content: 'v2', source: 'revert' });
    expect(result.current.profile.revisions[0].rationale).toMatch(
      /^Reverted to the text from before the \d{4}-\d{2}-\d{2} change$/
    );
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

  it('keeps the in-memory profile edit when localStorage quota is exceeded (no crash mid-click)', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });
    // Pre-fix this threw out of the state updater, crashing the interaction
    // and losing the edit.
    expect(() => {
      act(() => {
        result.current.updateProfile('edited under quota pressure');
      });
    }).not.toThrow();
    expect(result.current.profile.content).toBe('edited under quota pressure');
    expect(warn).toHaveBeenCalled();
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

  // Regression: clicking "Clear history" empties revisions[], which used to
  // re-arm an obsolete "Phase 1.5 recovery" heuristic that re-ran migration on
  // an already-stored profile and overwrote the user's edited content with
  // config.scoringCriteria. That heuristic has been removed; the profile
  // content must survive clearHistory + reload.
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

    // Sanity: the legacy Phase 1 key was cleaned up on first mount.
    expect(window.localStorage.getItem('aparture-profile-md')).toBeNull();

    // 3. Re-mount the hook (simulates a page reload). Content must be intact and
    // must NOT have been replaced by config.scoringCriteria.
    const second = renderHook(() => useProfile(config));
    expect(second.result.current.profile.content).toBe('My carefully edited research profile');
    expect(second.result.current.profile.content).not.toBe('default scoring criteria');
  });

  // Regression for the neutral-defaults change (2026-07): a user's saved
  // profile must survive a DEFAULT_CONFIG.scoringCriteria change. The stored
  // aparture-profile blob wins over whatever scoringCriteria the (new) default
  // config passes in.
  it('a saved profile survives a change to the shipped default scoringCriteria', () => {
    const first = renderHook(() => useProfile({ scoringCriteria: 'old shipped default' }));
    act(() => {
      first.result.current.updateProfile('my personal research profile');
    });
    first.unmount();

    const second = renderHook(() => useProfile({ scoringCriteria: 'NEW shipped default' }));
    expect(second.result.current.profile.content).toBe('my personal research profile');
  });
});

describe('useProfile — corrupt stored profile repair (C8)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces a corrupt aparture-profile blob on mount (one-time repair)', () => {
    window.localStorage.setItem('aparture-profile', '{not-valid-json!!');
    window.localStorage.setItem('aparture-profile-md', 'I study flows.');

    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));

    // Initializer fell back to the Phase-1 migration…
    expect(result.current.profile.content).toBe('I study flows.');
    // …and the mount effect REPLACED the corrupt blob, so the next load
    // parses cleanly instead of re-migrating forever.
    const stored = JSON.parse(window.localStorage.getItem('aparture-profile'));
    expect(stored.content).toBe('I study flows.');
  });

  it('backs up the corrupt blob under aparture-profile-corrupt-backup before repairing', () => {
    window.localStorage.setItem('aparture-profile', '{not-valid-json!!');

    renderHook(() => useProfile({ scoringCriteria: 'seed' }));

    // The unparseable original is stashed, not destroyed — corruption is
    // often partial and the prose/revisions may be recoverable by hand.
    expect(window.localStorage.getItem('aparture-profile-corrupt-backup')).toBe(
      '{not-valid-json!!'
    );
    expect(JSON.parse(window.localStorage.getItem('aparture-profile')).content).toBe('seed');
  });

  it('treats a parseable-but-unusable blob ("null") as corrupt instead of crashing', () => {
    // JSON.parse('null') succeeds, so the old JSON-validity check let this
    // through to `profile.content` — a TypeError out of the useState
    // initializer, i.e. a render crash loop with no repair path.
    window.localStorage.setItem('aparture-profile', 'null');

    let result;
    expect(() => {
      ({ result } = renderHook(() => useProfile({ scoringCriteria: 'seed' })));
    }).not.toThrow();

    expect(result.current.profile.content).toBe('seed');
    expect(window.localStorage.getItem('aparture-profile-corrupt-backup')).toBe('null');
    expect(JSON.parse(window.localStorage.getItem('aparture-profile')).content).toBe('seed');
  });

  it('repairs a corrupt aparture-profiles map on disk instead of reseeding in memory forever', () => {
    window.localStorage.setItem(
      'aparture-profile',
      JSON.stringify({ content: 'working', updatedAt: 1, lastFeedbackCutoff: 0, revisions: [] })
    );
    window.localStorage.setItem('aparture-profiles', '{oops');

    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));

    expect(result.current.activeProfileName).toBe('Default');
    // Pre-fix, the truthy-but-corrupt blob survived on disk (the mount effect
    // only wrote when the key was MISSING), so every load reseeded in memory.
    expect(JSON.parse(window.localStorage.getItem('aparture-profiles')).Default.content).toBe(
      'working'
    );
  });

  it('does NOT rewrite a valid stored profile on mount', () => {
    const valid = {
      content: 'hand-written profile',
      updatedAt: 123,
      lastFeedbackCutoff: 0,
      revisions: [],
    };
    window.localStorage.setItem('aparture-profile', JSON.stringify(valid));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));

    expect(result.current.profile.content).toBe('hand-written profile');
    const profileWrites = setItemSpy.mock.calls.filter(([key]) => key === 'aparture-profile');
    expect(profileWrites).toHaveLength(0);
  });
});

describe('useProfile — named profiles', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('migrates the existing profile as "Default" on first load', () => {
    window.localStorage.setItem(
      'aparture-profile',
      JSON.stringify({
        content: 'existing content',
        updatedAt: 1700000000000,
        lastFeedbackCutoff: 0,
        revisions: [],
      })
    );
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    expect(result.current.activeProfileName).toBe('Default');
    expect(result.current.profiles.Default.content).toBe('existing content');
    expect(JSON.parse(window.localStorage.getItem('aparture-profiles')).Default.content).toBe(
      'existing content'
    );
    expect(window.localStorage.getItem('aparture-active-profile')).toBe('Default');
  });

  it('saveAs snapshots the current content under a new name and makes it active', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('cosmology profile');
    });
    act(() => {
      result.current.saveAs('Cosmology');
    });
    expect(result.current.activeProfileName).toBe('Cosmology');
    expect(result.current.profiles.Cosmology.content).toBe('cosmology profile');
    // The working slot is untouched by a snapshot save.
    expect(result.current.profile.content).toBe('cosmology profile');
  });

  it('switchTo loads the snapshot into the working slot and snapshots the outgoing content', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('profile A');
    });
    act(() => {
      result.current.saveAs('A');
    });
    // Fork B from A BEFORE editing: committed edits write through to the
    // active snapshot, so editing first would (correctly) change A too.
    act(() => {
      result.current.saveAs('B');
    });
    act(() => {
      result.current.updateProfile('profile B, edited');
    });
    act(() => {
      result.current.switchTo('A');
    });
    expect(result.current.activeProfileName).toBe('A');
    expect(result.current.profile.content).toBe('profile A');
    // Outgoing edits were snapshotted back into B, not lost.
    expect(result.current.profiles.B.content).toBe('profile B, edited');
    // Pre-switch content is also archived as a revision.
    expect(result.current.profile.revisions[0].content).toBe('profile B, edited');
    expect(result.current.profile.revisions[0].source).toBe('switch');
  });

  it('switchTo to a nonexistent name is a no-op', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('keep me');
    });
    act(() => {
      result.current.switchTo('does-not-exist');
    });
    expect(result.current.profile.content).toBe('keep me');
  });

  it('deleteProfile removes a non-active snapshot without touching the working slot', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('current');
    });
    act(() => {
      result.current.saveAs('Other');
    });
    act(() => {
      result.current.saveAs('Active');
    });
    act(() => {
      result.current.deleteProfile('Other');
    });
    expect(result.current.profiles.Other).toBeUndefined();
    expect(result.current.activeProfileName).toBe('Active');
    expect(result.current.profile.content).toBe('current');
  });

  it('deleting the active profile switches to a remaining snapshot', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('profile A');
    });
    act(() => {
      result.current.saveAs('A');
    });
    act(() => {
      result.current.updateProfile('profile B');
    });
    act(() => {
      result.current.saveAs('B');
    });
    act(() => {
      result.current.deleteProfile('B');
    });
    expect(result.current.profiles.B).toBeUndefined();
    expect(result.current.activeProfileName).toBe('Default');
    // Working slot now carries the remaining snapshot's content; the old
    // content is recoverable from revisions.
    expect(result.current.profile.content).toBe(result.current.profiles.Default.content);
  });

  it('deleting the last remaining profile re-seeds Default from current content', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('only content');
    });
    // Fresh state has only "Default"; snapshot current content first so the
    // delete removes the last entry.
    act(() => {
      result.current.deleteProfile('Default');
    });
    expect(result.current.activeProfileName).toBe('Default');
    expect(result.current.profiles.Default.content).toBe('only content');
    expect(result.current.profile.content).toBe('only content');
  });

  it('renameProfile moves the snapshot and follows the active pointer', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('c');
    });
    act(() => {
      result.current.saveAs('OldName');
    });
    act(() => {
      result.current.renameProfile('OldName', 'NewName');
    });
    expect(result.current.profiles.OldName).toBeUndefined();
    expect(result.current.profiles.NewName.content).toBe('c');
    expect(result.current.activeProfileName).toBe('NewName');
  });

  it('renameProfile refuses to clobber an existing name', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.saveAs('A');
    });
    act(() => {
      result.current.renameProfile('A', 'Default');
    });
    expect(result.current.profiles.A).toBeDefined();
    expect(result.current.activeProfileName).toBe('A');
  });

  it('saveAs refuses to clobber a DIFFERENT existing profile', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('profile A');
    });
    act(() => {
      result.current.saveAs('A');
    });
    act(() => {
      result.current.updateProfile('something else entirely');
    });
    // Attempt to save the new content over the OTHER snapshot ("Default").
    // Snapshot contents are never revision-archived, so a clobber here would
    // be silent, irreversible loss.
    act(() => {
      result.current.saveAs('Default');
    });
    // Default keeps what was committed under it before "Save as A" — not the
    // empty first-load seed (the stale-snapshot bug) and not the refused
    // overwrite.
    expect(result.current.profiles.Default.content).toBe('profile A');
    expect(result.current.activeProfileName).toBe('A');
  });

  it('saveAs under the ACTIVE name updates its own snapshot (still allowed)', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.saveAs('Mine');
    });
    act(() => {
      result.current.updateProfile('updated content');
    });
    act(() => {
      result.current.saveAs('Mine');
    });
    expect(result.current.profiles.Mine.content).toBe('updated content');
    expect(result.current.activeProfileName).toBe('Mine');
  });

  it('switchTo leaves the stored map and pointer untouched when the working-slot write fails', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('profile A');
    });
    act(() => {
      result.current.saveAs('A');
    });
    // Fork first, then edit (edits write through to the active snapshot).
    act(() => {
      result.current.saveAs('B');
    });
    act(() => {
      result.current.updateProfile('profile B');
    });

    // Quota failure ONLY on the working-slot key; map/pointer writes go
    // through. Pre-fix, switchTo wrote the pointer anyway, leaving disk in a
    // pointer-ahead-of-content state: after a reload, one more switch would
    // snapshot the stale working content over the target profile's entry.
    const realSetItem = Storage.prototype.setItem;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'aparture-profile') {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return realSetItem.call(this, key, value);
    });

    act(() => {
      result.current.switchTo('A');
    });

    // In-memory switch proceeds for the session…
    expect(result.current.activeProfileName).toBe('A');
    expect(result.current.profile.content).toBe('profile A');
    // …but disk stays fully pre-switch-consistent: pointer still on B,
    // working slot still holding B's content.
    expect(window.localStorage.getItem('aparture-active-profile')).toBe('B');
    expect(JSON.parse(window.localStorage.getItem('aparture-profile')).content).toBe('profile B');
    expect(warn).toHaveBeenCalled();
  });

  it('named profiles persist across a remount', () => {
    const first = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      first.result.current.updateProfile('persisted content');
    });
    act(() => {
      first.result.current.saveAs('Persisted');
    });
    first.unmount();

    const second = renderHook(() => useProfile({ scoringCriteria: '' }));
    expect(second.result.current.activeProfileName).toBe('Persisted');
    expect(second.result.current.profiles.Persisted.content).toBe('persisted content');
    // The pipeline read path is unchanged.
    expect(second.result.current.profile.content).toBe('persisted content');
  });
});

// P0-3 regression: "Save as…" then switching back used to load a stale
// snapshot — on a fresh install, the bracketed first-run template — over the
// user's real profile, because committed edits never reached the active
// profile's snapshot and saveAs didn't refresh the outgoing one.
describe('useProfile — named profiles never lose committed content (P0-3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const templateText = STARTER_TEMPLATES[0].profileText;

  it("audit scenario: template + 2 accepted suggestions, Save as, edit, switch back → Default keeps the user's profile", () => {
    // Fresh install: the working slot (and the seeded "Default" snapshot)
    // start as the neutral bracketed template.
    const first = renderHook(() => useProfile({ scoringCriteria: BLANK_PROFILE_TEMPLATE }));
    const { result } = first;
    expect(result.current.profiles.Default.content).toBe(BLANK_PROFILE_TEMPLATE);

    // 1. Apply a starter template (StarterTemplatePicker calls updateProfile).
    act(() => {
      result.current.updateProfile(templateText);
    });
    // 2. Accept two suggested changes.
    act(() => {
      result.current.saveSuggested(`${templateText}\nFirst accepted change.`, 0, 'r1');
    });
    act(() => {
      result.current.saveSuggested(
        `${templateText}\nFirst accepted change.\nSecond accepted change.`,
        0,
        'r2'
      );
    });
    const realProfile = result.current.profile.content;
    // Write-through: the active snapshot tracks every committed change.
    expect(result.current.profiles.Default.content).toBe(realProfile);

    // 3. Save as "Exoplanets" and edit it.
    act(() => {
      result.current.saveAs('Exoplanets');
    });
    act(() => {
      result.current.updateProfile('I study exoplanet atmospheres.');
    });
    expect(result.current.profiles.Exoplanets.content).toBe('I study exoplanet atmospheres.');

    // 4. Switch back to Default.
    act(() => {
      result.current.switchTo('Default');
    });
    expect(result.current.activeProfileName).toBe('Default');
    expect(result.current.profile.content).toBe(realProfile);
    expect(result.current.profile.content).not.toBe(BLANK_PROFILE_TEMPLATE);
    // The Exoplanets edit was snapshotted on the way out, not lost.
    expect(result.current.profiles.Exoplanets.content).toBe('I study exoplanet atmospheres.');

    // And the persisted map agrees, so a reload can't resurrect the template.
    const stored = JSON.parse(window.localStorage.getItem('aparture-profiles'));
    expect(stored.Default.content).toBe(realProfile);
    expect(stored.Exoplanets.content).toBe('I study exoplanet atmospheres.');
    first.unmount();

    const second = renderHook(() => useProfile({ scoringCriteria: BLANK_PROFILE_TEMPLATE }));
    expect(second.result.current.profile.content).toBe(realProfile);
    act(() => {
      second.result.current.switchTo('Exoplanets');
    });
    act(() => {
      second.result.current.switchTo('Default');
    });
    expect(second.result.current.profile.content).toBe(realProfile);
  });

  it('every committed change (manual, suggested, revert) writes through to the active snapshot', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.saveAs('Mine');
    });

    act(() => {
      result.current.updateProfile('manual edit');
    });
    expect(result.current.profiles.Mine.content).toBe('manual edit');

    act(() => {
      result.current.saveSuggested('suggested edit', 0, 'because');
    });
    expect(result.current.profiles.Mine.content).toBe('suggested edit');

    const manualRevision = result.current.profile.revisions.find(
      (r) => r.content === 'manual edit'
    );
    act(() => {
      result.current.revertToRevision(manualRevision.createdAt);
    });
    expect(result.current.profile.content).toBe('manual edit');
    expect(result.current.profiles.Mine.content).toBe('manual edit');
    expect(JSON.parse(window.localStorage.getItem('aparture-profiles')).Mine.content).toBe(
      'manual edit'
    );
  });

  it('saveAs repairs a stale outgoing snapshot persisted before write-through existed', () => {
    // A map written by the old code: Default still holds its first-load
    // seed while the working slot holds the user's real profile.
    window.localStorage.setItem(
      'aparture-profile',
      JSON.stringify({
        content: 'my real profile',
        updatedAt: 2,
        lastFeedbackCutoff: 0,
        revisions: [],
      })
    );
    window.localStorage.setItem(
      'aparture-profiles',
      JSON.stringify({ Default: { content: BLANK_PROFILE_TEMPLATE, updatedAt: 1 } })
    );
    window.localStorage.setItem('aparture-active-profile', 'Default');

    const { result } = renderHook(() => useProfile({ scoringCriteria: BLANK_PROFILE_TEMPLATE }));
    act(() => {
      result.current.saveAs('Fork');
    });
    act(() => {
      result.current.switchTo('Default');
    });
    expect(result.current.profile.content).toBe('my real profile');
  });

  it('does not touch the named-profile map when the working-slot write fails', () => {
    const { result } = renderHook(() => useProfile({ scoringCriteria: '' }));
    act(() => {
      result.current.updateProfile('committed');
    });
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'aparture-profile') {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return realSetItem.call(this, key, value);
    });
    act(() => {
      result.current.updateProfile('in-memory only');
    });
    // In memory the snapshot follows the session state…
    expect(result.current.profiles.Default.content).toBe('in-memory only');
    // …but disk stays consistent with the (unchanged) stored working slot.
    expect(JSON.parse(window.localStorage.getItem('aparture-profiles')).Default.content).toBe(
      'committed'
    );
  });
});
