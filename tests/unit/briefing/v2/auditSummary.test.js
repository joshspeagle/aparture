import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizeAuditRounds, readAuditRounds } from '../../../../lib/briefing/v2/auditSummary.js';

const flagged = (n, verdict = 'MAYBE') => ({
  verdict,
  flaggedClaims: Array.from({ length: n }, (_, i) => ({ excerpt: `claim ${i}` })),
});

describe('summarizeAuditRounds', () => {
  it('returns null when no audit ran', () => {
    expect(summarizeAuditRounds([])).toBeNull();
  });

  it('reports a clean audit', () => {
    expect(summarizeAuditRounds([flagged(0, 'NO')])).toBe('no unsupported claims found');
  });

  it('sums flagged claims across rounds', () => {
    expect(summarizeAuditRounds([flagged(9, 'YES'), flagged(2)])).toBe(
      '2 audit rounds; 11 claims flagged and revised before publishing'
    );
    expect(summarizeAuditRounds([flagged(1)])).toBe(
      'one audit round; 1 claim flagged and revised before publishing'
    );
  });
});

describe('readAuditRounds', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aparture-audit-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const write = (name, obj) => fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));

  it('reads numbered rounds in numeric order, then a distinct audit.json', () => {
    write('audit-round10.json', flagged(3));
    write('audit-round2.json', flagged(2));
    write('audit.json', flagged(0, 'NO'));
    const rounds = readAuditRounds(dir);
    expect(rounds.map((r) => r.flaggedClaims.length)).toEqual([2, 3, 0]);
  });

  it('does not count audit.json twice when it copies the last round', () => {
    write('audit-round1.json', flagged(9, 'YES'));
    write('audit-round2.json', flagged(2));
    write('audit.json', flagged(2));
    expect(readAuditRounds(dir)).toHaveLength(2);
  });

  it('returns [] for a missing directory or unreadable JSON', () => {
    expect(readAuditRounds(path.join(dir, 'nope'))).toEqual([]);
    fs.writeFileSync(path.join(dir, 'audit.json'), '{not json');
    expect(readAuditRounds(dir)).toEqual([]);
  });
});
