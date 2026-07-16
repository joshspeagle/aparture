import { describe, it, expect, vi } from 'vitest';
import {
  validateAnthropic,
  validateGoogle,
  validateOpenAI,
  validateProviderSetup,
} from '../../../lib/llm/validateSetup.js';

// Minimal fetch stub: returns one canned HTTP response and records the call.
function mockFetch(status, body) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

function anthropicError(type, message) {
  return { type: 'error', error: { type, message } };
}

function googleError(status, message) {
  return { error: { code: 0, message, status } };
}

function openaiError(message) {
  return { error: { message, type: 'invalid_request_error' } };
}

describe('validateAnthropic', () => {
  it('returns ok with all checks true on 200', async () => {
    const fetchImpl = mockFetch(200, { input_tokens: 42 });
    const result = await validateAnthropic({
      model: 'claude-opus-4-8',
      apiKey: 'sk-ant-test',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({ key: true, model: true, requestShape: true });
    expect(result.message).toContain('No tokens sampled');
  });

  it('sends the adapter-shaped request to count_tokens (no max_tokens)', async () => {
    const fetchImpl = mockFetch(200, { input_tokens: 42 });
    await validateAnthropic({ model: 'claude-opus-4-8', apiKey: 'sk-ant-test', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages/count_tokens');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('sk-ant-test');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(init.body);
    // Reuses the production adapter: adaptive thinking on Opus 4.8, strict
    // tool, tool_choice auto (forced tool_choice is rejected with thinking).
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.messages).toHaveLength(1);
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].strict).toBe(true);
    expect(body.tool_choice).toEqual({ type: 'auto' });
    // count_tokens does not accept max_tokens — it must be stripped.
    expect(body.max_tokens).toBeUndefined();
  });

  it('mirrors the adapter thinking gate for Haiku (no thinking, forced tool)', async () => {
    const fetchImpl = mockFetch(200, { input_tokens: 42 });
    await validateAnthropic({ model: 'claude-haiku-4-5', apiKey: 'sk-ant-test', fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.thinking).toBeUndefined();
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'setup_check' });
  });

  it('classifies 401 as a key failure', async () => {
    const fetchImpl = mockFetch(401, anthropicError('authentication_error', 'invalid x-api-key'));
    const result = await validateAnthropic({
      model: 'claude-opus-4-8',
      apiKey: 'bad',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: false, model: null, requestShape: null });
    expect(result.message).toContain('invalid x-api-key');
  });

  it('classifies 404 as a model failure', async () => {
    const fetchImpl = mockFetch(
      404,
      anthropicError('not_found_error', 'model: claude-nonexistent')
    );
    const result = await validateAnthropic({
      model: 'claude-nonexistent',
      apiKey: 'sk-ant-test',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: true, model: false, requestShape: null });
    expect(result.message).toContain('claude-nonexistent');
  });

  it('classifies 400 as a request-shape failure with the provider message', async () => {
    const fetchImpl = mockFetch(
      400,
      anthropicError('invalid_request_error', 'tools.0.input_schema: additionalProperties required')
    );
    const result = await validateAnthropic({
      model: 'claude-opus-4-8',
      apiKey: 'sk-ant-test',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: true, model: true, requestShape: false });
    expect(result.message).toContain('additionalProperties required');
  });

  it('reports a network failure with all checks null', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const result = await validateAnthropic({
      model: 'claude-opus-4-8',
      apiKey: 'sk-ant-test',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: null, model: null, requestShape: null });
    expect(result.message).toContain('Could not reach Anthropic');
    expect(result.message).toContain('ECONNREFUSED');
  });

  it('reports a timeout as a network failure', async () => {
    const abortError = new Error('This operation was aborted');
    abortError.name = 'AbortError';
    const fetchImpl = vi.fn(async () => {
      throw abortError;
    });
    const result = await validateAnthropic({
      model: 'claude-opus-4-8',
      apiKey: 'sk-ant-test',
      fetchImpl,
      timeoutMs: 5000,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no response within 5s');
  });
});

describe('validateGoogle', () => {
  it('returns ok with all checks true on 200', async () => {
    const fetchImpl = mockFetch(200, { totalTokens: 12 });
    const result = await validateGoogle({
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-test',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({ key: true, model: true, requestShape: true });
  });

  it('posts adapter contents to :countTokens with query-param auth', async () => {
    const fetchImpl = mockFetch(200, { totalTokens: 12 });
    await validateGoogle({ model: 'gemini-2.5-flash', apiKey: 'AIza-test', fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:countTokens?key=AIza-test'
    );
    const body = JSON.parse(init.body);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: expect.any(String) }] }]);
    // countTokens accepts contents only — generationConfig must not leak in.
    expect(body.generationConfig).toBeUndefined();
  });

  it('classifies an invalid-key 400 as a key failure', async () => {
    const fetchImpl = mockFetch(
      400,
      googleError('INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.')
    );
    const result = await validateGoogle({
      model: 'gemini-2.5-flash',
      apiKey: 'bad',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: false, model: null, requestShape: null });
    expect(result.message).toContain('API key not valid');
  });

  it('classifies 403 as a key failure', async () => {
    const fetchImpl = mockFetch(403, googleError('PERMISSION_DENIED', 'Permission denied'));
    const result = await validateGoogle({
      model: 'gemini-2.5-flash',
      apiKey: 'bad',
      fetchImpl,
    });
    expect(result.checks.key).toBe(false);
  });

  it('classifies 404 as a model failure', async () => {
    const fetchImpl = mockFetch(
      404,
      googleError('NOT_FOUND', 'models/gemini-nonexistent is not found for API version v1beta')
    );
    const result = await validateGoogle({
      model: 'gemini-nonexistent',
      apiKey: 'AIza-test',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: true, model: false, requestShape: null });
  });

  it('classifies a non-key 400 as a request-shape failure', async () => {
    const fetchImpl = mockFetch(
      400,
      googleError('INVALID_ARGUMENT', 'Invalid JSON payload received. Unknown name "foo"')
    );
    const result = await validateGoogle({
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-test',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: true, model: true, requestShape: false });
    expect(result.message).toContain('Unknown name');
  });

  it('reports a network failure with all checks null', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    const result = await validateGoogle({
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-test',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: null, model: null, requestShape: null });
    expect(result.message).toContain('Could not reach Google');
  });
});

describe('validateOpenAI', () => {
  it('verifies key + model on 200 and leaves requestShape null with the caveat', async () => {
    const fetchImpl = mockFetch(200, { id: 'gpt-5.4', object: 'model' });
    const result = await validateOpenAI({ model: 'gpt-5.4', apiKey: 'sk-test', fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual({ key: true, model: true, requestShape: null });
    expect(result.message).toContain('Minimal API Test');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models/gpt-5.4');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });

  it('classifies 401 as a key failure', async () => {
    const fetchImpl = mockFetch(401, openaiError('Incorrect API key provided: sk-bad***'));
    const result = await validateOpenAI({ model: 'gpt-5.4', apiKey: 'sk-bad', fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: false, model: null, requestShape: null });
    expect(result.message).toContain('Incorrect API key');
  });

  it('classifies 404 as a model failure', async () => {
    const fetchImpl = mockFetch(404, openaiError("The model 'gpt-nonexistent' does not exist"));
    const result = await validateOpenAI({ model: 'gpt-nonexistent', apiKey: 'sk-test', fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: true, model: false, requestShape: null });
  });

  it('reports a network failure with all checks null', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const result = await validateOpenAI({ model: 'gpt-5.4', apiKey: 'sk-test', fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: null, model: null, requestShape: null });
    expect(result.message).toContain('Could not reach OpenAI');
  });
});

describe('validateProviderSetup', () => {
  it('dispatches to the provider validator', async () => {
    const fetchImpl = mockFetch(200, { input_tokens: 7 });
    const result = await validateProviderSetup({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: 'sk-ant-test',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toContain('count_tokens');
  });

  it('rejects unknown providers without a network call', async () => {
    const result = await validateProviderSetup({
      provider: 'xai',
      model: 'grok-4',
      apiKey: 'xai-test',
    });
    expect(result.ok).toBe(false);
    expect(result.checks).toEqual({ key: null, model: null, requestShape: null });
    expect(result.message).toContain('Unknown provider');
  });
});
