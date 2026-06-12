import { useCallback, useState } from 'react';
import { migrateFromPhase1 } from '../lib/profile/migrations.js';
import { safeSetItem } from '../lib/persistence/safeStorage.js';

const PROFILE_KEY = 'aparture-profile';
const MIGRATION_DISMISSED_KEY = 'aparture-migration-notice-dismissed';
const MAX_REVISIONS = 20;
const PHASE_1_PROFILE_KEY = 'aparture-profile-md';

function readInitialState(config) {
  if (typeof window === 'undefined') {
    return {
      profile: { content: '', updatedAt: 0, lastFeedbackCutoff: 0, revisions: [] },
      notice: null,
    };
  }

  // Existing profile: load it as-is. (We do NOT re-run migration on an already
  // stored profile — an earlier "Phase 1.5 recovery" heuristic did, but its
  // trigger re-armed every time `clearHistory` emptied the revision list, so it
  // wiped edited profiles on reload. It could also only ever fire in a state
  // app code can't produce, so it was removed.)
  const stored = window.localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      return { profile: JSON.parse(stored), notice: null };
    } catch {
      // Corrupt JSON — fall through to a fresh Phase-1 migration.
    }
  }

  // First run (no stored profile): migrate from the legacy Phase-1 markdown key
  // if present, otherwise seed from config.scoringCriteria.
  const { profile, notice } = migrateFromPhase1(window.localStorage, config);
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (window.localStorage.getItem(PHASE_1_PROFILE_KEY)) {
    window.localStorage.removeItem(PHASE_1_PROFILE_KEY);
  }

  const dismissed = window.localStorage.getItem(MIGRATION_DISMISSED_KEY) === 'true';
  return { profile, notice: dismissed ? null : notice };
}

export function useProfile(config = {}) {
  const [state, setState] = useState(() => readInitialState(config));

  // Persist via safeSetItem so a QuotaExceededError can't throw out of the
  // state updaters that call this mid-click — a raw setItem here used to crash
  // the interaction and lose the user's edit. On quota failure, log and keep
  // the in-memory state for the session (standard fallback; see safeStorage.js).
  const persist = useCallback((nextProfile) => {
    if (typeof window === 'undefined') return;
    const ok = safeSetItem(PROFILE_KEY, JSON.stringify(nextProfile));
    if (!ok) {
      console.warn(
        '[useProfile] localStorage quota exceeded; profile could not be persisted (in-memory state preserved for this session)'
      );
    }
  }, []);

  const updateProfile = useCallback(
    (newContent) => {
      setState((prev) => {
        // No-op when content is unchanged — prevents bloating the revisions
        // history with spurious entries from callers that don't de-duplicate.
        if (prev.profile.content === newContent) return prev;
        const now = Date.now();
        const revision = {
          content: prev.profile.content,
          createdAt: now,
          source: 'manual',
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
        };
        const revisions = [revision, ...prev.profile.revisions].slice(0, MAX_REVISIONS);
        const nextProfile = {
          ...prev.profile,
          content: newContent,
          updatedAt: now,
          revisions,
        };
        persist(nextProfile);
        return { ...prev, profile: nextProfile };
      });
    },
    [persist]
  );

  const clearHistory = useCallback(() => {
    setState((prev) => {
      const nextProfile = { ...prev.profile, revisions: [] };
      persist(nextProfile);
      return { ...prev, profile: nextProfile };
    });
  }, [persist]);

  const saveSuggested = useCallback(
    (revisedContent, lastFeedbackCutoff, rationale) => {
      setState((prev) => {
        const now = Date.now();
        const revision = {
          content: prev.profile.content,
          createdAt: now,
          source: 'suggested',
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
          rationale,
        };
        const revisions = [revision, ...prev.profile.revisions].slice(0, MAX_REVISIONS);
        const nextProfile = {
          ...prev.profile,
          content: revisedContent,
          updatedAt: now,
          lastFeedbackCutoff,
          revisions,
        };
        persist(nextProfile);
        return { ...prev, profile: nextProfile };
      });
    },
    [persist]
  );

  const revertToRevision = useCallback(
    (createdAt) => {
      setState((prev) => {
        const target = prev.profile.revisions.find((r) => r.createdAt === createdAt);
        if (!target) return prev;
        const now = Date.now();
        const revertRevision = {
          content: prev.profile.content,
          createdAt: now,
          source: 'manual',
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
          rationale: `Reverted to revision from ${new Date(createdAt).toISOString().slice(0, 10)}`,
        };
        const revisions = [revertRevision, ...prev.profile.revisions].slice(0, MAX_REVISIONS);
        const nextProfile = {
          ...prev.profile,
          content: target.content,
          updatedAt: now,
          lastFeedbackCutoff: target.lastFeedbackCutoff,
          revisions,
        };
        persist(nextProfile);
        return { ...prev, profile: nextProfile };
      });
    },
    [persist]
  );

  const dismissMigrationNotice = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MIGRATION_DISMISSED_KEY, 'true');
    }
    setState((prev) => ({ ...prev, notice: null }));
  }, []);

  return {
    profile: state.profile,
    updateProfile,
    saveSuggested,
    revertToRevision,
    clearHistory,
    migrationNotice: state.notice,
    dismissMigrationNotice,
  };
}
