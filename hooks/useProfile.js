import { useCallback, useEffect, useRef, useState } from 'react';
import { migrateFromPhase1 } from '../lib/profile/migrations.js';
import { safeSetItem } from '../lib/persistence/safeStorage.js';

const PROFILE_KEY = 'aparture-profile';
const MIGRATION_DISMISSED_KEY = 'aparture-migration-notice-dismissed';
const MAX_REVISIONS = 20;
const PHASE_1_PROFILE_KEY = 'aparture-profile-md';

// Named-profile snapshots. PROFILES_KEY stores { [name]: {content, updatedAt} };
// ACTIVE_PROFILE_KEY stores the name of the snapshot the active slot came from.
// The single-profile PROFILE_KEY remains the working ("active") slot that the
// pipeline, suggest-profile flow, and CLI all read via profile.content —
// named profiles are snapshots you save the active slot as / load into it.
const PROFILES_KEY = 'aparture-profiles';
const ACTIVE_PROFILE_KEY = 'aparture-active-profile';

// Resolve the named-profile map + active pointer, seeding from the working
// profile on first load (migrates the existing single profile as "Default").
// PURE — no localStorage writes. Seed/repair persistence happens in the
// mount effect inside useProfile (render-phase writes from a useState
// initializer are a side effect React may double-invoke under StrictMode).
function readInitialProfiles(storage, profile) {
  let profiles = null;
  try {
    const raw = storage.getItem(PROFILES_KEY);
    if (raw) profiles = JSON.parse(raw);
  } catch {
    profiles = null;
  }
  if (!profiles || typeof profiles !== 'object' || Object.keys(profiles).length === 0) {
    const seeded = {
      Default: { content: profile.content, updatedAt: profile.updatedAt || Date.now() },
    };
    return { profiles: seeded, activeProfileName: 'Default' };
  }
  let active = storage.getItem(ACTIVE_PROFILE_KEY);
  if (!active || !profiles[active]) {
    active = Object.keys(profiles)[0];
  }
  return { profiles, activeProfileName: active };
}

function readInitialState(config) {
  if (typeof window === 'undefined') {
    return {
      profile: { content: '', updatedAt: 0, lastFeedbackCutoff: 0, revisions: [] },
      notice: null,
      profiles: {},
      activeProfileName: 'Default',
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
      const profile = JSON.parse(stored);
      return { profile, notice: null, ...readInitialProfiles(window.localStorage, profile) };
    } catch {
      // Corrupt JSON — fall through to a fresh Phase-1 migration.
    }
  }

  // First run (no stored profile): migrate from the legacy Phase-1 markdown key
  // if present, otherwise seed from config.scoringCriteria. The migrated
  // profile is PERSISTED by the mount effect in useProfile, not here — the
  // initializer must stay side-effect free.
  const { profile, notice } = migrateFromPhase1(window.localStorage, config);

  const dismissed = window.localStorage.getItem(MIGRATION_DISMISSED_KEY) === 'true';
  return {
    profile,
    notice: dismissed ? null : notice,
    ...readInitialProfiles(window.localStorage, profile),
  };
}

