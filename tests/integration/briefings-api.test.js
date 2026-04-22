import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import handler from '../../pages/api/briefings/index.js';
import idHandler from '../../pages/api/briefings/[id].js';

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

function mockReqResWithQuery(query, method = 'GET', body) {
  const req = { method, query, body };
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

describe('GET /api/briefings/[id]', () => {
  it('reads an existing briefing file', async () => {
    const entry = {
      id: 'seed1',
      date: '2026-04-21',
      timestamp: 42,
      archived: false,
      briefing: { executiveSummary: 'seeded' },
    };
    await fs.mkdir(path.join(tmpDir, 'briefings'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'briefings', 'seed1.json'), JSON.stringify(entry), 'utf8');

    const { req, res, getResponse } = mockReqResWithQuery({ id: 'seed1', password: 'test-pw' });
    await idHandler(req, res);

    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody).toEqual(entry);
  });

  it('returns 404 for missing briefing', async () => {
    const { req, res, getResponse } = mockReqResWithQuery({ id: 'missing', password: 'test-pw' });
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(404);
  });

  it('rejects invalid id with 400', async () => {
    const { req, res, getResponse } = mockReqResWithQuery({
      id: '../etc/passwd',
      password: 'test-pw',
    });
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });

  it('rejects wrong password with 401', async () => {
    const { req, res, getResponse } = mockReqResWithQuery({ id: 'anything', password: 'wrong' });
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });
});

describe('DELETE /api/briefings/[id]', () => {
  it('removes an existing briefing file', async () => {
    const entry = { id: 'del1', date: '2026-04-21', timestamp: 0, archived: false, briefing: {} };
    await fs.mkdir(path.join(tmpDir, 'briefings'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'briefings', 'del1.json'), JSON.stringify(entry), 'utf8');

    const { req, res, getResponse } = mockReqResWithQuery(
      { id: 'del1', password: 'test-pw' },
      'DELETE'
    );
    await idHandler(req, res);

    expect(getResponse().statusCode).toBe(200);
    expect(getResponse().jsonBody).toEqual({ ok: true });
    await expect(fs.access(path.join(tmpDir, 'briefings', 'del1.json'))).rejects.toThrow();
  });

  it('returns 200 for already-missing briefing (idempotent)', async () => {
    const { req, res, getResponse } = mockReqResWithQuery(
      { id: 'missing', password: 'test-pw' },
      'DELETE'
    );
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(200);
    expect(getResponse().jsonBody).toEqual({ ok: true });
  });

  it('rejects wrong password with 401', async () => {
    const { req, res, getResponse } = mockReqResWithQuery(
      { id: 'anything', password: 'wrong' },
      'DELETE'
    );
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });
});

describe('PATCH /api/briefings/[id]', () => {
  it('merges whitelisted fields only', async () => {
    const entry = {
      id: 'pat1',
      date: '2026-04-21',
      timestamp: 0,
      archived: false,
      briefing: { executiveSummary: 'keep' },
    };
    await fs.mkdir(path.join(tmpDir, 'briefings'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'briefings', 'pat1.json'), JSON.stringify(entry), 'utf8');

    const { req, res, getResponse } = mockReqResWithQuery({ id: 'pat1' }, 'PATCH', {
      password: 'test-pw',
      patch: { archived: true, briefing: { executiveSummary: 'HACKED' } },
    });
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(200);

    const stored = JSON.parse(
      await fs.readFile(path.join(tmpDir, 'briefings', 'pat1.json'), 'utf8')
    );
    expect(stored.archived).toBe(true); // whitelisted: applied
    expect(stored.briefing.executiveSummary).toBe('keep'); // not whitelisted: ignored
  });

  it('returns 404 when patching a missing file', async () => {
    const { req, res, getResponse } = mockReqResWithQuery({ id: 'nonexistent' }, 'PATCH', {
      password: 'test-pw',
      patch: { archived: true },
    });
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(404);
  });

  it('rejects wrong password with 401', async () => {
    const { req, res, getResponse } = mockReqResWithQuery({ id: 'anything' }, 'PATCH', {
      password: 'wrong',
      patch: { archived: true },
    });
    await idHandler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });
});
