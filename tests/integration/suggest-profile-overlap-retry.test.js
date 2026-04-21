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

const fixturesDir = path.resolve(__dirname, '../fixtures/llm/runtime-overlap');

// Must stay in sync with suggestedProfileJsonSchema() in the route.
function perHunkJsonSchema() {
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

const PROFILE =
  'I care about Bayesian methods for hierarchical models in astrophysics and cosmology.';

const FEEDBACK = [
  {
    type: 'star',
    arxivId: '2504.11111',
    paperTitle: 'Hierarchical Bayesian inference for galaxy clustering',
    quickSummary: 'A probabilistic pipeline for galaxy clustering analyses.',
    score: 9.0,
    timestamp: '2026-04-15T10:00:00Z',
    briefingDate: '2026-04-15',
  },
];

async function seedFixture({ prompt, response }) {
  const input = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    prompt,
    apiKey: 'test-key',
    structuredOutput: {
      name: 'suggested_profile',
      description: 'Aparture suggested research profile revision',
      schema: perHunkJsonSchema(),
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

describe('suggest-profile — overlap retry (fixture mode)', () => {
  let firstPrompt;
  let retryPrompt;

  beforeAll(async () => {
    const templatePath = path.resolve(process.cwd(), 'prompts', 'suggest-profile.md');
    const template = await fs.readFile(templatePath, 'utf8');
    firstPrompt = renderSuggestPrompt(template, { profile: PROFILE, events: FEEDBACK });
    // Retry hint (must match the hint emitted by the route).
    retryPrompt =
      firstPrompt +
      '\n\nYour previous response had overlapping or unanchored changes. Produce strictly non-overlapping atomic changes whose anchors appear verbatim in the current profile.';

    // Fixture 1: first response returns overlapping changes (triggers retry).
    await seedFixture({
      prompt: firstPrompt,
      response: {
        text: '',
        tokensIn: 200,
        tokensOut: 60,
        structured: {
          changes: [
            {
              id: 'c1',
              rationale: 'Star on 2504.11111 suggests emphasis on hierarchical inference.',
              edit: {
                type: 'replace',
                anchor: 'Bayesian methods for hierarchical',
                content: 'probabilistic inference for hierarchical',
              },
            },
            {
              id: 'c2',
              rationale: 'Overlapping with c1 — covers same region.',
              edit: {
                type: 'replace',
                anchor: 'hierarchical models',
                content: 'hierarchical galaxy models',
              },
            },
          ],
        },
      },
    });

    // Fixture 2: retry response returns valid non-overlapping changes.
    await seedFixture({
      prompt: retryPrompt,
      response: {
        text: '',
        tokensIn: 220,
        tokensOut: 70,
        structured: {
          changes: [
            {
              id: 'c1',
              rationale: 'Star on 2504.11111 suggests emphasis on hierarchical inference.',
              edit: {
                type: 'replace',
                anchor: 'Bayesian methods',
                content: 'probabilistic inference',
              },
            },
            {
              id: 'c2',
              rationale: 'Star on 2504.11111 specifically highlights galaxy clustering.',
              edit: {
                type: 'insert',
                anchor: 'cosmology',
                content: ' (especially galaxy clustering)',
              },
            },
          ],
        },
      },
    });
  });

  it('retries when LLM returns overlapping changes and succeeds on second attempt', async () => {
    const { req, res, getResponse } = createMockReqRes({
      currentProfile: PROFILE,
      feedback: FEEDBACK,
      briefingModel: 'claude-sonnet-4-6',
      provider: 'anthropic',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody).toHaveProperty('changes');
    expect(Array.isArray(jsonBody.changes)).toBe(true);
    expect(jsonBody.changes).toHaveLength(2);
    for (const change of jsonBody.changes) {
      expect(change).toHaveProperty('id');
      expect(change).toHaveProperty('rationale');
      expect(change).toHaveProperty('edit');
      expect(change.edit).toHaveProperty('type');
      expect(change.edit).toHaveProperty('anchor');
    }
    expect(jsonBody.retried).toBe(true);
  });
});
