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
      await indexHandler({ method, query, body }, res);
    } else if (pathPart.startsWith('/api/briefings/')) {
      const id = pathPart.slice('/api/briefings/'.length);
      await idHandler({ method, query: { ...query, id }, body }, res);
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
});
