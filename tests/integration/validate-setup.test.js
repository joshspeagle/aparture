import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import handler from '../../pages/api/validate-setup.js';
import { validateProviderSetup } from '../../lib/llm/validateSetup.js';

// Mock the probe library — the route's job is auth, registry resolution, and
// pair dedupe; the probes themselves are covered by the unit tests.
vi.mock('../../lib/llm/validateSetup.js', () => ({
  validateProviderSetup: vi.fn(async ({ provider }) => ({
    ok: true,
    checks: { key: true, model: true, requestShape: provider === 'openai' ? null : true },
    message: 'mocked ok',
  })),
}));

function createMockReqRes(body) {
  const req = { method: 'POST', body };
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

beforeAll(() => {
  process.env.ACCESS_PASSWORD = 'test-pw';
});

beforeEach(() => {
  vi.mocked(validateProviderSetup).mockClear();
  process.env.CLAUDE_API_KEY = 'sk-ant-env';
  process.env.GOOGLE_AI_API_KEY = 'AIza-env';
  process.env.OPENAI_API_KEY = 'sk-openai-env';
});

describe('validate-setup API route', () => {
  it('rejects non-POST methods', async () => {
    const { req, res, getResponse } = createMockReqRes({});
    req.method = 'GET';
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });

  it('rejects a missing slots array', async () => {
    const { req, res, getResponse } = createMockReqRes({ password: 'test-pw' });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });

  it('rejects malformed slots entries with 400, not a destructuring 500', async () => {
    for (const badSlots of [
      [null],
      ['not-an-object'],
      [{ slot: 'Filter' }], // missing model
      [{ model: 'claude-haiku-4.5' }], // missing slot
    ]) {
      const { req, res, getResponse } = createMockReqRes({
        password: 'test-pw',
        slots: badSlots,
      });
      await handler(req, res);
      expect(getResponse().statusCode).toBe(400);
      expect(getResponse().jsonBody.error).toMatch(/invalid slots/i);
    }
  });

  it('rejects missing credentials', async () => {
    const { req, res, getResponse } = createMockReqRes({
      slots: [{ slot: 'Filter', model: 'gemini-2.5-flash' }],
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
    expect(validateProviderSetup).not.toHaveBeenCalled();
  });

  it('rejects an invalid password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      slots: [{ slot: 'Filter', model: 'gemini-2.5-flash' }],
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
    expect(validateProviderSetup).not.toHaveBeenCalled();
  });

  it('returns per-slot results and dedupes identical (provider, model) pairs', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      slots: [
        { slot: 'Filter', model: 'gemini-2.5-flash' },
        { slot: 'Scoring', model: 'gemini-2.5-flash' },
        { slot: 'Briefing', model: 'claude-sonnet-4.6' },
      ],
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody.results).toHaveLength(3);

    // Two unique pairs → two probes, even though three slots were submitted.
    expect(validateProviderSetup).toHaveBeenCalledTimes(2);
    // Registry resolution: user-facing id → provider apiId, env key by provider.
    expect(validateProviderSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-ant-env',
      })
    );
    expect(validateProviderSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        model: 'gemini-2.5-flash',
        apiKey: 'AIza-env',
      })
    );

    const filter = jsonBody.results.find((r) => r.slot === 'Filter');
    expect(filter).toMatchObject({
      model: 'gemini-2.5-flash',
      provider: 'google',
      ok: true,
      checks: { key: true, model: true, requestShape: true },
    });
    // Identical pairs share the identical result object shape.
    const scoring = jsonBody.results.find((r) => r.slot === 'Scoring');
    expect(scoring.checks).toEqual(filter.checks);

    // The key is never echoed back.
    expect(JSON.stringify(jsonBody)).not.toContain('sk-ant-env');
    expect(JSON.stringify(jsonBody)).not.toContain('AIza-env');
  });

  it('reports an unknown model id as a per-slot failure without probing', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      slots: [{ slot: 'Filter', model: 'not-a-model' }],
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody.results[0]).toMatchObject({
      slot: 'Filter',
      ok: false,
      checks: { key: null, model: false, requestShape: null },
    });
    expect(jsonBody.results[0].message).toContain('not in the registry');
    expect(validateProviderSetup).not.toHaveBeenCalled();
  });

  it('reports a missing server key as a key failure without probing', async () => {
    delete process.env.GOOGLE_AI_API_KEY;
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      slots: [{ slot: 'Filter', model: 'gemini-2.5-flash' }],
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody.results[0]).toMatchObject({
      ok: false,
      checks: { key: false, model: null, requestShape: null },
    });
    expect(jsonBody.results[0].message).toContain('GOOGLE_AI_API_KEY');
    expect(validateProviderSetup).not.toHaveBeenCalled();
  });

  it('uses a client-supplied apiKey without requiring a password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      apiKey: 'sk-byok',
      slots: [{ slot: 'Briefing', model: 'claude-haiku-4.5' }],
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(200);
    expect(validateProviderSetup).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', apiKey: 'sk-byok' })
    );
  });
});
