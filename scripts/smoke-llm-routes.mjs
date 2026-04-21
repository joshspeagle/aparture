#!/usr/bin/env node
// Minimal live smoke test for every LLM-backed API route across all 3 providers.
//
// Usage:
//   node scripts/smoke-llm-routes.mjs [flags...]
//
// Flags (all optional, comma-separated values):
//   --only=route1,route2              limit to specific routes
//   --providers=anthropic,google      limit to specific providers
//   --model-anthropic=<user-facing-id>   override batch + briefing model for Anthropic
//   --model-google=<user-facing-id>      override batch + briefing model for Google
//   --model-openai=<user-facing-id>      override batch + briefing model for OpenAI
//   --batch-model-<provider>=<id>     override only the batch model for <provider>
//   --briefing-model-<provider>=<id>  override only the briefing model for <provider>
//
// Model overrides accept user-facing IDs from utils/models.js MODEL_REGISTRY
// (e.g. 'claude-opus-4.5', 'gemini-3-flash', 'gpt-5.4'). The smoke script
// passes them through to the API routes; each route's handler resolves the
// apiId via MODEL_REGISTRY before calling the provider.
//
// Examples:
//   # test only Anthropic with Sonnet (has adaptive thinking) instead of
//   # the default Haiku
//   node scripts/smoke-llm-routes.mjs --providers=anthropic --model-anthropic=claude-sonnet-4.6
//
//   # test a specific route on one provider with a specific model
//   node scripts/smoke-llm-routes.mjs --only=synthesize --providers=google --model-google=gemini-3-pro
//
// Loads .env.local, calls each handler in-process with callModelMode: 'live',
// and reports PASS/FAIL per (route, provider). Uses minimum-viable payloads
// (1-2 papers, short text) to keep token cost trivial.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Dynamic imports of absolute paths fail on Windows Node (ERR_UNSUPPORTED_ESM_URL_SCHEME)
// — the ESM loader rejects Windows drive-letter paths like "c:/..." and requires
// file:// URLs. Helper to produce cross-platform import specifiers.
const importRoute = (relPath) => import(pathToFileURL(path.join(projectRoot, relPath)).href);

// ---- Load .env.local into process.env ----
const envPath = path.join(projectRoot, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      // Strip surrounding quotes if present
      let value = m[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
}

// NODE_ENV=test enables the _testPdfBase64 escape hatch in analyze-pdf.js so
// we don't actually download a PDF from arxiv (we still hit the LLM live).
process.env.NODE_ENV = 'test';

const password = process.env.ACCESS_PASSWORD;
if (!password) {
  console.error('ACCESS_PASSWORD missing in .env.local — aborting.');
  process.exit(1);
}

const MINIMAL_PDF_B64 = fs
  .readFileSync(path.join(projectRoot, 'tests/fixtures/pdf/minimal.pdf'))
  .toString('base64');

// ---- Arg parsing ----
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]]] : [];
  })
);
const onlyRoutes = args.only ? new Set(args.only.split(',')) : null;
const onlyProviders = args.providers ? new Set(args.providers.split(',')) : null;

// ---- Provider table (with CLI model overrides applied) ----
// Default models are tuned for the smoke test's minimal-cost payloads. Users
// can override per-provider via --model-<provider>, or split batch vs briefing
// via --batch-model-<provider> / --briefing-model-<provider>.
function resolveModel(provider, role, defaultModel) {
  const roleKey = `${role}-model-${provider}`; // e.g. 'batch-model-anthropic'
  const bothKey = `model-${provider}`;         // e.g. 'model-anthropic'
  return args[roleKey] ?? args[bothKey] ?? defaultModel;
}

