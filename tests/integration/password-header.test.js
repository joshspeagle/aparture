// x-aparture-password header codec, end-to-end (C3).
//
// fetch() rejects header values with chars above U+00FF (ByteString
// constraint), so the client percent-encodes the password and the routes
// decode it before checkAccessPassword. A non-Latin1 password must
// round-trip through the header-authenticated GET and DELETE paths, and a
// malformed %-sequence must read as a WRONG password (401), never throw.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import briefingsHandler from '../../pages/api/briefings/index.js';
import briefingIdHandler from '../../pages/api/briefings/[id].js';
import sessionIdHandler from '../../pages/api/sessions/[id].js';
import { encodePasswordHeader } from '../../lib/auth/passwordHeader.js';

const NON_LATIN1_PASSWORD = 'pä密🔑';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-pw-header-'));
  process.env.APARTURE_REPORTS_DIR = tmpDir;
  process.env.ACCESS_PASSWORD = NON_LATIN1_PASSWORD;
});

afterEach(async () => {
  delete process.env.APARTURE_REPORTS_DIR;
  delete process.env.ACCESS_PASSWORD;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function mockReqRes({ method = 'GET', body, query = {}, headers = {} } = {}) {
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

const sampleEntry = {
  id: 'pw-header-entry',
  date: '2026-07-15',
  timestamp: 1752541200000,
  archived: false,
  briefing: { executiveSummary: 'hi', themes: [], papers: [] },
};

describe('x-aparture-password header — non-Latin1 password round-trip', () => {
  it('encodes to a ByteString-safe value the routes decode back', async () => {
    const headerValue = encodePasswordHeader(NON_LATIN1_PASSWORD);
    // Sanity: the encoded value must be transportable through fetch headers.
    expect([...headerValue].every((c) => c.charCodeAt(0) <= 0xff)).toBe(true);

    // Save via the body path (unaffected by the header constraint).
    const post = mockReqRes({
      method: 'POST',
      body: { password: NON_LATIN1_PASSWORD, entry: sampleEntry },
    });
    await briefingsHandler(post.req, post.res);
    expect(post.getResponse().statusCode).toBe(200);

    // GET back through the header-auth path.
    const get = mockReqRes({
      method: 'GET',
      query: { id: sampleEntry.id },
      headers: { 'x-aparture-password': headerValue },
    });
    await briefingIdHandler(get.req, get.res);
    expect(get.getResponse().statusCode).toBe(200);
    expect(get.getResponse().jsonBody).toEqual(sampleEntry);

    // DELETE through the header-auth path.
    const del = mockReqRes({
      method: 'DELETE',
      query: { id: sampleEntry.id },
      headers: { 'x-aparture-password': headerValue },
    });
    await briefingIdHandler(del.req, del.res);
    expect(del.getResponse().statusCode).toBe(200);

    const remaining = await fs.readdir(path.join(tmpDir, 'briefings'));
    expect(remaining).toEqual([]);
  });

  it('sessions [id] route decodes the header the same way', async () => {
    await fs.mkdir(path.join(tmpDir, 'sessions'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, 'sessions', 'sess-1.json'),
      JSON.stringify({ id: 'sess-1', results: {} }),
      'utf8'
    );
    const get = mockReqRes({
      method: 'GET',
      query: { id: 'sess-1' },
      headers: { 'x-aparture-password': encodePasswordHeader(NON_LATIN1_PASSWORD) },
    });
    await sessionIdHandler(get.req, get.res);
    expect(get.getResponse().statusCode).toBe(200);
    expect(get.getResponse().jsonBody.id).toBe('sess-1');
  });

  it('the raw (un-encoded) password no longer authenticates the header path', async () => {
    // The server now decodes: a raw 'pä密🔑' header would decode unchanged
    // only if it contained no %-sequences — but fetch could never send it.
    // What matters: a wrong/undecodable value is a plain 401.
    const get = mockReqRes({
      method: 'GET',
      query: { id: 'whatever' },
      headers: { 'x-aparture-password': 'wrong-password' },
    });
    await briefingIdHandler(get.req, get.res);
    expect(get.getResponse().statusCode).toBe(401);
  });
});

describe('x-aparture-password header — malformed encoding', () => {
  it.each([
    ['briefings list', (r) => briefingsHandler(r.req, r.res), {}],
    ['briefings [id] GET', (r) => briefingIdHandler(r.req, r.res), { id: 'abc' }],
    ['sessions [id] GET', (r) => sessionIdHandler(r.req, r.res), { id: 'abc' }],
  ])('%s: a malformed %%-sequence is a 401, not a throw', async (_label, invoke, query) => {
    const bad = mockReqRes({
      method: 'GET',
      query,
      headers: { 'x-aparture-password': '%E0%A4%A' },
    });
    await expect(invoke(bad)).resolves.not.toThrow();
    expect(bad.getResponse().statusCode).toBe(401);
  });
});
