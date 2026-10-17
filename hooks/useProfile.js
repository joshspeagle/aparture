import { useCallback, useEffect, useRef, useState } from 'react';
import { migrateFromPhase1 } from '../lib/profile/migrations.js';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { localDateStr } from '../lib/dates.js';
import { normalizeNotes } from '../lib/profile/editorialNotes.js';

const PROFILE_KEY = 'aparture-profile';
const MIGRATION_DISMISSED_KEY = 'aparture-migration-notice-dismissed';
const MAX_REVISIONS = 20;
const PHASE_1_PROFILE_KEY = 'aparture-profile-md';
// A corrupt aparture-profile blob is stashed here before the one-time repair
// overwrites it — corruption is often partial (the user's prose plus the
// revision history may still be readable by hand), so destroying the blob
// without a copy would make the repair itself a data-loss event.
const CORRUPT_BACKUP_KEY = 'aparture-profile-corrupt-backup';

// Named-profile snapshots. PROFILES_KEY stores { [name]: {content, updatedAt} };
// ACTIVE_PROFILE_KEY stores the name of the snapshot the active slot came from.
// The single-profile PROFILE_KEY remains the working ("active") slot that the
// pipeline, suggest-profile flow, and CLI all read via profile.content —
// named profiles are snapshots you save the active slot as / load into it.
const PROFILES_KEY = 'aparture-profiles';
const ACTIVE_PROFILE_KEY = 'aparture-active-profile';

// Rejected suggested changes kept on the profile (newest first) so later
// suggestions can be told not to re-propose them. Bounded: each entry holds
// the edit's anchor/content text.
const MAX_REJECTED_SUGGESTIONS = 20;
const MAX_REJECTED_TEXT = 500;

// A named-profile snapshot: the research profile and its editorial notes.
function snapshotOf(profile, updatedAt) {
  return { content: profile.content, notes: profile.notes ?? [], updatedAt };
}

function sameNotes(a, b) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function clip(text) {
  const s = typeof text === 'string' ? text : '';
  return s.length > MAX_REJECTED_TEXT ? `${s.slice(0, MAX_REJECTED_TEXT)}…` : s;
}

function toRejectedSuggestion(change, rejectedAt) {
  // A rejected editorial-note change (see SuggestDialog): remembered by what
  // it would have done, so the next suggestion doesn't propose it again.
  if (change?.note?.action) {
    return {
      rationale: clip(change.rationale),
      note: {
        action: change.note.action,
        scope: change.note.scope ?? null,
        text: clip(change.note.text),
      },
      rejectedAt,
    };
  }
  if (!change?.edit?.type) return null;
  return {
    rationale: clip(change.rationale),
    edit: {
      type: change.edit.type,
      anchor: clip(change.edit.anchor),
      content: clip(change.edit.content),
    },
    rejectedAt,
  };
}

// Resolve the named-profile map + active pointer, seeding from the working
// profile on first load (migrates the existing single profile as "Default").
// PURE — no localStorage writes. Seed/repair persistence happens in the
// mount effect inside useProfile (render-phase writes from a useState
// initializer are a side effect React may double-invoke under StrictMode).
function readInitialProfiles(storage, profile) {
  let profiles = null;
  let rawPresent = false;
  try {
    const raw = storage.getItem(PROFILES_KEY);
    if (raw) {
      rawPresent = true;
      profiles = JSON.parse(raw);
    }
  } catch {
    profiles = null;
  }
  if (!profiles || typeof profiles !== 'object' || Object.keys(profiles).length === 0) {
    const seeded = {
      Default: {
        content: profile.content,
        notes: profile.notes ?? [],
        updatedAt: profile.updatedAt || Date.now(),
      },
    };
    // profilesNeedRepair: a stored-but-unusable map (corrupt JSON, non-object,
    // empty) must be OVERWRITTEN by the mount effect — its "persist only when
    // the key is missing" guard would otherwise see the corrupt blob as
    // present and reseed in memory on every load without ever fixing disk.
    return { profiles: seeded, activeProfileName: 'Default', profilesNeedRepair: rawPresent };
  }
  let active = storage.getItem(ACTIVE_PROFILE_KEY);
  if (!active || !profiles[active]) {
    active = Object.keys(profiles)[0];
  }
  return { profiles, activeProfileName: active, profilesNeedRepair: false };
}

