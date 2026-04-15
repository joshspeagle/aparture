const PHASE_1_PROFILE_KEY = 'aparture-profile-md';

/**
 * Migrate legacy localStorage + config state into the new aparture-profile shape.
 *
 * @param {Storage|{getItem: (key: string) => string|null}} storage
 * @param {{scoringCriteria?: string}} config
 * @returns {{
 *   profile: { content: string, updatedAt: number, lastFeedbackCutoff: number, revisions: Array<object> },
 *   notice: null | { type: 'phase1-conflict', discardedContent: string }
 * }}
 */
export function migrateFromPhase1(storage, config = {}) {
  const phase1Profile = storage.getItem(PHASE_1_PROFILE_KEY);
  const scoringCriteria = (config.scoringCriteria || '').trim();
  const now = Date.now();

  const baseProfile = { content: '', updatedAt: now, lastFeedbackCutoff: 0, revisions: [] };

  if (!phase1Profile && !scoringCriteria) {
    return { profile: baseProfile, notice: null };
  }
  if (phase1Profile && !scoringCriteria) {
    return { profile: { ...baseProfile, content: phase1Profile }, notice: null };
  }
  if (!phase1Profile && scoringCriteria) {
    return { profile: { ...baseProfile, content: scoringCriteria }, notice: null };
  }

  // Both exist — Phase 1 profile wins
  const profile = { ...baseProfile, content: phase1Profile };
  if (phase1Profile === scoringCriteria) {
    return { profile, notice: null };
  }
  return {
    profile,
    notice: { type: 'phase1-conflict', discardedContent: scoringCriteria },
  };
}
