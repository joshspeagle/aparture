import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import handler from '../../pages/api/briefings/index.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-briefings-'));
  process.env.APARTURE_REPORTS_DIR = tmpDir;
  process.env.ACCESS_PASSWORD = 'test-pw';
});

afterEach(async () => {
  delete process.env.APARTURE_REPORTS_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function mockReqRes(body, method = 'POST') {
  const req = { method, body, query: {} };
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

describe('POST /api/briefings', () => {
  it('writes a briefing file and returns { id, bytesWritten }', async () => {
    const entry = {
      id: 'abc123',
      date: '2026-04-21',
      timestamp: 1745244000000,
      archived: false,
      briefing: { executiveSummary: 'hi', themes: [], papers: [] },
    };
    const { req, res, getResponse } = mockReqRes({ password: 'test-pw', entry });

    await handler(req, res);

    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody.id).toBe('abc123');
    expect(jsonBody.bytesWritten).toBeGreaterThan(0);

    const filePath = path.join(tmpDir, 'briefings', 'abc123.json');
    const stored = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(stored).toEqual(entry);
  });
});

describe('POST /api/briefings — auth + validation', () => {
  it('rejects wrong password with 401', async () => {
    const { req, res, getResponse } = mockReqRes({
      password: 'wrong',
      entry: { id: 'abc', date: '2026-04-21', timestamp: 0, archived: false, briefing: {} },
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects missing entry with 400', async () => {
    const { req, res, getResponse } = mockReqRes({ password: 'test-pw' });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });

  it('rejects invalid id with 400 (path traversal defense)', async () => {
    const entry = {
      id: '../evil',
      date: '2026-04-21',
      timestamp: 0,
      archived: false,
      briefing: {},
    };
    const { req, res, getResponse } = mockReqRes({ password: 'test-pw', entry });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });

  it('rejects non-POST methods with 405', async () => {
    const { req, res, getResponse } = mockReqRes({}, 'PUT');
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });
});
