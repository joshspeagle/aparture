import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../../pages/api/synthesize.js';
import { renderSynthesisPrompt } from '../../lib/synthesis/renderPrompt.js';
import { renderReaderNotesSection } from '../../lib/synthesis/readerNotes.js';
import { toJsonSchema } from '../../lib/synthesis/schema.js';
import { hashInput } from '../../lib/llm/hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: mock Next.js req/res
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

const fixturesDir = path.resolve(__dirname, '../fixtures/llm');

describe('synthesize API route — auth + method guards', () => {
  it('rejects missing/wrong password with 401', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      profile: 'I study interpretability.',
      papers: [],
      provider: 'anthropic',
      model: 'claude-opus-4-6',
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

describe('synthesize API route (fixture mode)', () => {
  it('returns a validated briefing when the fixture is good', async () => {
    const { req, res, getResponse } = createMockReqRes({
      profile: 'I study mechanistic interpretability of large language models.',
      papers: [
        { arxivId: '2504.01234', title: 'Circuit-level analysis of reasoning', abstract: '...' },
        { arxivId: '2504.02345', title: 'Head pruning ablations', abstract: '...' },
      ],
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });
    // Override the synthesis prompt to the known fixture key
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = 'SYNTHESIS_PROMPT_FIXTURE';

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    // Cleanup env var
    delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;

    expect(statusCode).toBe(200);
    expect(jsonBody.briefing.executiveSummary).toContain('interpretability');
    expect(jsonBody.briefing.papers).toHaveLength(2);
    expect(jsonBody.repaired).toBe(false);
  });
});

describe('synthesize API route — $-pattern profile does not corrupt the prompt (P0-1)', () => {
  // A profile carrying every GetSubstitution hazard: $$ (LaTeX), $&, $`, $'.
  // Before the fix, `templatePrefix.replaceAll('{{profile}}', profile)` used
  // string replacement, so these patterns mangled the rendered prompt for
  // every provider. The fixture below is seeded under the hash of the
  // CORRECTLY rendered prompt — if the route corrupts the prompt, the hash
  // misses and the route returns 500 ("no fixture found").
  const nastyProfile =
    'I study $$\\Lambda$$CDM cosmology; budgets in $USD; ' +
    "hazard patterns: $& and $` and $' and $$ everywhere.";
  const papers = [
    { arxivId: '2504.01234', title: 'Circuit-level analysis of reasoning', abstract: '...' },
    { arxivId: '2504.02345', title: 'Head pruning ablations', abstract: '...' },
  ];
  let tmpFixturesDir;

  beforeAll(async () => {
    // Render the prompt exactly as the route should (function replacement,
    // no GetSubstitution), hash the callModel input the route will produce
    // in fixture mode (no caching keys), and seed the fixture under it.
    const template = await fs.readFile(
      path.resolve(process.cwd(), 'prompts', 'synthesis.md'),
      'utf8'
    );
    const fullPrompt = renderSynthesisPrompt(template, { profile: nastyProfile, papers });
    const hash = hashInput({
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      prompt: fullPrompt,
      apiKey: 'test-key',
      structuredOutput: {
        name: 'briefing',
        description: 'Aparture daily research briefing',
        schema: toJsonSchema(),
      },
    });
    // Reuse the known-good briefing response from the existing fixture
    // (same two paper IDs, passes validateBriefing).
    const existing = JSON.parse(
      await fs.readFile(path.resolve(fixturesDir, '0b950173ec403b0723e42fdcbcc83b4f.json'), 'utf8')
    );
    tmpFixturesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-synth-fixture-'));
    await fs.writeFile(
      path.join(tmpFixturesDir, `${hash}.json`),
      JSON.stringify({ response: existing.response }),
      'utf8'
    );
  });

  afterAll(async () => {
    if (tmpFixturesDir) await fs.rm(tmpFixturesDir, { recursive: true, force: true });
  });

  it('renders the prompt byte-for-byte intact for a $$-laden profile', async () => {
    const { req, res, getResponse } = createMockReqRes({
      profile: nastyProfile,
      papers,
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir: tmpFixturesDir },
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    // A corrupted prompt would miss the seeded fixture hash and 500.
    expect(jsonBody?.error).toBeUndefined();
    expect(statusCode).toBe(200);
    expect(jsonBody.briefing.papers).toHaveLength(2);
  });
});

describe('synthesize API route — deterministic trust checks (P1-4)', () => {
  // Fixture-mode responses seeded per test under the hash of the overridden
  // prompt. Only the first synthesis call has a fixture: any LLM repair the
  // route attempts misses ("no fixture found"), which is exactly the
  // repair-failed path the salvage step exists for.
  const PROMPT = 'SYNTHESIS_TRUST_CHECK_FIXTURE';
  const papers = [
    {
      arxivId: '2504.01234',
      title: 'Circuit-level analysis of reasoning',
      abstract: 'a',
      score: 9.2,
    },
    {
      arxivId: '2504.02345',
      title: 'Head pruning ablations',
      abstract: 'b',
      score: 8.5,
      engagement: { starred: true, dismissed: false },
    },
  ];
  let tmpDir;

  const seed = async (structured) => {
    const hash = hashInput({
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      prompt: PROMPT,
      apiKey: 'test-key',
      structuredOutput: {
        name: 'briefing',
        description: 'Aparture daily research briefing',
        schema: toJsonSchema(),
      },
    });
    await fs.writeFile(
      path.join(tmpDir, `${hash}.json`),
      JSON.stringify({ response: { text: '', structured, tokensIn: 100, tokensOut: 200 } }),
      'utf8'
    );
  };

  const run = async () => {
    const { req, res, getResponse } = createMockReqRes({
      profile: 'I study interpretability.',
      papers,
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir: tmpDir },
    });
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = PROMPT;
    try {
      await handler(req, res);
    } finally {
      delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    }
    return getResponse();
  };

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-synth-trust-'));
  });

  afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("overwrites a card's model-copied title and score from the input, and reports it", async () => {
    await seed({
      executiveSummary: 'Make it 2504.02345 today.',
      themes: [{ title: 't', argument: 'a', paperIds: ['2504.01234', '2504.02345'] }],
      papers: [
        // The auditor's swap: a valid id carrying another paper's title/score.
        {
          arxivId: '2504.01234',
          title: 'Head pruning ablations',
          score: 9.9,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
        {
          arxivId: '2504.02345',
          title: 'Head pruning ablations',
          score: 8.5,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    });
    const { statusCode, jsonBody } = await run();
    expect(statusCode).toBe(200);
    expect(jsonBody.repaired).toBe(false);
    expect(jsonBody.briefing.papers[0]).toMatchObject({
      title: 'Circuit-level analysis of reasoning',
      score: 9.2,
    });
    expect(jsonBody.corrections).toHaveLength(2);
  });

  it('salvages instead of failing when the repair cannot fix an orphan card and a fake id', async () => {
    await seed({
      executiveSummary: 'If you read one paper today, make it 2504.99999.',
      themes: [{ title: 't', argument: 'a', paperIds: ['2504.01234'] }],
      papers: [
        {
          arxivId: '2504.01234',
          title: 'Circuit-level analysis of reasoning',
          score: 9.2,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
        {
          arxivId: '2504.02345',
          title: 'Head pruning ablations',
          score: 8.5,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    });
    const { statusCode, jsonBody } = await run();

    // Before: validation passed (only cited ids were checked), the starred
    // card sat in no theme and never rendered, and the fake id shipped.
    expect(statusCode).toBe(200);
    expect(jsonBody.originalValidationErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/"2504\.02345" is not in any theme/),
        expect.stringMatching(/executiveSummary mentions arXiv id "2504\.99999"/),
      ])
    );
    expect(jsonBody.repairError).toMatch(/no fixture found/);
    expect(jsonBody.salvaged.length).toBeGreaterThan(0);
    const themed = jsonBody.briefing.themes.flatMap((t) => t.paperIds);
    expect(themed).toContain('2504.02345');
    expect(jsonBody.briefing.executiveSummary).not.toContain('2504.99999');
  });
});

describe("synthesize API route — the reader's pre-briefing notes reach the prompt (P1-7)", () => {
  // Same technique as the $-pattern test: seed the fixture under the hash of
  // the prompt the route SHOULD build (template + profile + papers + the
  // reader-notes section). If the route dropped the notes, the hash would
  // miss and the route would 500.
  const profile = 'I study mechanistic interpretability of large language models.';
  const papers = [
    { arxivId: '2504.01234', title: 'Circuit-level analysis of reasoning', abstract: '...' },
    { arxivId: '2504.02345', title: 'Head pruning ablations', abstract: '...' },
  ];
  const readerNotes = ['Lead with the circuit-analysis paper.'];
  let tmpFixturesDir;

  beforeAll(async () => {
    const template = await fs.readFile(
      path.resolve(process.cwd(), 'prompts', 'synthesis.md'),
      'utf8'
    );
    const prompt =
      renderSynthesisPrompt(template, { profile, papers }) + renderReaderNotesSection(readerNotes);
    expect(prompt).toContain('- "Lead with the circuit-analysis paper."');
    const hash = hashInput({
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      prompt,
      apiKey: 'test-key',
      structuredOutput: {
        name: 'briefing',
        description: 'Aparture daily research briefing',
        schema: toJsonSchema(),
      },
    });
    const existing = JSON.parse(
      await fs.readFile(path.resolve(fixturesDir, '0b950173ec403b0723e42fdcbcc83b4f.json'), 'utf8')
    );
    tmpFixturesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-synth-notes-'));
    await fs.writeFile(
      path.join(tmpFixturesDir, `${hash}.json`),
      JSON.stringify({ response: existing.response }),
      'utf8'
    );
  });

  afterAll(async () => {
    if (tmpFixturesDir) await fs.rm(tmpFixturesDir, { recursive: true, force: true });
  });

  it('appends the notes section to the prompt sent to the model', async () => {
    const { req, res, getResponse } = createMockReqRes({
      profile,
      papers,
      readerNotes,
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir: tmpFixturesDir },
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(jsonBody?.error).toBeUndefined();
    expect(statusCode).toBe(200);
  });
});

describe('synthesize API route — fixture mode is test-only (P0-2)', () => {
  it('treats client-supplied fixture mode as live (401) when NODE_ENV is not "test"', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { req, res, getResponse } = createMockReqRes({
        profile: 'I study interpretability.',
        papers: [{ arxivId: '2504.01234', title: 'T', abstract: 'A' }],
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        // No apiKey, no password — fixture mode must NOT bypass credentials
        // outside the test environment.
        callModelMode: { mode: 'fixture', fixturesDir },
      });
      await handler(req, res);
      expect(getResponse().statusCode).toBe(401);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
