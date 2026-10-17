// Summarize a run's claim-audit rounds for the briefing colophon.
//
// The checker writes `<run>/audit.json`. When a round's flags send the
// briefing back for revision, the orchestrator renames that file to
// `audit-round<N>.json` before the next round, so the run directory keeps
// every round. The reader is told how many claims were flagged and revised
// across all rounds, not just the last one.

import fs from 'node:fs';
import path from 'node:path';

const ROUND_FILE = /^audit-round(\d+)\.json$/;

/**
 * @param {Array<{verdict: string, flaggedClaims?: Array}>} rounds oldest first
 * @returns {string|null} colophon text, or null when no audit ran
 */
export function summarizeAuditRounds(rounds) {
  if (rounds.length === 0) return null;
  const flagged = rounds.reduce((n, r) => n + (r.flaggedClaims?.length ?? 0), 0);
  if (flagged === 0) return 'no unsupported claims found';
  const roundsText = rounds.length === 1 ? 'one audit round' : `${rounds.length} audit rounds`;
  const claims = flagged === 1 ? '1 claim' : `${flagged} claims`;
  return `${roundsText}; ${claims} flagged and revised before publishing`;
}

/**
 * Read `audit-round<N>.json` files (in round order), then `audit.json` if it
 * is not just a copy of the last numbered round.
 *
 * @param {string} runDir
 * @returns {Array<Object>}
 */
export function readAuditRounds(runDir) {
  let names = [];
  try {
    names = fs.readdirSync(runDir);
  } catch {
    return [];
  }
  const read = (name) => {
    try {
      return { text: fs.readFileSync(path.join(runDir, name), 'utf8') };
    } catch {
      return null;
    }
  };
  const numbered = names
    .map((name) => ({ name, m: name.match(ROUND_FILE) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => read(x.name))
    .filter(Boolean);
  const latest = names.includes('audit.json') ? read('audit.json') : null;
  const texts = numbered.map((r) => r.text);
  if (latest && texts.at(-1)?.trim() !== latest.text.trim()) texts.push(latest.text);
  return texts.flatMap((t) => {
    try {
      return [JSON.parse(t)];
    } catch {
      return [];
    }
  });
}
