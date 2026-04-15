import { describe, it, expect } from 'vitest';
import { migrateFromPhase1 } from '../../../lib/profile/migrations.js';

describe('migrateFromPhase1', () => {
  const makeStorage = (entries = []) => {
    const store = new Map(entries);
    return { getItem: (key) => store.get(key) ?? null };
  };

  it('returns empty profile when no old data exists', () => {
    const { profile, notice } = migrateFromPhase1(makeStorage(), { scoringCriteria: '' });
    expect(profile.content).toBe('');
    expect(profile.revisions).toEqual([]);
    expect(profile.lastFeedbackCutoff).toBe(0);
    expect(notice).toBeNull();
  });

  it('migrates the Phase 1 profile-md key when only it exists', () => {
    const storage = makeStorage([['aparture-profile-md', 'I study mechanistic interpretability.']]);
    const { profile, notice } = migrateFromPhase1(storage, { scoringCriteria: '' });
    expect(profile.content).toBe('I study mechanistic interpretability.');
    expect(notice).toBeNull();
  });

  it('migrates scoringCriteria when only it exists', () => {
    const { profile, notice } = migrateFromPhase1(makeStorage(), {
      scoringCriteria: 'Papers on flow-based generative models.',
    });
    expect(profile.content).toBe('Papers on flow-based generative models.');
    expect(notice).toBeNull();
  });

  it('prefers Phase 1 profile over scoringCriteria when both match', () => {
    const same = 'I study flows.';
    const storage = makeStorage([['aparture-profile-md', same]]);
    const { profile, notice } = migrateFromPhase1(storage, { scoringCriteria: same });
    expect(profile.content).toBe(same);
    expect(notice).toBeNull();
  });

  it('emits a conflict notice when Phase 1 profile and scoringCriteria differ', () => {
    const storage = makeStorage([['aparture-profile-md', 'New profile text']]);
    const { profile, notice } = migrateFromPhase1(storage, {
      scoringCriteria: 'Old scoring criteria text',
    });
    expect(profile.content).toBe('New profile text');
    expect(notice).not.toBeNull();
    expect(notice.type).toBe('phase1-conflict');
    expect(notice.discardedContent).toBe('Old scoring criteria text');
  });

  it('sets updatedAt and empty revisions for all migration paths', () => {
    const { profile } = migrateFromPhase1(makeStorage(), { scoringCriteria: 'test' });
    expect(profile.updatedAt).toBeGreaterThan(0);
    expect(profile.revisions).toEqual([]);
    expect(profile.lastFeedbackCutoff).toBe(0);
  });
});
