import { useCallback, useState } from 'react';
import { migrateFromPhase1 } from '../lib/profile/migrations.js';

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

  const stored = window.localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);

      // Recovery path for an early Phase 1.5 bug where the migration ran
      // against the hardcoded DEFAULT_CONFIG.scoringCriteria (because config
      // state was not yet lazy-initialized from localStorage at the time
      // useProfile first ran). Detect the signature: the user has never
      // edited their profile (revisions empty) AND the stored content does
      // not match the scoringCriteria the caller is currently passing AND
      // the caller actually has a scoringCriteria value to migrate from.
      const callerCriteria = (config?.scoringCriteria || '').trim();
      if (parsed?.revisions?.length === 0 && callerCriteria && parsed.content !== callerCriteria) {
        // Clear the corrupted key and re-run migration against the real config.
        window.localStorage.removeItem(PROFILE_KEY);
      } else {
        return { profile: parsed, notice: null };
      }
    } catch {
      // fall through to migration on parse failure
    }
  }

  const { profile, notice } = migrateFromPhase1(window.localStorage, config);

  // Persist the migrated profile and clean up the legacy key
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (window.localStorage.getItem(PHASE_1_PROFILE_KEY)) {
    window.localStorage.removeItem(PHASE_1_PROFILE_KEY);
  }

  const dismissed = window.localStorage.getItem(MIGRATION_DISMISSED_KEY) === 'true';
  return { profile, notice: dismissed ? null : notice };
}

export function useProfile(config = {}) {
  const [state, setState] = useState(() => readInitialState(config));

  const persist = useCallback((nextProfile) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
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
