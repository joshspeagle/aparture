import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import handler from '../../pages/api/sessions/index.js';
import idHandler from '../../pages/api/sessions/[id].js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-sessions-'));
  process.env.APARTURE_REPORTS_DIR = tmpDir;
  process.env.ACCESS_PASSWORD = 'test-pw';
});

afterEach(async () => {
  delete process.env.APARTURE_REPORTS_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function mockReqRes(body, method = 'POST', query = {}, headers = {}) {
  const req = { method, body, query, headers };
  const state = { statusCode: 200, jsonBody: undefined };
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(data) {
      state.jsonBody = data;
      return this;
    },
  };
  return { req, res, getResponse: () => state };
}

const sampleEntry = () => ({
  id: 'sess-abc123',
  timestamp: 1745244000000,
  results: {
    allPapers: [{ id: '2504.00001', title: 'P1', abstract: 'abstract 1' }],
    scoredPapers: [{ id: '2504.00001', title: 'P1', relevanceScore: 7 }],
    finalRanking: [{ id: '2504.00001', title: 'P1', finalScore: 8 }],
  },
  filterResults: { total: 1, yes: [{ id: '2504.00001' }], maybe: [], no: [] },
  processingTiming: { startTime: '2026-05-07T09:00:00Z' },
});

describe('POST /api/sessions', () => {
  it('writes a session file and returns { id, bytesWritten }', async () => {
    const entry = sampleEntry();
    const { req, res, getResponse } = mockReqRes({ password: 'test-pw', entry });

    await handler(req, res);

    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody.id).toBe(entry.id);
    expect(jsonBody.bytesWritten).toBeGreaterThan(0);

    const filePath = path.join(tmpDir, 'sessions', `${entry.id}.json`);
    const stored = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(stored).toEqual(entry);
  });

  it('rejects wrong password with 401', async () => {
    const { req, res, getResponse } = mockReqRes({ password: 'wrong', entry: sampleEntry() });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects missing entry with 400', async () => {
    const { req, res, getResponse } = mockReqRes({ password: 'test-pw' });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });

  it('rejects invalid id with 400 (path traversal defense)', async () => {
    const entry = { ...sampleEntry(), id: '../evil' };
    const { req, res, getResponse } = mockReqRes({ password: 'test-pw', entry });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });
});

describe('GET /api/sessions', () => {
  it('returns empty list when sessions dir does not exist', async () => {
    const { req, res, getResponse } = mockReqRes(
      undefined,
      'GET',
      {},
      {
        'x-aparture-password': 'test-pw',
      }
    );
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody).toEqual({ ids: [] });
  });

  it('lists session ids after writes', async () => {
    const entry = sampleEntry();
    {
      const { req, res } = mockReqRes({ password: 'test-pw', entry });
      await handler(req, res);
    }
    const { req, res, getResponse } = mockReqRes(
      undefined,
      'GET',
      {},
      {
        'x-aparture-password': 'test-pw',
      }
    );
    await handler(req, res);
    expect(getResponse().jsonBody.ids).toContain(entry.id);
  });
});

describe('GET /api/sessions/[id]', () => {
  it('returns 404 for missing session', async () => {
    const { req, res, getResponse } = mockReqRes(
      undefined,
      'GET',
      { id: 'sess-missing' },
      {
        'x-aparture-password': 'test-pw',
      }
    );
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(404);
  });

  it('returns the session entry after POST', async () => {
    const entry = sampleEntry();
    {
      const { req, res } = mockReqRes({ password: 'test-pw', entry });
      await handler(req, res);
    }
    const { req, res, getResponse } = mockReqRes(
      undefined,
      'GET',
      { id: entry.id },
      {
        'x-aparture-password': 'test-pw',
      }
    );
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(200);
    expect(getResponse().jsonBody).toEqual(entry);
  });
});

describe('DELETE /api/sessions/[id]', () => {
  it('removes the session file', async () => {
    const entry = sampleEntry();
    {
      const { req, res } = mockReqRes({ password: 'test-pw', entry });
      await handler(req, res);
    }
    const { req, res, getResponse } = mockReqRes(
      undefined,
      'DELETE',
      { id: entry.id },
      {
        'x-aparture-password': 'test-pw',
      }
    );
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(200);

    const filePath = path.join(tmpDir, 'sessions', `${entry.id}.json`);
    await expect(fs.access(filePath)).rejects.toBeDefined();
  });

  it('is idempotent (DELETE of missing returns 200)', async () => {
    const { req, res, getResponse } = mockReqRes(
      undefined,
      'DELETE',
      { id: 'sess-missing' },
      {
        'x-aparture-password': 'test-pw',
      }
    );
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(200);
  });
});
