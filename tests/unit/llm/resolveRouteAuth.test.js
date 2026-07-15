import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkRoutePassword, resolveRouteAuth } from '../../../lib/llm/resolveRouteAuth.js';

const ENV_KEYS = ['ACCESS_PASSWORD', 'CLAUDE_API_KEY', 'GOOGLE_AI_API_KEY', 'OPENAI_API_KEY'];
let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.ACCESS_PASSWORD = 'test-pw';
  delete process.env.CLAUDE_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('checkRoutePassword (phase 1)', () => {
  it('passes a valid password', () => {
    expect(checkRoutePassword({ password: 'test-pw' })).toEqual({ ok: true });
  });

  it('rejects a wrong password with 401 and the default message', () => {
    expect(checkRoutePassword({ password: 'wrong' })).toEqual({
      ok: false,
      status: 401,
      error: 'invalid password',
    });
  });

  it('honors a custom invalidPassword message', () => {
    const gate = checkRoutePassword(
      { password: 'wrong' },
      { messages: { invalidPassword: 'Invalid password' } }
    );
    expect(gate).toEqual({ ok: false, status: 401, error: 'Invalid password' });
  });

  it('a client apiKey bypasses password validation by default', () => {
    expect(checkRoutePassword({ apiKey: 'k', password: 'wrong' })).toEqual({ ok: true });
  });

  it('an absent password is not an error (deferred to phase 2)', () => {
    expect(checkRoutePassword({})).toEqual({ ok: true });
    expect(checkRoutePassword({ password: '' })).toEqual({ ok: true });
  });

  it('validateWhenPresent rejects a wrong password even alongside an apiKey', () => {
    const gate = checkRoutePassword(
      { apiKey: 'k', password: 'wrong' },
      { validateWhenPresent: true }
    );
    expect(gate.ok).toBe(false);
    expect(gate.status).toBe(401);
  });

  it('validateWhenPresent rejects an empty-string password but not an absent one', () => {
    expect(checkRoutePassword({ password: '' }, { validateWhenPresent: true }).ok).toBe(false);
    expect(checkRoutePassword({}, { validateWhenPresent: true }).ok).toBe(true);
  });
});

describe('resolveRouteAuth (phase 2)', () => {
  it('returns the client apiKey untouched', () => {
    const auth = resolveRouteAuth({ apiKey: 'client-key', provider: 'anthropic' });
    expect(auth).toMatchObject({ ok: true, apiKey: 'client-key', isFixture: false });
    expect(auth.callMode).toEqual({ mode: 'live' });
  });

  it('swaps a valid password for the provider env key', () => {
    process.env.GOOGLE_AI_API_KEY = 'env-google-key';
    const auth = resolveRouteAuth({ password: 'test-pw', provider: 'google' });
    expect(auth).toMatchObject({ ok: true, apiKey: 'env-google-key' });
  });

  it('rejects a wrong password before touching provider keys', () => {
    process.env.CLAUDE_API_KEY = 'env-key';
    const auth = resolveRouteAuth({ password: 'wrong', provider: 'anthropic' });
    expect(auth).toEqual({ ok: false, status: 401, error: 'invalid password' });
  });

  it('401s with the default missing-credentials message when no key resolves', () => {
    const auth = resolveRouteAuth({ password: 'test-pw', provider: 'anthropic' });
    expect(auth).toEqual({
      ok: false,
      status: 401,
      error: 'missing credentials: supply apiKey or password',
    });
  });

  it('honors per-route message overrides', () => {
    const messages = {
      invalidPassword: 'Invalid password',
      missingCredentials: 'missing credentials',
    };
    expect(resolveRouteAuth({ password: 'wrong', provider: 'google', messages }).error).toBe(
      'Invalid password'
    );
    expect(resolveRouteAuth({ password: 'test-pw', provider: 'google', messages }).error).toBe(
      'missing credentials'
    );
  });

  it('skips the missing-credentials 401 in fixture mode', () => {
    const auth = resolveRouteAuth({
      provider: 'anthropic',
      callModelMode: { mode: 'fixture', fixturesDir: '/tmp/fixtures' },
    });
    expect(auth.ok).toBe(true);
    expect(auth.isFixture).toBe(true);
    expect(auth.callMode).toEqual({ mode: 'fixture', fixturesDir: '/tmp/fixtures' });
  });

  it('keeps apiKey undefined (not null) in fixture mode — fixture hashes cover apiKey', () => {
    // The pre-refactor per-route ladders left apiKey `undefined` when the env
    // var was unset; `null` would silently re-key every fixture recorded
    // through the password path.
    const auth = resolveRouteAuth({
      password: 'test-pw',
      provider: 'anthropic',
      callModelMode: { mode: 'fixture', fixturesDir: '/tmp/fixtures' },
    });
    expect(auth.ok).toBe(true);
    expect('apiKey' in auth).toBe(true);
    expect(auth.apiKey).toBeUndefined();
  });

  it('an unknown provider resolves no key and 401s in live mode', () => {
    const auth = resolveRouteAuth({ password: 'test-pw', provider: 'xai' });
    expect(auth.ok).toBe(false);
    expect(auth.status).toBe(401);
  });
});