export function useProfile(config = {}) {
  const [state, setState] = useState(() => readInitialState(config));

  // Persist whatever the (pure) initializer computed but couldn't write:
  // the migrated working profile on first run, the seeded/repaired named-
  // profile map, and the legacy Phase-1 key cleanup. Runs once on mount —
  // moving these writes out of the useState initializer keeps render pure
  // (StrictMode double-invokes initializers) while preserving the persisted
  // end state byte-for-byte.
  const initialPersistDoneRef = useRef(false);
  useEffect(() => {
    if (initialPersistDoneRef.current) return;
    initialPersistDoneRef.current = true;
    if (typeof window === 'undefined') return;
    const storage = window.localStorage;
    if (!storage.getItem(PROFILE_KEY)) {
      safeSetItem(PROFILE_KEY, JSON.stringify(state.profile));
    }
    if (storage.getItem(PHASE_1_PROFILE_KEY)) {
      storage.removeItem(PHASE_1_PROFILE_KEY);
    }
    if (!storage.getItem(PROFILES_KEY)) {
      safeSetItem(PROFILES_KEY, JSON.stringify(state.profiles));
    }
    if (storage.getItem(ACTIVE_PROFILE_KEY) !== state.activeProfileName) {
      safeSetItem(ACTIVE_PROFILE_KEY, state.activeProfileName);
    }
    // Mount-only by design; state.* here is the initializer's output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // --- Named profiles ---
  // Snapshots of the working slot, managed like notebooks: save the current
  // profile under a name, switch between names, rename, delete. The working
  // slot (PROFILE_KEY / profile.content) is what every pipeline stage reads;
  // switching loads a snapshot into it (archiving the outgoing content both
  // as a revision and back into its own snapshot, so nothing is lost).
  const persistProfiles = useCallback((profiles, activeProfileName) => {
    if (typeof window === 'undefined') return;
    const ok =
      safeSetItem(PROFILES_KEY, JSON.stringify(profiles)) &&
      safeSetItem(ACTIVE_PROFILE_KEY, activeProfileName);
    if (!ok) {
      console.warn(
        '[useProfile] localStorage quota exceeded; named profiles could not be persisted (in-memory state preserved for this session)'
      );
    }
  }, []);

  // Build the next working profile with `content` loaded and the outgoing
  // content archived as a manual revision. No-op shape when content is equal.
  const loadContentIntoProfile = useCallback((profile, content, rationale) => {
    if (profile.content === content) return profile;
    const now = Date.now();
    const revision = {
      content: profile.content,
      createdAt: now,
      source: 'manual',
      lastFeedbackCutoff: profile.lastFeedbackCutoff,
      ...(rationale ? { rationale } : {}),
    };
    return {
      ...profile,
      content,
      updatedAt: now,
      revisions: [revision, ...profile.revisions].slice(0, MAX_REVISIONS),
    };
  }, []);

  const saveAs = useCallback(
    (name) => {
      const trimmed = (name ?? '').trim();
      if (!trimmed) return;
      setState((prev) => {
        const profiles = {
          ...prev.profiles,
          [trimmed]: { content: prev.profile.content, updatedAt: Date.now() },
        };
        persistProfiles(profiles, trimmed);
        return { ...prev, profiles, activeProfileName: trimmed };
      });
    },
    [persistProfiles]
  );

  const switchTo = useCallback(
    (name) => {
      setState((prev) => {
        const target = prev.profiles[name];
        if (!target || name === prev.activeProfileName) return prev;
        // Snapshot the outgoing content back into its own entry so switching
        // away never discards saved-slot edits.
        const profiles = { ...prev.profiles };
        if (profiles[prev.activeProfileName]) {
          profiles[prev.activeProfileName] = {
            content: prev.profile.content,
            updatedAt: Date.now(),
          };
        }
        const nextProfile = loadContentIntoProfile(
          prev.profile,
          target.content,
          `Switched to profile "${name}"`
        );
        persist(nextProfile);
        persistProfiles(profiles, name);
        return { ...prev, profile: nextProfile, profiles, activeProfileName: name };
      });
    },
    [persist, persistProfiles, loadContentIntoProfile]
  );

  const deleteProfile = useCallback(
    (name) => {
      setState((prev) => {
        if (!prev.profiles[name]) return prev;
        const profiles = { ...prev.profiles };
        delete profiles[name];
        // Deleting a non-active snapshot only removes the entry.
        if (name !== prev.activeProfileName) {
          persistProfiles(profiles, prev.activeProfileName);
          return { ...prev, profiles };
        }
        // Deleting the active one moves you to another snapshot (loading its
        // content), or re-seeds Default from the current content when it was
        // the last snapshot. Either way the working content stays recoverable
        // via revision history.
        const remaining = Object.keys(profiles);
        if (remaining.length === 0) {
          const seeded = { Default: { content: prev.profile.content, updatedAt: Date.now() } };
          persistProfiles(seeded, 'Default');
          return { ...prev, profiles: seeded, activeProfileName: 'Default' };
        }
        const nextActive = remaining[0];
        const nextProfile = loadContentIntoProfile(
          prev.profile,
          profiles[nextActive].content,
          `Deleted profile "${name}"; switched to "${nextActive}"`
        );
        persist(nextProfile);
        persistProfiles(profiles, nextActive);
        return { ...prev, profile: nextProfile, profiles, activeProfileName: nextActive };
      });
    },
    [persist, persistProfiles, loadContentIntoProfile]
  );

  const renameProfile = useCallback(
    (oldName, newName) => {
      const trimmed = (newName ?? '').trim();
      if (!trimmed) return;
      setState((prev) => {
        if (!prev.profiles[oldName] || trimmed === oldName) return prev;
        if (prev.profiles[trimmed]) return prev; // refuse to clobber an existing name
        const profiles = { ...prev.profiles, [trimmed]: prev.profiles[oldName] };
        delete profiles[oldName];
        const activeProfileName =
          prev.activeProfileName === oldName ? trimmed : prev.activeProfileName;
        persistProfiles(profiles, activeProfileName);
        return { ...prev, profiles, activeProfileName };
      });
    },
    [persistProfiles]
  );

  return {
    profile: state.profile,
    updateProfile,
    saveSuggested,
    revertToRevision,
    clearHistory,
    migrationNotice: state.notice,
    dismissMigrationNotice,
    // Named profiles
    profiles: state.profiles,
    activeProfileName: state.activeProfileName,
    saveAs,
    switchTo,
    deleteProfile,
    renameProfile,
  };
}