const PROVIDERS = [
  {
    name: 'anthropic',
    envKey: 'CLAUDE_API_KEY',
    batchModel: resolveModel('anthropic', 'batch', 'claude-haiku-4.5'),
    briefingProvider: 'anthropic',
    briefingModel: resolveModel('anthropic', 'briefing', 'claude-haiku-4.5'),
  },
  {
    name: 'google',
    envKey: 'GOOGLE_AI_API_KEY',
    batchModel: resolveModel('google', 'batch', 'gemini-3.1-flash-lite'),
    briefingProvider: 'google',
    briefingModel: resolveModel('google', 'briefing', 'gemini-3.1-flash-lite'),
  },
  {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    batchModel: resolveModel('openai', 'batch', 'gpt-5.4-nano'),
    briefingProvider: 'openai',
    briefingModel: resolveModel('openai', 'briefing', 'gpt-5.4-nano'),
  },
];

// ---- Mock req/res ----
function mockReqRes(body) {
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
  const req = { method: 'POST', body };
  return { req, res, state };
}

const results = [];

async function runCase(routeName, providerName, handler, body, expectedCheck) {
  if (onlyRoutes && !onlyRoutes.has(routeName)) return;
  if (onlyProviders && !onlyProviders.has(providerName)) return;
  const label = `[${routeName}][${providerName}]`;
  const start = Date.now();
  try {
    const { req, res, state } = mockReqRes(body);
    await handler(req, res);
    const elapsed = Date.now() - start;
    if (state.statusCode !== 200) {
      console.log(
        `${label} FAIL status=${state.statusCode} err=${JSON.stringify(state.jsonBody).slice(0, 200)}`
      );
      results.push({ routeName, providerName, ok: false, status: state.statusCode });
      return;
    }
    const extra = expectedCheck ? expectedCheck(state.jsonBody) : '';
    console.log(`${label} PASS ${elapsed}ms ${extra}`);
    results.push({ routeName, providerName, ok: true, ms: elapsed });
  } catch (e) {
    console.log(`${label} THROW ${e.message?.slice(0, 200)}`);
    results.push({ routeName, providerName, ok: false, error: e.message });
  }
}

// ---- Dynamic imports (handlers) ----
const quickFilter = (await importRoute('pages/api/quick-filter.js')).default;
const scoreAbs = (await importRoute('pages/api/score-abstracts.js')).default;
const rescoreAbs = (await importRoute('pages/api/rescore-abstracts.js')).default;
const analyzePdf = (await importRoute('pages/api/analyze-pdf.js')).default;
const analyzePdfQuick = (await importRoute('pages/api/analyze-pdf-quick.js')).default;
const checkBriefing = (await importRoute('pages/api/check-briefing.js')).default;
const synthesize = (await importRoute('pages/api/synthesize.js')).default;
const suggestProfile = (await importRoute('pages/api/suggest-profile.js')).default;

// ---- Shared fixtures ----
const TWO_PAPERS = [
  {
    id: '2504.01234',
    arxivId: '2504.01234',
    title: 'A minimal example paper on attention heads',
    abstract:
      'We present a short toy study of attention heads in small transformers. The method is simple.',
  },
  {
    id: '2504.02345',
    arxivId: '2504.02345',
    title: 'Sparse coding for interpretability',
    abstract:
      'We investigate sparse dictionary learning applied to transformer activations as an interpretability tool.',
  },
];
const PROFILE_TEXT = 'I study mechanistic interpretability of small transformers.';

// ---- Run all combinations ----
console.log('=== LLM route smoke test ===');
for (const p of PROVIDERS) {
  console.log(
    `  ${p.name}: batch=${p.batchModel} briefing=${p.briefingModel}` +
      (p.batchModel === p.briefingModel ? '' : ' (split)')
  );
}

