import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import handler from '../../pages/api/generate-notebooklm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures/llm');

function createMockReqRes(body) {
  const req = { method: 'POST', body };
  const state = {
    statusCode: 200,
    headers: {},
    jsonBody: undefined,
    buffer: null,
  };
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      state.headers[k.toLowerCase()] = v;
    },
    getHeader(k) {
      return state.headers[k.toLowerCase()];
    },
    json(obj) {
      state.jsonBody = obj;
      return this;
    },
    send(data) {
      state.buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      return this;
    },
    end(data) {
      if (data) state.buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    },
  };
  return { req, res, getResponse: () => state };
}

beforeAll(() => {
  process.env.ACCESS_PASSWORD = 'test-pw';
});

afterEach(() => {
  delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;
});

describe('generate-notebooklm API route (fixture mode)', () => {
  it('returns a ZIP containing briefing, discussion-guide, papers, focus-prompt, and INSTRUCTIONS', async () => {
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = 'NOTEBOOKLM_TEST_FIXTURE';

    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      podcastDuration: 20,
      notebookLMModel: 'gemini-3.1-pro',
      provider: 'google',
      briefing: {
        executiveSummary: 'Short.',
        themes: [{ title: 'Theme A', argument: 'x', paperIds: ['2504.01234'] }],
        papers: [{ arxivId: '2504.01234', title: 'Paper One', score: 9.0 }],
      },
      papers: [
        {
          arxivId: '2504.01234',
          title: 'Paper One',
          finalScore: 9.0,
          scoreJustification: 'matches interests',
          deepAnalysis: { summary: 'Long analysis body.' },
        },
      ],
      date: '2026-04-16',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, headers, buffer } = getResponse();

    expect(statusCode).toBe(200);
    expect(headers['content-type']).toBe('application/zip');
    expect(headers['content-disposition']).toMatch(/aparture-notebooklm-2026-04-16\.zip/);

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        'INSTRUCTIONS.md',
        'briefing.md',
        'discussion-guide.md',
        'focus-prompt.txt',
        'papers/01-2504.01234-paper-one.md',
      ])
    );

    const focus = await zip.file('focus-prompt.txt').async('string');
    expect(focus).toContain('Target length: 20 minutes');
    // Focus prompt should point at the uploaded sources rather than
    // re-enumerating them.
    expect(focus).toContain('discussion-guide.md');
    expect(focus).toContain('briefing.md');
    // Depth-strategy language scaled to 20 minutes
    expect(focus.toLowerCase()).toMatch(/deep-dive|prune|drop/);

    const guide = await zip.file('discussion-guide.md').async('string');
    expect(guide).toContain('Podcast Outline');
    // Guide must not be wrapped in a code fence — NotebookLM treats the
    // whole file as a code block otherwise and fails to parse the source.
    expect(guide.startsWith('```')).toBe(false);
  });

  it('rejects missing password', async () => {
    const { req, res, getResponse } = createMockReqRes({ password: 'wrong' });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects non-POST methods', async () => {
    const { req, res, getResponse } = createMockReqRes({});
    req.method = 'GET';
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });

  it('rejects missing briefing', async () => {
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = 'NOTEBOOKLM_TEST_FIXTURE';
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      papers: [{ arxivId: 'x', title: 'y', finalScore: 1 }],
      notebookLMModel: 'gemini-3.1-pro',
      callModelMode: { mode: 'fixture', fixturesDir },
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });
});
