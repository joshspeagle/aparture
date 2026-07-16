import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { renderHook, act } from '@testing-library/react';
import { useBriefing } from '../../hooks/useBriefing.js';
import indexHandler from '../../pages/api/briefings/index.js';
import idHandler from '../../pages/api/briefings/[id].js';

// Wires window.fetch to invoke the route handlers directly (same-process
// integration — no Next.js server needed). Covers the full save → load →
// toggle archive → delete flow end-to-end.

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-e2e-'));
  process.env.APARTURE_REPORTS_DIR = tmpDir;
  process.env.ACCESS_PASSWORD = 'test-pw';

  vi.spyOn(global, 'fetch').mockImplementation(async (url, options = {}) => {
    const [pathPart, queryPart] = url.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryPart ?? ''));
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : undefined;
    // Next.js lower-cases header names on req.headers; mirror that so the
    // handlers' x-aparture-password auth reads work.
    const headers = Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
    );

    let capturedStatus = 200;
    let capturedJson = null;
    const res = {
      status(code) {
        capturedStatus = code;
        return this;
      },
      json(data) {
        capturedJson = data;
        return this;
      },
    };

    if (pathPart === '/api/briefings') {
      await indexHandler({ method, query, body, headers }, res);
    } else if (pathPart.startsWith('/api/briefings/')) {
      const id = pathPart.slice('/api/briefings/'.length);
      await idHandler({ method, query: { ...query, id }, body, headers }, res);
    }

    return {
      ok: capturedStatus >= 200 && capturedStatus < 300,
      status: capturedStatus,
      json: async () => capturedJson,
    };
  });

  window.localStorage.clear();
});

afterEach(async () => {
  delete process.env.APARTURE_REPORTS_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const makeBriefing = (summary = 'x') => ({
  executiveSummary: summary,
  themes: [],
  papers: [
    {
      arxivId: '2504.01234',
      title: 't',
      score: 8,
      onelinePitch: 'pitch',
      whyMatters: 'matters',
    },
  ],
  debates: [],
  longitudinal: [],
  proactiveQuestions: [],
});

describe('briefing persistence — end-to-end', () => {
  it('saves → loads → round-trips heavy fields', async () => {
    const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));

    let id;
    await act(async () => {
      id = await result.current.saveBriefing('2026-04-21', makeBriefing('first'), null, {
        pipelineArchive: { scoredPapers: [{ x: 1 }] },
        quickSummariesById: { '2504.01234': 'summary' },
      });
    });

    // File exists on disk with full fidelity
    const filePath = path.join(tmpDir, 'briefings', `${id}.json`);
    const stored = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(stored.briefing.executiveSummary).toBe('first');
    expect(stored.pipelineArchive).toEqual({ scoredPapers: [{ x: 1 }] });

    // Index does NOT contain heavy fields
    expect(result.current.history[0].pipelineArchive).toBeUndefined();
    expect(result.current.history[0].quickSummariesById).toBeUndefined();

    // loadBriefing returns the full entry with heavy fields
    const loaded = await result.current.loadBriefing(id);
    expect(loaded.pipelineArchive).toEqual({ scoredPapers: [{ x: 1 }] });
    expect(loaded.quickSummariesById).toEqual({ '2504.01234': 'summary' });
    expect(loaded.briefing.papers[0].onelinePitch).toBe('pitch');

    // toggleArchive round-trips through PATCH
    await act(async () => {
      await result.current.toggleArchive(id);
    });
    const reloaded = await result.current.loadBriefing(id);
    expect(reloaded.archived).toBe(true);

    // deleteBriefing removes the file
    await act(async () => {
      await result.current.deleteBriefing(id);
    });
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('loadBriefing returns null when the file has been manually deleted', async () => {
    const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));

    let id;
    await act(async () => {
      id = await result.current.saveBriefing('2026-04-21', makeBriefing('ephemeral'));
    });

    const filePath = path.join(tmpDir, 'briefings', `${id}.json`);
    await fs.unlink(filePath);

    // Current fast-path still returns the in-memory entry
    const fromCurrent = await result.current.loadBriefing(id);
    expect(fromCurrent).not.toBeNull();

    // But a fresh hook (new session) wouldn't have the in-memory fast path.
    // We simulate by clearing localStorage and re-rendering.
    window.localStorage.clear();
    const second = renderHook(() => useBriefing({ password: 'test-pw' }));
    const afterFsDelete = await second.result.current.loadBriefing(id);
    expect(afterFsDelete).toBeNull();
  });

  // Regression: when the hot CURRENT_KEY write hits quota, persistCurrent
  // stores a stripped+flagged blob (heavy fields dropped) while the full entry
  // still goes to disk via postBriefing. After a refresh, readStoredCurrent
  // rehydrates the stripped blob into `current`. loadBriefing(currentId) must
  // NOT short-circuit on that stripped in-memory copy — it has to fall through
  // to the disk GET and return the FULL entry, or the freshest briefing (the
  // one most likely to have tripped quota) renders placeholders.
  it('rehydrates a quota-stripped current from disk in loadBriefing', async () => {
    const heavy = {
      pipelineArchive: { scoredPapers: [{ x: 1 }] },
      quickSummariesById: { '2504.01234': 'a quick summary' },
      fullReportsById: { '2504.01234': 'a full report' },
    };

    // Force ONLY the hot CURRENT_KEY full-entry write to fail with a quota
    // error so persistCurrent falls back to the stripped+flagged blob. The
    // stripped retry (heavy fields gone) and the index write are allowed.
    const realSetItem = window.Storage.prototype.setItem;
    const setItemSpy = vi
      .spyOn(window.Storage.prototype, 'setItem')
      .mockImplementation(function (key, value) {
        if (key === 'aparture-briefing-current' && value.includes('pipelineArchive')) {
          const err = new Error('mock quota');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return realSetItem.call(this, key, value);
      });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let id;
    {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      await act(async () => {
        id = await result.current.saveBriefing('2026-04-21', makeBriefing('freshest'), null, heavy);
      });
    }

    // The hot blob is the stripped, flagged form; the disk file is full.
    const storedCurrent = JSON.parse(window.localStorage.getItem('aparture-briefing-current'));
    expect(storedCurrent._strippedFromHot).toBe(true);
    expect(storedCurrent.pipelineArchive).toBeUndefined();
    const filePath = path.join(tmpDir, 'briefings', `${id}.json`);
    const onDisk = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(onDisk.pipelineArchive).toEqual(heavy.pipelineArchive);

    setItemSpy.mockRestore();
    warnSpy.mockRestore();

    // Simulate a refresh: a fresh hook rehydrates `current` from the stripped
    // hot blob. loadBriefing(currentId) must return the FULL entry from disk.
    const second = renderHook(() => useBriefing({ password: 'test-pw' }));
    expect(second.result.current.current._strippedFromHot).toBe(true);
    expect(second.result.current.current.pipelineArchive).toBeUndefined();

    const loaded = await second.result.current.loadBriefing(id);
    expect(loaded.pipelineArchive).toEqual(heavy.pipelineArchive);
    expect(loaded.quickSummariesById).toEqual(heavy.quickSummariesById);
    expect(loaded.fullReportsById).toEqual(heavy.fullReportsById);
    expect(loaded.briefing.executiveSummary).toBe('freshest');
  });
});