for (const p of PROVIDERS) {
  if (!process.env[p.envKey]) {
    console.log(`[${p.name}] SKIP (${p.envKey} not set)`);
    continue;
  }
  const callModelMode = { mode: 'live' };

  await runCase('quick-filter', p.name, quickFilter, {
    password,
    papers: TWO_PAPERS,
    scoringCriteria: PROFILE_TEXT,
    model: p.batchModel,
    callModelMode,
  }, (b) => `verdicts=${b.verdicts?.length}`);

  await runCase('score-abstracts', p.name, scoreAbs, {
    password,
    papers: TWO_PAPERS,
    scoringCriteria: PROFILE_TEXT,
    model: p.batchModel,
    callModelMode,
  }, (b) => `scores=${b.scores?.length}`);

  await runCase('rescore-abstracts', p.name, rescoreAbs, {
    password,
    papers: TWO_PAPERS.map((p, i) => ({
      ...p,
      initialScore: [7.0, 5.5][i],
      initialJustification: 'Initial score based on abstract alignment.',
    })),
    scoringCriteria: PROFILE_TEXT,
    model: p.batchModel,
    callModelMode,
  }, (b) => `rescores=${b.rescores?.length}`);

  await runCase('analyze-pdf', p.name, analyzePdf, {
    password,
    pdfUrl: 'https://arxiv.org/pdf/2504.00001',
    scoringCriteria: PROFILE_TEXT,
    originalScore: 7.5,
    model: p.batchModel,
    _testPdfBase64: MINIMAL_PDF_B64,
    callModelMode,
  }, (b) => `score=${b.analysis?.updatedScore}`);

  await runCase('analyze-pdf-quick', p.name, analyzePdfQuick, {
    password,
    paper: {
      arxivId: '2504.01234',
      title: 'A minimal example paper',
      authors: ['Smith', 'Jones'],
      abstract: 'Short abstract.',
      scoringJustification: 'Aligned with interpretability.',
    },
    fullReport: 'A brief full report summarizing the paper in a few lines.',
    provider: p.briefingProvider,
    model: p.briefingModel,
    callModelMode,
  }, (b) => `len=${b.quickSummary?.length}`);

  await runCase('synthesize', p.name, synthesize, {
    password,
    profile: PROFILE_TEXT,
    papers: TWO_PAPERS.map((tp) => ({
      arxivId: tp.arxivId,
      title: tp.title,
      score: 7.0,
      abstract: tp.abstract,
      fullReport: 'Brief full report.',
    })),
    provider: p.briefingProvider,
    model: p.briefingModel,
    callModelMode,
  }, (b) => `themes=${b.briefing?.themes?.length}`);

  await runCase('check-briefing', p.name, checkBriefing, {
    password,
    briefing: {
      executiveSummary: 'Two related interpretability papers.',
      themes: [
        {
          title: 'Interpretability',
          argument: 'Both papers analyze transformer internals.',
          paperIds: ['2504.01234', '2504.02345'],
        },
      ],
      papers: TWO_PAPERS.map((tp) => ({
        arxivId: tp.arxivId,
        title: tp.title,
        score: 7.0,
        onelinePitch: 'Short pitch.',
        whyMatters: 'Relevant to your interests.',
      })),
    },
    papers: TWO_PAPERS.map((tp) => ({
      arxivId: tp.arxivId,
      title: tp.title,
      abstract: tp.abstract,
      quickSummary: 'Quick summary.',
    })),
    provider: p.briefingProvider,
    model: p.briefingModel,
    callModelMode,
  }, (b) => `verdict=${b.verdict}`);

  await runCase('suggest-profile', p.name, suggestProfile, {
    password,
    currentProfile: PROFILE_TEXT,
    feedback: [
      {
        id: 'evt-1',
        type: 'general-comment',
        timestamp: new Date().toISOString(),
        content: 'I would also like papers on attention-head circuits specifically.',
      },
    ],
    briefings: {},
    guidance: '',
    briefingModel: p.briefingModel,
    provider: p.briefingProvider,
    callModelMode,
  }, (b) => `changes=${b.changes?.length ?? 0}${b.noChangeReason ? ' noChange' : ''}`);
}

// ---- Summary ----
console.log('\n=== Summary ===');
const byRoute = {};
for (const r of results) {
  byRoute[r.routeName] ??= {};
  byRoute[r.routeName][r.providerName] = r.ok ? 'PASS' : `FAIL(${r.status ?? r.error?.slice(0, 40)})`;
}
for (const [route, byProv] of Object.entries(byRoute)) {
  console.log(`${route.padEnd(20)} ${Object.entries(byProv).map(([p, s]) => `${p}:${s}`).join('  ')}`);
}
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed, ${fails.length} failed`);
process.exit(fails.length > 0 ? 1 : 0);
