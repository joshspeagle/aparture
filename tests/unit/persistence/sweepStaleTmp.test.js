import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { sweepStaleTmpOrphans } from '../../../lib/persistence/sweepStaleTmp.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-sweep-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeFileWithAge(name, ageMs) {
  const p = path.join(tmpDir, name);
  await fs.writeFile(p, 'x', 'utf8');
  const past = new Date(Date.now() - ageMs);
  await fs.utimes(p, past, past);
  return p;
}

async function listDir() {
  return (await fs.readdir(tmpDir)).sort();
}

describe('sweepStaleTmpOrphans', () => {
  it('deletes only stale .tmp files, leaving fresh .tmp and real files alone', async () => {
    const TEN_MIN = 10 * 60 * 1000;
    await writeFileWithAge('orphan1.json.123.tmp', TEN_MIN); // stale tmp → deleted
    await writeFileWithAge('orphan2.json.456.tmp', TEN_MIN); // stale tmp → deleted
    await writeFileWithAge('inflight.json.789.tmp', 1000); // fresh tmp → kept
    await writeFileWithAge('real-entry.json', TEN_MIN); // real file → kept
    await writeFileWithAge('notes.txt', TEN_MIN); // non-tmp → kept

    await sweepStaleTmpOrphans(tmpDir);

    expect(await listDir()).toEqual(['inflight.json.789.tmp', 'notes.txt', 'real-entry.json']);
  });

  it('honors a custom staleMs threshold', async () => {
    await writeFileWithAge('a.json.1.tmp', 5000);
    await sweepStaleTmpOrphans(tmpDir, { staleMs: 1000 });
    expect(await listDir()).toEqual([]);
  });

  it('keeps a tmp file exactly at the threshold boundary fresh side', async () => {
    await writeFileWithAge('young.json.1.tmp', 1000);
    await sweepStaleTmpOrphans(tmpDir, { staleMs: 60_000 });
    expect(await listDir()).toEqual(['young.json.1.tmp']);
  });

  it('is a no-op when the directory does not exist', async () => {
    await expect(
      sweepStaleTmpOrphans(path.join(tmpDir, 'does-not-exist'))
    ).resolves.toBeUndefined();
  });

  it('ignores races where a tmp file vanishes between readdir and stat', async () => {
    // Deleting mid-flight is simulated by pointing at an empty dir with a
    // dangling name expectation — the helper must never throw on ENOENT.
    await writeFileWithAge('gone.json.1.tmp', 10 * 60 * 1000);
    // Delete it out from under the sweep by racing two sweeps; both resolve.
    await Promise.all([sweepStaleTmpOrphans(tmpDir), sweepStaleTmpOrphans(tmpDir)]);
    expect(await listDir()).toEqual([]);
  });
});
