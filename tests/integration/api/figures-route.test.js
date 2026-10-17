import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import handler from '../../../pages/api/figures/[id].js';
import { saveFigure } from '../../../lib/figures/store.js';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aparture-figroute-'));
  process.env.APARTURE_REPORTS_DIR = dir;
  process.env.ACCESS_PASSWORD = 'pw';
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

async function get(id, password = 'pw', method = 'GET') {
  const state = { headers: {} };
  const res = {
    setHeader(k, v) {
      state.headers[k] = v;
    },
    status(code) {
      state.status = code;
      return this;
    },
    json(body) {
      state.json = body;
      return this;
    },
    send(body) {
      state.body = body;
      return this;
    },
  };
  await handler(
    { method, query: { id }, headers: password ? { 'x-aparture-password': password } : {} },
    res
  );
  return state;
}

describe('GET /api/figures/:id', () => {
  it('serves a stored figure as PNG', async () => {
    const png = Buffer.from('\x89PNG data');
    await saveFigure('2610.00001', { png, label: 'Figure 1', caption: 'c', page: 1 });
    const r = await get('2610.00001');
    expect(r.status).toBe(200);
    expect(r.headers['Content-Type']).toBe('image/png');
    expect(r.body).toEqual(png);
  });

  it('needs the password', async () => {
    expect((await get('2610.00001', null)).status).toBe(401);
    expect((await get('2610.00001', 'wrong')).status).toBe(401);
  });

  it('rejects an id that is not an arXiv ID, before reading anything', async () => {
    expect((await get('../briefings/x', 'pw')).status).toBe(400);
  });

  it('answers 404 for a paper with no stored figure', async () => {
    expect((await get('2610.99999')).status).toBe(404);
  });

  it('allows only GET', async () => {
    expect((await get('2610.00001', 'pw', 'DELETE')).status).toBe(405);
  });
});