function readInitialState(config) {
  if (typeof window === 'undefined') {
    return {
      profile: { content: '', notes: [], updatedAt: 0, lastFeedbackCutoff: 0, revisions: [] },
      notice: null,
      needsRepair: false,
      corruptRaw: null,
      profiles: {},
      activeProfileName: 'Default',
      profilesNeedRepair: false,
    };
  }

  // Existing profile: load it as-is. (We do NOT re-run migration on an already
  // stored profile — an earlier "Phase 1.5 recovery" heuristic did, but its
  // trigger re-armed every time `clearHistory` emptied the revision list, so it
  // wiped edited profiles on reload. It could also only ever fire in a state
  // app code can't produce, so it was removed.)
  //
  // needsRepair: a truthy-but-corrupt stored value must be OVERWRITTEN by the
  // mount effect. The effect's "persist only when the key is missing" guard
  // would otherwise see the corrupt blob as present, skip the write, and the
  // hook would re-run the Phase-1 migration on every single load forever.
  let needsRepair = false;
  let corruptRaw = null;
  const stored = window.localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      const profile = JSON.parse(stored);
      // Shape gate: the blob must be an object with string content. A value
      // that parses but isn't usable ("null", a bare string, a number) would
      // otherwise crash the initializer at profile.content with no repair
      // path — JSON validity alone isn't enough.
      if (profile && typeof profile === 'object' && typeof profile.content === 'string') {
        // Editorial notes ride on the working slot; older blobs have none.
        profile.notes = normalizeNotes(profile.notes);
        return {
          profile,
          notice: null,
          needsRepair: false,
          corruptRaw: null,
          ...readInitialProfiles(window.localStorage, profile),
        };
      }
      needsRepair = true;
      corruptRaw = stored;
    } catch {
      // Corrupt JSON — fall through to a fresh Phase-1 migration and flag
      // the mount effect to back up and replace the unparseable blob.
      needsRepair = true;
      corruptRaw = stored;
    }
  }

  // First run (no stored profile): migrate from the legacy Phase-1 markdown key
  // if present, otherwise seed from config.scoringCriteria. The migrated
  // profile is PERSISTED by the mount effect in useProfile, not here — the
  // initializer must stay side-effect free.
  const migrated = migrateFromPhase1(window.localStorage, config);
  const profile = { ...migrated.profile, notes: normalizeNotes(migrated.profile.notes) };
  const notice = migrated.notice;

  const dismissed = window.localStorage.getItem(MIGRATION_DISMISSED_KEY) === 'true';
  return {
    profile,
    notice: dismissed ? null : notice,
    needsRepair,
    corruptRaw,
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
    // Write when the key is missing (first run / fresh migration) OR when the
    // initializer found a corrupt blob (needsRepair) — a corrupt-but-truthy
    // value would otherwise never be repaired and the user would silently
    // re-migrate on every load. A valid stored profile is NOT rewritten.
    // Stash the corrupt blob BEFORE the repair overwrites it — it may still
    // hold recoverable prose and revision history.
    if (state.needsRepair && state.corruptRaw) {
      safeSetItem(CORRUPT_BACKUP_KEY, state.corruptRaw);
    }
    if (!storage.getItem(PROFILE_KEY) || state.needsRepair) {
      safeSetItem(PROFILE_KEY, JSON.stringify(state.profile));
    }
    if (storage.getItem(PHASE_1_PROFILE_KEY)) {
      storage.removeItem(PHASE_1_PROFILE_KEY);
    }
    if (!storage.getItem(PROFILES_KEY) || state.profilesNeedRepair) {
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
  // Returns whether the write landed, so multi-key callers (switchTo,
  // deleteProfile) can keep localStorage self-consistent on failure.
  const persist = useCallback((nextProfile) => {
    if (typeof window === 'undefined') return true;
    const ok = safeSetItem(PROFILE_KEY, JSON.stringify(nextProfile));
    if (!ok) {
      console.warn(
        '[useProfile] localStorage quota exceeded; profile could not be persisted (in-memory state preserved for this session)'
      );
    }
    return ok;
  }, []);

  // Named-profile map + active pointer writer (see the "Named profiles"
  // section below). Declared up here because committing a working-slot
  // change also writes through to the active snapshot.
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

  // Commit a new working profile AND write it through to the active named
  // profile's snapshot. Every committed change (manual save, accepted
  // suggestion, revert) goes through here, so the active snapshot always
  // mirrors the working slot. Previously only switchTo snapshotted, so
  // after "Save as…" the profile you left kept whatever content it was
  // SEEDED with — usually the first-run template — and switching back
  // silently loaded that over the user's real profile.
  //
  // Same ordering rule as switchTo: the map is written only after the
  // working-slot write lands, so disk never holds a snapshot newer than the
  // working slot it mirrors.
  const commitProfile = useCallback(
    (prev, nextProfile) => {
      const name = prev.activeProfileName;
      const current = prev.profiles?.[name];
      const profiles =
        current &&
        (current.content !== nextProfile.content || !sameNotes(current.notes, nextProfile.notes))
          ? {
              ...prev.profiles,
              [name]: snapshotOf(nextProfile, nextProfile.updatedAt),
            }
          : prev.profiles;
      if (persist(nextProfile) && profiles !== prev.profiles) {
        persistProfiles(profiles, name);
      }
      return { ...prev, profile: nextProfile, profiles };
    },
    [persist, persistProfiles]
  );

  // Revisions archive the text from BEFORE a change; `source` and
  // `rationale` describe the change itself ('manual' edit, 'suggested',
  // 'template', 'revert', 'switch'). HistoryDropdown diffs each revision
  // against the next newer text to show what the change did.
  const updateProfile = useCallback(
    (newContent, { source = 'manual', rationale } = {}) => {
      setState((prev) => {
        // No-op when content is unchanged — prevents bloating the revisions
        // history with spurious entries from callers that don't de-duplicate.
        if (prev.profile.content === newContent) return prev;
        const now = Date.now();
        const revision = {
          content: prev.profile.content,
          notes: prev.profile.notes ?? [],
          createdAt: now,
          source,
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
          ...(rationale ? { rationale } : {}),
        };
        const revisions = [revision, ...prev.profile.revisions].slice(0, MAX_REVISIONS);
        const nextProfile = {
          ...prev.profile,
          content: newContent,
          updatedAt: now,
          revisions,
        };
        return commitProfile(prev, nextProfile);
      });
    },
    [commitProfile]
  );

  // Edit the editorial notes directly (the Notes tab: add, edit, remove).
  // A revision archives the profile and notes from before, like any change.
  const updateNotes = useCallback(
    (nextNotes, { source = 'manual', rationale } = {}) => {
      setState((prev) => {
        const notes = normalizeNotes(nextNotes);
        if (sameNotes(notes, prev.profile.notes)) return prev;
        const now = Date.now();
        const revision = {
          content: prev.profile.content,
          notes: prev.profile.notes ?? [],
          createdAt: now,
          source,
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
          ...(rationale ? { rationale } : {}),
        };
        const nextProfile = {
          ...prev.profile,
          notes,
          updatedAt: now,
          revisions: [revision, ...prev.profile.revisions].slice(0, MAX_REVISIONS),
        };
        return commitProfile(prev, nextProfile);
      });
    },
    [commitProfile]
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
          notes: prev.profile.notes ?? [],
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
        return commitProfile(prev, nextProfile);
      });
    },
    [commitProfile]
  );

  // The Suggest dialog's single exit point. outcome = {
  //   kind: 'applied' | 'rejected' | 'no-change',
  //   content, rationale,            // 'applied' only: the new profile text
  //   accepted, rejected,            // the model's change objects, split by the user
  //   appliedAt,                     // shared with useFeedback.markIncorporated
  // }
  // Only an applied outcome with a real content change creates a revision;
  // its createdAt is `appliedAt`, so reverting it can re-open exactly the
  // feedback that revision incorporated. The legacy lastFeedbackCutoff is
  // left alone: incorporation is tracked per event now (feedbackStatus.js).
  //
  // Every outcome also updates two pieces of suggestion memory on the
  // profile:
  //   - suggestionStats {accepted, rejected, noChange}: running counts of
  //     changes the user accepted vs rejected, and of "no change" results.
  //     POSITIONING's success criterion ("suggestions are accepted more often
  //     than rejected") is accepted / (accepted + rejected).
  //   - rejectedSuggestions: the most recent rejected changes (newest
  //     first), which the Suggest dialog sends with the next request so the
  //     model is told not to propose them again.
  const recordSuggestionOutcome = useCallback(
    (outcome) => {
      if (!outcome) return;
      setState((prev) => {
        const now = outcome.appliedAt ?? Date.now();
        const accepted = Array.isArray(outcome.accepted) ? outcome.accepted : [];
        const rejected = Array.isArray(outcome.rejected) ? outcome.rejected : [];
        const stats = prev.profile.suggestionStats ?? {};
        const suggestionStats = {
          accepted: (stats.accepted ?? 0) + accepted.length,
          rejected: (stats.rejected ?? 0) + rejected.length,
          noChange: (stats.noChange ?? 0) + (outcome.kind === 'no-change' ? 1 : 0),
        };
        const rejectedSuggestions = [
          ...rejected.map((c) => toRejectedSuggestion(c, now)).filter(Boolean),
          ...(prev.profile.rejectedSuggestions ?? []),
        ].slice(0, MAX_REJECTED_SUGGESTIONS);
        const withMemory = { ...prev.profile, suggestionStats, rejectedSuggestions };

        // An applied outcome may change the profile text, the editorial
        // notes, or both; either makes a revision.
        const nextContent =
          typeof outcome.content === 'string' ? outcome.content : prev.profile.content;
        const nextNotes = Array.isArray(outcome.notes)
          ? normalizeNotes(outcome.notes)
          : (prev.profile.notes ?? []);
        const changed =
          outcome.kind === 'applied' &&
          (nextContent !== prev.profile.content || !sameNotes(nextNotes, prev.profile.notes));
        if (!changed) {
          // Memory only: the working text (and so every snapshot) is unchanged.
          persist(withMemory);
          return { ...prev, profile: withMemory };
        }
        const revision = {
          content: prev.profile.content,
          notes: prev.profile.notes ?? [],
          createdAt: now,
          source: 'suggested',
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
          rationale: outcome.rationale,
          acceptedCount: accepted.length,
          rejectedCount: rejected.length,
        };
        const nextProfile = {
          ...withMemory,
          content: nextContent,
          notes: nextNotes,
          updatedAt: now,
          revisions: [revision, ...prev.profile.revisions].slice(0, MAX_REVISIONS),
        };
        return commitProfile(prev, nextProfile);
      });
    },
    [commitProfile, persist]
  );

  const revertToRevision = useCallback(
    (createdAt) => {
      setState((prev) => {
        const target = prev.profile.revisions.find((r) => r.createdAt === createdAt);
        if (!target) return prev;
        const now = Date.now();
        const revertRevision = {
          content: prev.profile.content,
          notes: prev.profile.notes ?? [],
          createdAt: now,
          source: 'revert',
          lastFeedbackCutoff: prev.profile.lastFeedbackCutoff,
          rationale: `Reverted to the text from before the ${localDateStr(new Date(createdAt))} change`,
        };
        const revisions = [revertRevision, ...prev.profile.revisions].slice(0, MAX_REVISIONS);
        const nextProfile = {
          ...prev.profile,
          content: target.content,
          // Revisions from before notes existed carry none; keep today's.
          notes: target.notes ?? prev.profile.notes ?? [],
          updatedAt: now,
          lastFeedbackCutoff: target.lastFeedbackCutoff,
          revisions,
        };
        return commitProfile(prev, nextProfile);
      });
    },
    [commitProfile]
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
  // Committed edits to the working slot also write through to the active
  // snapshot (commitProfile above), so a snapshot is never staler than the
  // last thing the user saved under that name.

  // Build the next working profile with `content` loaded and the outgoing
  // content archived as a 'switch' revision. No-op shape when content is equal.
  const loadContentIntoProfile = useCallback((profile, content, rationale, notes = []) => {
    if (profile.content === content && sameNotes(profile.notes, notes)) return profile;
    const now = Date.now();
    const revision = {
      content: profile.content,
      notes: profile.notes ?? [],
      createdAt: now,
      source: 'switch',
      lastFeedbackCutoff: profile.lastFeedbackCutoff,
      ...(rationale ? { rationale } : {}),
    };
    return {
      ...profile,
      content,
      notes: normalizeNotes(notes),
      updatedAt: now,
      revisions: [revision, ...profile.revisions].slice(0, MAX_REVISIONS),
    };
  }, []);

  const saveAs = useCallback(
    (name) => {
      const trimmed = (name ?? '').trim();
      if (!trimmed) return;
      setState((prev) => {
        // Refuse to clobber a DIFFERENT existing snapshot — snapshot contents
        // are never revision-archived, so an accidental name collision would
        // destroy that profile silently. Re-saving under the active name is
        // legitimate ("update my snapshot") and stays allowed. Mirrors the
        // renameProfile guard; ProfileSwitcher surfaces the refusal inline.
        if (prev.profiles[trimmed] && trimmed !== prev.activeProfileName) return prev;
        const now = Date.now();
        const profiles = { ...prev.profiles };
        // Snapshot the outgoing profile too. Everything committed so far was
        // committed under the outgoing name, so that name must keep it —
        // otherwise switching back later loads a stale snapshot (for a
        // first-run "Default", the bracketed template) over the user's real
        // profile. commitProfile normally keeps this in sync already; this
        // also repairs maps persisted before write-through existed.
        if (profiles[prev.activeProfileName]) {
          profiles[prev.activeProfileName] = snapshotOf(prev.profile, now);
        }
        profiles[trimmed] = snapshotOf(prev.profile, now);
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
          profiles[prev.activeProfileName] = snapshotOf(prev.profile, Date.now());
        }
        const nextProfile = loadContentIntoProfile(
          prev.profile,
          target.content,
          `Switched to profile "${name}"`,
          target.notes
        );
        // Working slot first; advance the stored map + pointer only if it
        // landed. A half-written switch (pointer on the new name, working
        // slot still holding the old draft) would, after a reload and one
        // more switch, snapshot the wrong content over the new name's entry.
        // On failure, disk stays fully pre-switch-consistent; the in-memory
        // switch proceeds for the session (standard quota fallback).
        if (persist(nextProfile)) {
          persistProfiles(profiles, name);
        } else {
          console.warn(
            '[useProfile] working-slot write failed; leaving stored named-profile map and pointer at their pre-switch state'
          );
        }
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
          const seeded = { Default: snapshotOf(prev.profile, Date.now()) };
          persistProfiles(seeded, 'Default');
          return { ...prev, profiles: seeded, activeProfileName: 'Default' };
        }
        const nextActive = remaining[0];
        const nextProfile = loadContentIntoProfile(
          prev.profile,
          profiles[nextActive].content,
          `Deleted profile "${name}"; switched to "${nextActive}"`,
          profiles[nextActive].notes
        );
        // Same ordering rule as switchTo: don't delete the entry from disk
        // unless the working slot's write landed, or a reload would show the
        // deleted profile's content under the surviving snapshot's name.
        if (persist(nextProfile)) {
          persistProfiles(profiles, nextActive);
        } else {
          console.warn(
            '[useProfile] working-slot write failed; leaving stored named-profile map and pointer at their pre-delete state'
          );
        }
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
    updateNotes,
    saveSuggested,
    recordSuggestionOutcome,
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
