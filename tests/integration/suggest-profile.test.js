import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import handler from '../../pages/api/suggest-profile.js';
import { hashInput } from '../../lib/llm/hash.js';
import { renderSuggestPrompt } from '../../lib/profile/suggestPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMockReqRes(body) {
  const req = { method: 'POST', body };
  let statusCode;
  let jsonBody;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonBody = data;
      return this;
    },
  };
  return { req, res, getResponse: () => ({ statusCode, jsonBody }) };
}

const fixturesDir = path.resolve(__dirname, '../fixtures/llm/runtime');

// Mirrors the JSON schema the route emits — needed to compute the deterministic
// fixture hash. Must stay in sync with suggestedProfileJsonSchema() in the route.
function suggestedProfileJsonSchema() {
  return {
    type: 'object',
    required: ['changes', 'noChangeReason'],
    additionalProperties: false,
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'rationale', 'edit'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            rationale: { type: 'string' },
            edit: {
              type: 'object',
              required: ['type', 'anchor', 'content'],
              additionalProperties: false,
              properties: {
                type: { type: 'string', enum: ['replace', 'insert', 'delete'] },
                anchor: { type: 'string' },
                content: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
      noChangeReason: { type: ['string', 'null'] },
    },
  };
}

const PROFILE_WITH_CHANGES =
  'I study mechanistic interpretability of large language models with a focus on attention heads.';
const FEEDBACK_WITH_CHANGES = [
  {
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'Circuit-level analysis of reasoning',
    quickSummary: 'Identifies attention head circuits responsible for multi-step reasoning.',
    score: 9.2,
    timestamp: '2026-04-12T10:00:00Z',
    briefingDate: '2026-04-12',
  },
  {
    type: 'dismiss',
    arxivId: '2504.02345',
    paperTitle: 'Generic transformer survey',
    quickSummary: 'High-level survey of transformer architectures.',
    score: 6.1,
    timestamp: '2026-04-12T10:01:00Z',
    briefingDate: '2026-04-12',
  },
  {
    type: 'general-comment',
    text: 'I want more papers on circuit-level interpretability.',
    timestamp: '2026-04-12T10:05:00Z',
    briefingDate: '2026-04-12',
  },
];

const PROFILE_NO_CHANGE =
  'I study mechanistic interpretability of large language models, including circuit-level attention head analysis.';
const FEEDBACK_NO_CHANGE = [
  {
    type: 'star',
    arxivId: '2504.04567',
    paperTitle: 'Attention head specialization at scale',
    quickSummary: 'Empirical study of head specialization across model sizes.',
    score: 8.8,
    timestamp: '2026-04-13T10:00:00Z',
    briefingDate: '2026-04-13',
  },
  {
    type: 'paper-comment',
    arxivId: '2504.04567',
    paperTitle: 'Attention head specialization at scale',
    text: 'Already aligned with my interests.',
    timestamp: '2026-04-13T10:01:00Z',
    briefingDate: '2026-04-13',
  },
];

async function seedFixture({ profile, feedback, response }) {
  const templatePath = path.resolve(process.cwd(), 'prompts', 'suggest-profile.md');
  const template = await fs.readFile(templatePath, 'utf8');
  const prompt = renderSuggestPrompt(template, { profile, events: feedback });

  const input = {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    prompt,
    apiKey: 'test-key',
    structuredOutput: {
      name: 'suggested_profile',
      description: 'Aparture suggested research profile revision',
      schema: suggestedProfileJsonSchema(),
    },
  };
  const hash = hashInput(input);
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, `${hash}.json`),
    JSON.stringify({ hash, input, response }, null, 2)
  );
  return hash;
}

describe('suggest-profile API route (fixture mode)', () => {
  beforeAll(async () => {
    // Fixture for the "happy path with changes" test. The anchor must appear
    // verbatim in PROFILE_WITH_CHANGES so the non-overlap validator resolves it.
    await seedFixture({
      profile: PROFILE_WITH_CHANGES,
      feedback: FEEDBACK_WITH_CHANGES,
      response: {
        text: '',
        tokensIn: 250,
        tokensOut: 80,
        structured: {
          changes: [
            {
              id: 'c1',
              rationale:
                'Based on the star on 2504.01234 (circuit-level reasoning) and the general comment requesting more circuit-level interpretability work.',
              edit: {
                type: 'insert',
                anchor: 'attention heads',
                content: ', including circuit-level multi-step reasoning analysis',
              },
            },
          ],
        },
      },
    });

    // Fixture for the "no change" test
    await seedFixture({
      profile: PROFILE_NO_CHANGE,
      feedback: FEEDBACK_NO_CHANGE,
      response: {
        text: '',
        tokensIn: 220,
        tokensOut: 60,
        structured: {
          changes: [],
          noChangeReason:
            'The starred paper is already within the circuit-level attention head analysis area covered by the profile. No new research direction is implied by this feedback.',
        },
      },
    });
  });

  it('returns a revised profile with changes when feedback indicates a gap', async () => {
    const { req, res, getResponse } = createMockReqRes({
      currentProfile: PROFILE_WITH_CHANGES,
      feedback: FEEDBACK_WITH_CHANGES,
      briefingModel: 'claude-opus-4-6', // pass apiId directly so route uses it as-is
      provider: 'anthropic',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.changes).toHaveLength(1);
    expect(jsonBody.changes[0]).toHaveProperty('id');
    expect(jsonBody.changes[0]).toHaveProperty('edit');
    expect(jsonBody.changes[0].edit.type).toBe('insert');
    expect(jsonBody.changes[0].edit.anchor).toBe('attention heads');
    expect(jsonBody.changes[0].edit.content).toContain('circuit-level');
    expect(jsonBody.changes[0].rationale).toContain('2504.01234');
    expect(jsonBody.repaired).toBe(false);
    expect(jsonBody.retried).toBe(false);
    expect(jsonBody.noChangeReason).toBeUndefined();
  });

  it('returns noChangeReason when feedback does not indicate a profile gap', async () => {
    const { req, res, getResponse } = createMockReqRes({
      currentProfile: PROFILE_NO_CHANGE,
      feedback: FEEDBACK_NO_CHANGE,
      briefingModel: 'claude-opus-4-6',
      provider: 'anthropic',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.changes).toEqual([]);
    expect(jsonBody.noChangeReason).toContain('circuit-level attention head analysis');
    expect(jsonBody.repaired).toBe(false);
    expect(jsonBody.retried).toBe(false);
  });

  it('rejects requests with neither apiKey nor password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      currentProfile: PROFILE_NO_CHANGE,
      feedback: FEEDBACK_NO_CHANGE,
      briefingModel: 'claude-opus-4-6',
      provider: 'anthropic',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(401);
    expect(jsonBody.error).toMatch(/apiKey|password/);
  });

  it('rejects wrong password with 401', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong-password',
      currentProfile: PROFILE_NO_CHANGE,
      feedback: FEEDBACK_NO_CHANGE,
      briefingModel: 'claude-opus-4-6',
      provider: 'anthropic',
    });

    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects non-POST methods with 405', async () => {
    const { req, res, getResponse } = createMockReqRes({});
    req.method = 'GET';
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });
});
