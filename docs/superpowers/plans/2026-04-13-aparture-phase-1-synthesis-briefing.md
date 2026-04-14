# Aparture Phase 1 — Synthesis Stage + Briefing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a synthesis pipeline stage and a magazine-quality briefing UI to the existing Aparture Next.js codebase — without touching Electron, filesystem storage, OS keychain, or the first-run wizard — so we can validate the synthesis stage works before committing to Phase 2 of the refactor.

**Architecture:** New `lib/llm/` and `lib/synthesis/` modules provide a provider abstraction (with fixture-backed test mode), provider-native structured output across Anthropic/Google/OpenAI, and zod-based schema validation with two-pass repair. A new `pages/api/synthesize.js` route runs after the existing PDF analysis stage. A new `components/briefing/` tree renders the structured synthesis output inside the existing `ArxivAnalyzer.js` tree, with a serif reading surface (Source Serif 4) wrapped in the existing sans-serif chrome (Inter). Profile lives in localStorage as prose. The last 14 days of briefings are stored in localStorage for longitudinal connection lookup. **The existing arxiv_analysis + NotebookLM outputs are preserved unchanged**; the briefing runs alongside as an additional output path, so the user can still use the tool as it exists today while testing the new synthesis pipeline.

**Tech Stack:** Next.js 14, React 18, Tailwind 3, zod (new), tiktoken (new), vitest (new), @testing-library/react + @testing-library/jest-dom + @testing-library/user-event (new), shadcn/ui via Radix primitives (new), Source Serif 4 + Inter + JetBrains Mono fonts (via Google Fonts CDN or `next/font`).

**Phase 1 is NOT:** Electron packaging, filesystem-backed state, OS keychain, first-run wizard, memory files beyond `profile.md`, feedback capture with notes, proactive question diff-apply workflow, figure image extraction (only captions + descriptions in Phase 1), daily scheduler, HTML export, or NotebookLM ZIP bundle. All of those are Phase 2.

**Source spec:** `docs/superpowers/specs/2026-04-13-aparture-refactor-design.md` (§11 Phase 1 scope is authoritative)

---

## File structure

**New directories:**

```
lib/
├── llm/
│   ├── callModel.js          # Provider abstraction + fixture mode
│   ├── hash.js               # Deterministic input hashing for fixtures
│   ├── fixtures.js           # Fixture loader
│   ├── tokenBudget.js        # Per-provider token estimation
│   ├── structured/
│   │   ├── anthropic.js      # tool_use shape
│   │   ├── google.js         # responseSchema shape
│   │   └── openai.js         # response_format strict JSON schema
│   └── providers.js          # Provider config (base URLs, headers)
├── synthesis/
│   ├── schema.js             # zod schemas for synthesis output types
│   ├── validator.js          # Schema + citation validation
│   └── repair.js             # Two-pass repair prompting

components/
└── briefing/
    ├── BriefingView.jsx         # Top-level composition
    ├── BriefingProse.jsx        # Serif reading wrapper
    ├── BriefingHeader.jsx       # Date, tagline, stats line
    ├── ExecutiveSummary.jsx
    ├── ThemeSection.jsx         # Theme label + argument + child papers
    ├── PaperCard.jsx            # Score, title, pitch, why-matters, actions
    ├── DebateBlock.jsx
    ├── LongitudinalBlock.jsx
    ├── ProactiveQuestionPanel.jsx
    ├── QuickSummaryInline.jsx   # Inline expansion
    └── FullReportSidePanel.jsx  # Right-side panel via Radix Dialog

prompts/
└── synthesis.md              # The synthesis prompt template

styles/
└── briefing.css              # Typography, palette tokens, reading rhythm

tests/
├── setup.js                  # Vitest setup (RTL config)
├── unit/
│   ├── llm/
│   │   ├── hash.test.js
│   │   ├── tokenBudget.test.js
│   │   └── fixtures.test.js
│   └── synthesis/
│       ├── schema.test.js
│       ├── validator.test.js
│       └── repair.test.js
├── integration/
│   ├── synthesize.test.js    # Replay fixtures through synthesize route
│   └── analyze-pdf-quick.test.js
├── component/
│   ├── BriefingView.test.jsx # Snapshot test with a synthesis fixture
│   ├── PaperCard.test.jsx
│   ├── DebateBlock.test.jsx
│   ├── LongitudinalBlock.test.jsx
│   └── ProactiveQuestionPanel.test.jsx
└── fixtures/
    ├── synthesis/
    │   └── <input-hash>.json  # Cached LLM responses for synthesis
    └── briefing/
        └── sample-output.json # Golden synthesis output for snapshot tests
```

**New top-level files:**

- `vitest.config.mjs` — Vitest configuration
- `pages/api/synthesize.js` — The synthesis API route
- `pages/api/analyze-pdf-quick.js` — Quick-summary generation from full report
- `hooks/useBriefing.js` — localStorage persistence for current and past briefings
- `hooks/useProfile.js` — localStorage persistence for prose profile

**Modified files:**

- `package.json` — Add vitest, zod, tiktoken, @testing-library/\*, @radix-ui/react-dialog, @radix-ui/react-collapsible, test scripts
- `styles/globals.css` — Import `briefing.css`
- `components/ArxivAnalyzer.js` — Add "Generate Briefing" button after PDF analysis completes, mount `BriefingView`, add profile textarea, add token-budget pre-flight notice

---

## Phase A — Test infrastructure and provider abstraction foundation

### Task 1: Install Vitest + React Testing Library + set up test script

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/package.json`
- Create: `/mnt/d/Dropbox/GitHub/aparture/vitest.config.mjs`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/setup.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/smoke.test.js`

- [ ] **Step 1: Install dependencies**

```bash
cd /mnt/d/Dropbox/GitHub/aparture
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `vitest.config.mjs`**

Write the file exactly as:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 3: Create `tests/setup.js`**

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Create `tests/unit/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Add test scripts to `package.json`**

Add to the `scripts` object in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 6: Run the smoke test**

```bash
npm test
```

Expected output: `1 passed` (the smoke test).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.mjs tests/setup.js tests/unit/smoke.test.js
git commit -m "chore: add vitest + RTL test infrastructure"
```

---

### Task 2: Install zod, tiktoken, and Radix primitives

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd /mnt/d/Dropbox/GitHub/aparture
npm install zod tiktoken @radix-ui/react-dialog @radix-ui/react-collapsible
```

- [ ] **Step 2: Verify installation**

```bash
npm ls zod tiktoken @radix-ui/react-dialog @radix-ui/react-collapsible
```

Expected: all four listed with versions, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod, tiktoken, Radix dialog + collapsible"
```

---

### Task 3: Create `lib/llm/hash.js` — deterministic input hashing

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/hash.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/hash.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/llm/hash.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hashInput } from '../../../lib/llm/hash.js';

describe('hashInput', () => {
  it('produces a deterministic hex string', () => {
    const input = { provider: 'anthropic', model: 'claude-opus-4-6', prompt: 'hello' };
    const h1 = hashInput(input);
    const h2 = hashInput(input);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{16,}$/);
  });

  it('is order-insensitive for object keys', () => {
    const a = hashInput({ model: 'x', prompt: 'y', provider: 'z' });
    const b = hashInput({ provider: 'z', prompt: 'y', model: 'x' });
    expect(a).toBe(b);
  });

  it('changes when any field changes', () => {
    const base = hashInput({ provider: 'a', model: 'b', prompt: 'c' });
    expect(hashInput({ provider: 'a', model: 'b', prompt: 'd' })).not.toBe(base);
    expect(hashInput({ provider: 'a', model: 'x', prompt: 'c' })).not.toBe(base);
    expect(hashInput({ provider: 'x', model: 'b', prompt: 'c' })).not.toBe(base);
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/hash.test.js
```

Expected: 3 failures, all "Cannot find module '../../../lib/llm/hash.js'".

- [ ] **Step 3: Implement `lib/llm/hash.js`**

Write to `lib/llm/hash.js`:

```js
import crypto from 'node:crypto';

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

export function hashInput(input) {
  const canonical = stableStringify(input);
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/hash.test.js
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/hash.js tests/unit/llm/hash.test.js
git commit -m "feat(llm): add deterministic input hashing for fixture lookup"
```

---

### Task 4: Create `lib/llm/fixtures.js` — fixture loader

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/fixtures.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/fixtures.test.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/fixtures/llm/example-fixture.json` (test fixture for the fixture loader itself)

- [ ] **Step 1: Write the test fixture file**

Write to `tests/fixtures/llm/example-fixture.json`:

```json
{
  "hash": "abc123def456",
  "input": { "provider": "anthropic", "prompt": "hello" },
  "response": { "text": "hi there", "tokensIn": 10, "tokensOut": 5 }
}
```

- [ ] **Step 2: Write the failing test**

Write to `tests/unit/llm/fixtures.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { loadFixture, loadFixtureByHash } from '../../../lib/llm/fixtures.js';

const fixturesDir = path.resolve(__dirname, '../../fixtures/llm');

describe('loadFixtureByHash', () => {
  it('returns the response when fixture exists', async () => {
    const result = await loadFixtureByHash('abc123def456', fixturesDir);
    expect(result).toEqual({ text: 'hi there', tokensIn: 10, tokensOut: 5 });
  });

  it('returns null when fixture does not exist', async () => {
    const result = await loadFixtureByHash('nonexistent', fixturesDir);
    expect(result).toBeNull();
  });
});

describe('loadFixture', () => {
  it('loads by hashing the input', async () => {
    // This will return null because the input hash does not match "abc123def456"
    const result = await loadFixture({ provider: 'anthropic', prompt: 'hello' }, fixturesDir);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/fixtures.test.js
```

Expected: 3 failures, module not found.

- [ ] **Step 4: Implement `lib/llm/fixtures.js`**

Write to `lib/llm/fixtures.js`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { hashInput } from './hash.js';

export async function loadFixtureByHash(hash, dir) {
  const filename = path.join(dir, `${hash}.json`);
  try {
    const raw = await fs.readFile(filename, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.response ?? null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function loadFixture(input, dir) {
  const hash = hashInput(input);
  return loadFixtureByHash(hash, dir);
}

export async function saveFixture(input, response, dir) {
  const hash = hashInput(input);
  const filename = path.join(dir, `${hash}.json`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filename, JSON.stringify({ hash, input, response }, null, 2), 'utf8');
  return hash;
}
```

- [ ] **Step 5: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/fixtures.test.js
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/llm/fixtures.js tests/unit/llm/fixtures.test.js tests/fixtures/llm/example-fixture.json
git commit -m "feat(llm): add fixture loader for test mode"
```

---

### Task 5: Create `lib/llm/callModel.js` — provider abstraction with fixture mode

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/callModel.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/providers.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/callModel.test.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/fixtures/llm/test-call-fixture.json`

- [ ] **Step 1: Create the provider config file**

Write to `lib/llm/providers.js`:

```js
export const PROVIDERS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    apiKeyHeader: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
  },
  google: {
    // Gemini uses per-model URLs; callModel constructs the final URL
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKeyQueryParam: 'key',
  },
};

export function getProviderConfig(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);
  return cfg;
}
```

- [ ] **Step 2: Write a test fixture**

Compute the hash for a known input to seed a real fixture. Run this one-off script:

```bash
node -e "
import('./lib/llm/hash.js').then(({hashInput}) => {
  const h = hashInput({provider:'anthropic',model:'test-model',prompt:'hi'});
  console.log(h);
});
"
```

Copy the printed hash and use it as the filename. Write `tests/fixtures/llm/<HASH>.json` with:

```json
{
  "hash": "<HASH>",
  "input": { "provider": "anthropic", "model": "test-model", "prompt": "hi" },
  "response": { "text": "hello from fixture", "tokensIn": 5, "tokensOut": 4 }
}
```

If the hash computation script fails to work inline (ESM/CJS issues), instead compute the hash manually by running:

```bash
node --input-type=module -e "import('./lib/llm/hash.js').then(m => console.log(m.hashInput({provider:'anthropic',model:'test-model',prompt:'hi'})))"
```

- [ ] **Step 3: Write the failing test**

Write to `tests/unit/llm/callModel.test.js`:

```js
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { callModel } from '../../../lib/llm/callModel.js';

const fixturesDir = path.resolve(__dirname, '../../fixtures/llm');

describe('callModel', () => {
  it('returns cached response in fixture mode', async () => {
    const result = await callModel(
      { provider: 'anthropic', model: 'test-model', prompt: 'hi' },
      { mode: 'fixture', fixturesDir }
    );
    expect(result.text).toBe('hello from fixture');
  });

  it('throws in fixture mode when no fixture exists', async () => {
    await expect(
      callModel(
        { provider: 'anthropic', model: 'test-model', prompt: 'nonexistent' },
        { mode: 'fixture', fixturesDir }
      )
    ).rejects.toThrow(/no fixture/i);
  });

  it('rejects unknown providers', async () => {
    await expect(
      callModel({ provider: 'bogus', model: 'x', prompt: 'y' }, { mode: 'fixture', fixturesDir })
    ).rejects.toThrow(/unknown provider/i);
  });
});
```

- [ ] **Step 4: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/callModel.test.js
```

Expected: 3 failures.

- [ ] **Step 5: Implement `lib/llm/callModel.js`**

Write to `lib/llm/callModel.js`:

```js
import { loadFixture } from './fixtures.js';
import { getProviderConfig } from './providers.js';

/**
 * Call an LLM provider.
 *
 * @param {Object} input
 * @param {'anthropic'|'openai'|'google'} input.provider
 * @param {string} input.model
 * @param {string} input.prompt           Plain-text prompt (used for fixture hashing and live fallback)
 * @param {Object} [input.structuredOutput] Optional structured-output schema
 * @param {Object} [input.providerPayload]  Optional provider-specific payload override
 * @param {string} [input.apiKey]          API key (ignored in fixture mode)
 *
 * @param {Object} options
 * @param {'live'|'fixture'} options.mode
 * @param {string} [options.fixturesDir]   Required when mode='fixture'
 *
 * @returns {Promise<{text: string, tokensIn: number, tokensOut: number, structured?: any}>}
 */
export async function callModel(input, options = { mode: 'live' }) {
  // Validate provider up front
  getProviderConfig(input.provider);

  if (options.mode === 'fixture') {
    if (!options.fixturesDir) {
      throw new Error('fixturesDir required in fixture mode');
    }
    const cached = await loadFixture(input, options.fixturesDir);
    if (cached === null) {
      throw new Error(
        `no fixture found for input (provider=${input.provider}, model=${input.model})`
      );
    }
    return cached;
  }

  // Live mode is stubbed in this task and will be filled in by subsequent
  // per-provider structured-output tasks (Tasks 6, 7, 8).
  throw new Error('live mode not yet implemented — see Tasks 6-8');
}
```

- [ ] **Step 6: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/callModel.test.js
```

Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add lib/llm/callModel.js lib/llm/providers.js tests/unit/llm/callModel.test.js tests/fixtures/llm/*.json
git commit -m "feat(llm): add provider abstraction with fixture mode"
```

---

### Task 6: Add Anthropic live mode + tool_use structured output

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/callModel.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/structured/anthropic.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/structured/anthropic.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/llm/structured/anthropic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  buildAnthropicRequest,
  parseAnthropicResponse,
} from '../../../../lib/llm/structured/anthropic.js';

describe('buildAnthropicRequest', () => {
  it('builds a plain text request without structured output', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Say hi.',
    });
    expect(req.body.model).toBe('claude-opus-4-6');
    expect(req.body.messages).toEqual([{ role: 'user', content: 'Say hi.' }]);
    expect(req.body.tools).toBeUndefined();
  });

  it('adds a tool_use tool when structuredOutput is provided', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Summarize.',
      structuredOutput: {
        name: 'summary',
        description: 'A structured summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.tools).toHaveLength(1);
    expect(req.body.tools[0].name).toBe('summary');
    expect(req.body.tools[0].input_schema).toEqual({
      type: 'object',
      properties: { headline: { type: 'string' } },
    });
    expect(req.body.tool_choice).toEqual({ type: 'tool', name: 'summary' });
  });
});

describe('parseAnthropicResponse', () => {
  it('extracts text content', () => {
    const response = {
      content: [{ type: 'text', text: 'Hello there.' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.text).toBe('Hello there.');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(3);
    expect(result.structured).toBeUndefined();
  });

  it('extracts structured tool_use payload', () => {
    const response = {
      content: [{ type: 'tool_use', name: 'summary', input: { headline: 'Big news' } }],
      usage: { input_tokens: 20, output_tokens: 8 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.structured).toEqual({ headline: 'Big news' });
    expect(result.tokensIn).toBe(20);
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/structured/anthropic.test.js
```

Expected: 4 failures, module not found.

- [ ] **Step 3: Implement `lib/llm/structured/anthropic.js`**

Write to `lib/llm/structured/anthropic.js`:

```js
export function buildAnthropicRequest({ model, prompt, structuredOutput, maxTokens = 4096 }) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (structuredOutput) {
    body.tools = [
      {
        name: structuredOutput.name,
        description: structuredOutput.description || '',
        input_schema: structuredOutput.schema,
      },
    ];
    body.tool_choice = { type: 'tool', name: structuredOutput.name };
  }
  return {
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body,
  };
}

export function parseAnthropicResponse(response) {
  const out = {
    text: '',
    tokensIn: response.usage?.input_tokens ?? 0,
    tokensOut: response.usage?.output_tokens ?? 0,
  };
  const content = response.content ?? [];
  for (const part of content) {
    if (part.type === 'text') {
      out.text += part.text;
    } else if (part.type === 'tool_use') {
      out.structured = part.input;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/structured/anthropic.test.js
```

Expected: 4 passed.

- [ ] **Step 5: Wire Anthropic live mode into `callModel.js`**

Modify `lib/llm/callModel.js` — replace the `throw new Error('live mode not yet implemented …')` line with:

```js
// Live mode
if (input.provider === 'anthropic') {
  const { buildAnthropicRequest, parseAnthropicResponse } = await import(
    './structured/anthropic.js'
  );
  const req = buildAnthropicRequest(input);
  const response = await fetch(req.url, {
    method: req.method,
    headers: {
      ...req.headers,
      'x-api-key': input.apiKey,
    },
    body: JSON.stringify(req.body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`anthropic request failed: ${response.status} ${errText}`);
  }
  const json = await response.json();
  return parseAnthropicResponse(json);
}

throw new Error(`live mode not yet implemented for provider: ${input.provider}`);
```

- [ ] **Step 6: Commit**

```bash
git add lib/llm/structured/anthropic.js lib/llm/callModel.js tests/unit/llm/structured/anthropic.test.js
git commit -m "feat(llm): add Anthropic live mode with tool_use structured output"
```

---

### Task 7: Add Google Gemini live mode + responseSchema structured output

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/callModel.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/structured/google.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/structured/google.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/llm/structured/google.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildGoogleRequest, parseGoogleResponse } from '../../../../lib/llm/structured/google.js';

describe('buildGoogleRequest', () => {
  it('builds a plain text request with a contents array', () => {
    const req = buildGoogleRequest({
      model: 'gemini-2.5-flash',
      prompt: 'Say hi.',
      apiKey: 'test-key',
    });
    expect(req.url).toContain('gemini-2.5-flash');
    expect(req.url).toContain('key=test-key');
    expect(req.body.contents[0].parts[0].text).toBe('Say hi.');
    expect(req.body.generationConfig?.responseSchema).toBeUndefined();
  });

  it('adds responseSchema + responseMimeType when structuredOutput is provided', () => {
    const req = buildGoogleRequest({
      model: 'gemini-2.5-flash',
      prompt: 'Summarize.',
      apiKey: 'test-key',
      structuredOutput: {
        name: 'summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.generationConfig.responseMimeType).toBe('application/json');
    expect(req.body.generationConfig.responseSchema).toEqual({
      type: 'object',
      properties: { headline: { type: 'string' } },
    });
  });
});

describe('parseGoogleResponse', () => {
  it('extracts text content', () => {
    const response = {
      candidates: [{ content: { parts: [{ text: 'Hello.' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
    };
    const result = parseGoogleResponse(response);
    expect(result.text).toBe('Hello.');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(2);
  });

  it('parses structured JSON when responseSchema was requested', () => {
    const response = {
      candidates: [{ content: { parts: [{ text: '{"headline":"Big news"}' }] } }],
      usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 5 },
    };
    const result = parseGoogleResponse(response, { expectStructured: true });
    expect(result.structured).toEqual({ headline: 'Big news' });
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/structured/google.test.js
```

Expected: 4 failures.

- [ ] **Step 3: Implement `lib/llm/structured/google.js`**

Write to `lib/llm/structured/google.js`:

```js
export function buildGoogleRequest({ model, prompt, apiKey, structuredOutput }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {},
  };
  if (structuredOutput) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = structuredOutput.schema;
  }
  return {
    url,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  };
}

export function parseGoogleResponse(response, options = {}) {
  const candidates = response.candidates ?? [];
  const first = candidates[0];
  const parts = first?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('');
  const out = {
    text,
    tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
  if (options.expectStructured) {
    try {
      out.structured = JSON.parse(text);
    } catch (err) {
      throw new Error(`failed to parse Google structured response as JSON: ${err.message}`);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/structured/google.test.js
```

Expected: 4 passed.

- [ ] **Step 5: Wire Google live mode into `callModel.js`**

Modify `lib/llm/callModel.js` — add a branch before the `throw new Error('live mode not yet implemented for provider: ...')` line:

```js
if (input.provider === 'google') {
  const { buildGoogleRequest, parseGoogleResponse } = await import('./structured/google.js');
  const req = buildGoogleRequest({ ...input, apiKey: input.apiKey });
  const response = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`google request failed: ${response.status} ${errText}`);
  }
  const json = await response.json();
  return parseGoogleResponse(json, { expectStructured: !!input.structuredOutput });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/llm/structured/google.js lib/llm/callModel.js tests/unit/llm/structured/google.test.js
git commit -m "feat(llm): add Google Gemini live mode with responseSchema structured output"
```

---

### Task 8: Add OpenAI live mode + response_format structured output

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/callModel.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/structured/openai.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/structured/openai.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/llm/structured/openai.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildOpenAIRequest, parseOpenAIResponse } from '../../../../lib/llm/structured/openai.js';

describe('buildOpenAIRequest', () => {
  it('builds a plain text request', () => {
    const req = buildOpenAIRequest({ model: 'gpt-5.2', prompt: 'Say hi.' });
    expect(req.body.model).toBe('gpt-5.2');
    expect(req.body.messages).toEqual([{ role: 'user', content: 'Say hi.' }]);
    expect(req.body.response_format).toBeUndefined();
  });

  it('adds a strict json_schema response_format when structuredOutput is provided', () => {
    const req = buildOpenAIRequest({
      model: 'gpt-5.2',
      prompt: 'Summarize.',
      structuredOutput: {
        name: 'summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'summary',
        strict: true,
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
  });
});

describe('parseOpenAIResponse', () => {
  it('extracts text content', () => {
    const response = {
      choices: [{ message: { content: 'Hello.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    };
    const result = parseOpenAIResponse(response);
    expect(result.text).toBe('Hello.');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(2);
  });

  it('parses structured JSON when requested', () => {
    const response = {
      choices: [{ message: { content: '{"headline":"Big news"}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 5 },
    };
    const result = parseOpenAIResponse(response, { expectStructured: true });
    expect(result.structured).toEqual({ headline: 'Big news' });
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/structured/openai.test.js
```

Expected: 4 failures.

- [ ] **Step 3: Implement `lib/llm/structured/openai.js`**

Write to `lib/llm/structured/openai.js`:

```js
export function buildOpenAIRequest({ model, prompt, structuredOutput }) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };
  if (structuredOutput) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: structuredOutput.name,
        strict: true,
        schema: structuredOutput.schema,
      },
    };
  }
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  };
}

export function parseOpenAIResponse(response, options = {}) {
  const choices = response.choices ?? [];
  const text = choices[0]?.message?.content ?? '';
  const out = {
    text,
    tokensIn: response.usage?.prompt_tokens ?? 0,
    tokensOut: response.usage?.completion_tokens ?? 0,
  };
  if (options.expectStructured) {
    try {
      out.structured = JSON.parse(text);
    } catch (err) {
      throw new Error(`failed to parse OpenAI structured response as JSON: ${err.message}`);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/structured/openai.test.js
```

Expected: 4 passed.

- [ ] **Step 5: Wire OpenAI live mode into `callModel.js`**

Modify `lib/llm/callModel.js` — add a branch before the final unimplemented throw:

```js
if (input.provider === 'openai') {
  const { buildOpenAIRequest, parseOpenAIResponse } = await import('./structured/openai.js');
  const req = buildOpenAIRequest(input);
  const response = await fetch(req.url, {
    method: req.method,
    headers: {
      ...req.headers,
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(req.body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`openai request failed: ${response.status} ${errText}`);
  }
  const json = await response.json();
  return parseOpenAIResponse(json, { expectStructured: !!input.structuredOutput });
}
```

After this branch there should be no remaining "not implemented" error — all three providers are now wired.

- [ ] **Step 6: Commit**

```bash
git add lib/llm/structured/openai.js lib/llm/callModel.js tests/unit/llm/structured/openai.test.js
git commit -m "feat(llm): add OpenAI live mode with response_format strict json_schema"
```

---

### Task 9: Create `lib/llm/tokenBudget.js` — per-provider token estimation

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/llm/tokenBudget.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/llm/tokenBudget.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/llm/tokenBudget.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { estimateTokens, budgetPreflight } from '../../../lib/llm/tokenBudget.js';

describe('estimateTokens', () => {
  it('uses tiktoken for OpenAI', () => {
    const n = estimateTokens({ provider: 'openai', model: 'gpt-5.2', text: 'hello world' });
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(10);
  });

  it('uses char-based heuristic for Anthropic', () => {
    const text = 'a'.repeat(400);
    const n = estimateTokens({ provider: 'anthropic', model: 'claude-opus-4-6', text });
    // ~4 chars per token heuristic
    expect(n).toBeGreaterThan(80);
    expect(n).toBeLessThan(120);
  });

  it('uses char-based heuristic for Google', () => {
    const text = 'a'.repeat(400);
    const n = estimateTokens({ provider: 'google', model: 'gemini-2.5-flash', text });
    expect(n).toBeGreaterThan(80);
    expect(n).toBeLessThan(120);
  });
});

describe('budgetPreflight', () => {
  it('returns "proceed" below the low threshold', () => {
    const result = budgetPreflight({ estimatedTokens: 1000 });
    expect(result.action).toBe('proceed');
  });

  it('returns "notice" between 150k and 500k', () => {
    const result = budgetPreflight({ estimatedTokens: 200_000 });
    expect(result.action).toBe('notice');
  });

  it('returns "block" above 500k', () => {
    const result = budgetPreflight({ estimatedTokens: 600_000 });
    expect(result.action).toBe('block');
  });

  it('honors custom thresholds', () => {
    const result = budgetPreflight({
      estimatedTokens: 50_000,
      thresholds: { notice: 10_000, block: 100_000 },
    });
    expect(result.action).toBe('notice');
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/llm/tokenBudget.test.js
```

Expected: 7 failures.

- [ ] **Step 3: Implement `lib/llm/tokenBudget.js`**

Write to `lib/llm/tokenBudget.js`:

```js
// Token estimation with per-provider strategies.
//
// - OpenAI: use tiktoken (cl100k_base) for reasonable accuracy.
// - Anthropic / Google: use a char-based heuristic (~4 chars/token).
//
// These are approximations used for pre-flight budget decisions, not for
// cost accounting. Real token counts come from the provider response.

export function estimateTokens({ provider, model, text }) {
  if (provider === 'openai') {
    // Lazy-load tiktoken since it's a WASM module and slow to import.
    try {
      // eslint-disable-next-line global-require
      const { encoding_for_model, get_encoding } = require('tiktoken');
      let enc;
      try {
        enc = encoding_for_model(model);
      } catch {
        enc = get_encoding('cl100k_base');
      }
      const tokens = enc.encode(text).length;
      enc.free?.();
      return tokens;
    } catch {
      // Fall through to heuristic if tiktoken unavailable
    }
  }
  // Char-based heuristic: ~4 chars per token
  return Math.ceil(text.length / 4);
}

const DEFAULT_THRESHOLDS = { notice: 150_000, block: 500_000 };

export function budgetPreflight({ estimatedTokens, thresholds = DEFAULT_THRESHOLDS }) {
  if (estimatedTokens >= thresholds.block) return { action: 'block', estimatedTokens };
  if (estimatedTokens >= thresholds.notice) return { action: 'notice', estimatedTokens };
  return { action: 'proceed', estimatedTokens };
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/llm/tokenBudget.test.js
```

Expected: 7 passed. If the OpenAI test fails because `tiktoken` is not available, the heuristic fallback will produce ~3 tokens for "hello world" which still satisfies the `greaterThan(0)` and `lessThan(10)` assertions.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/tokenBudget.js tests/unit/llm/tokenBudget.test.js
git commit -m "feat(llm): add per-provider token estimation and budget preflight"
```

---

## Phase B — Structured output schema + validation + repair

### Task 10: Create `lib/synthesis/schema.js` — zod schemas for synthesis output

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/synthesis/schema.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/synthesis/schema.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/synthesis/schema.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { BriefingSchema, toJsonSchema } from '../../../lib/synthesis/schema.js';

describe('BriefingSchema', () => {
  it('accepts a well-formed briefing', () => {
    const briefing = {
      executiveSummary: 'Today in ML, three threads converge on interpretability.',
      themes: [
        {
          title: 'Interpretability converges on attention heads',
          argument: 'Two papers tighten the attention-head-level analysis story.',
          paperIds: ['2504.01234', '2504.02345'],
        },
      ],
      papers: [
        {
          arxivId: '2504.01234',
          title: 'Circuit-level analysis of reasoning',
          score: 9.2,
          onelinePitch:
            'A mechanistic account of how attention heads compose into reasoning steps.',
          whyMatters: 'Grounded in your stated interest in mechanistic interpretability.',
          figures: [],
          quickSummaryPath: 'reports/2026-04-13/papers/2504.01234-quick.md',
          fullReportPath: 'reports/2026-04-13/papers/2504.01234-full.md',
        },
        {
          arxivId: '2504.02345',
          title: 'Head pruning ablations',
          score: 8.5,
          onelinePitch:
            'Ablation evidence that only a small subset of attention heads matter for task X.',
          whyMatters: 'Directly tests the framing from your March 3 starred paper.',
          figures: [],
          quickSummaryPath: 'reports/2026-04-13/papers/2504.02345-quick.md',
          fullReportPath: 'reports/2026-04-13/papers/2504.02345-full.md',
        },
      ],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    const result = BriefingSchema.safeParse(briefing);
    expect(result.success).toBe(true);
  });

  it('rejects a briefing with a missing required field', () => {
    const briefing = { themes: [], papers: [] }; // missing executiveSummary
    const result = BriefingSchema.safeParse(briefing);
    expect(result.success).toBe(false);
  });
});

describe('toJsonSchema', () => {
  it('emits a JSON schema for provider-native structured output', () => {
    const schema = toJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties.executiveSummary).toBeDefined();
    expect(schema.properties.themes).toBeDefined();
    expect(schema.properties.papers).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/synthesis/schema.test.js
```

Expected: 3 failures.

- [ ] **Step 3: Implement `lib/synthesis/schema.js`**

Write to `lib/synthesis/schema.js`:

```js
import { z } from 'zod';

const FigureSchema = z.object({
  caption: z.string(),
  description: z.string(),
  page: z.number().int().optional(),
});

const PaperCardSchema = z.object({
  arxivId: z.string().min(1),
  title: z.string().min(1),
  score: z.number().min(0).max(10),
  onelinePitch: z.string().min(1),
  whyMatters: z.string().min(1),
  figures: z.array(FigureSchema).default([]),
  quickSummaryPath: z.string(),
  fullReportPath: z.string(),
});

const ThemeSectionSchema = z.object({
  title: z.string().min(1),
  argument: z.string().min(1),
  paperIds: z.array(z.string()).min(1),
});

const DebateBlockSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  paperIds: z.array(z.string()).min(2),
  stance: z.enum(['tension', 'builds-on', 'compromise']).default('tension'),
});

const LongitudinalConnectionSchema = z.object({
  summary: z.string().min(1),
  todayPaperId: z.string(),
  pastPaperId: z.string(),
  pastDate: z.string(),
});

const ProactiveQuestionSchema = z.object({
  question: z.string().min(1),
  proposedMemoryPatch: z.string().optional(),
});

export const BriefingSchema = z.object({
  executiveSummary: z.string().min(1),
  themes: z.array(ThemeSectionSchema),
  papers: z.array(PaperCardSchema),
  debates: z.array(DebateBlockSchema).default([]),
  longitudinal: z.array(LongitudinalConnectionSchema).default([]),
  proactiveQuestions: z.array(ProactiveQuestionSchema).default([]),
});

// Emit a plain JSON Schema for use in provider-native structured output.
// We write this by hand rather than auto-generating from zod because the
// provider schemas require stable shapes and limited features.
export function toJsonSchema() {
  return {
    type: 'object',
    required: ['executiveSummary', 'themes', 'papers'],
    properties: {
      executiveSummary: { type: 'string' },
      themes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'argument', 'paperIds'],
          properties: {
            title: { type: 'string' },
            argument: { type: 'string' },
            paperIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      papers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['arxivId', 'title', 'score', 'onelinePitch', 'whyMatters'],
          properties: {
            arxivId: { type: 'string' },
            title: { type: 'string' },
            score: { type: 'number' },
            onelinePitch: { type: 'string' },
            whyMatters: { type: 'string' },
            figures: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  caption: { type: 'string' },
                  description: { type: 'string' },
                  page: { type: 'integer' },
                },
              },
            },
            quickSummaryPath: { type: 'string' },
            fullReportPath: { type: 'string' },
          },
        },
      },
      debates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'summary', 'paperIds'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            paperIds: { type: 'array', items: { type: 'string' } },
            stance: { type: 'string', enum: ['tension', 'builds-on', 'compromise'] },
          },
        },
      },
      longitudinal: {
        type: 'array',
        items: {
          type: 'object',
          required: ['summary', 'todayPaperId', 'pastPaperId', 'pastDate'],
          properties: {
            summary: { type: 'string' },
            todayPaperId: { type: 'string' },
            pastPaperId: { type: 'string' },
            pastDate: { type: 'string' },
          },
        },
      },
      proactiveQuestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['question'],
          properties: {
            question: { type: 'string' },
            proposedMemoryPatch: { type: 'string' },
          },
        },
      },
    },
  };
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/synthesis/schema.test.js
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/synthesis/schema.js tests/unit/synthesis/schema.test.js
git commit -m "feat(synthesis): add zod + JSON schema for briefing output"
```

---

### Task 11: Create `lib/synthesis/validator.js` — citation validation

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/synthesis/validator.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/synthesis/validator.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/synthesis/validator.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateCitations } from '../../../lib/synthesis/validator.js';

const inputPaperIds = ['2504.01234', '2504.02345', '2504.03456'];

describe('validateCitations', () => {
  it('returns ok for a briefing with valid citations', () => {
    const briefing = {
      papers: inputPaperIds.map((id) => ({ arxivId: id })),
      themes: [{ paperIds: ['2504.01234'] }],
      debates: [{ paperIds: ['2504.02345', '2504.03456'] }],
      longitudinal: [],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags a paper in a theme that is not in the input list', () => {
    const briefing = {
      papers: [{ arxivId: '2504.01234' }],
      themes: [{ paperIds: ['2504.99999'] }],
      debates: [],
      longitudinal: [],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('2504.99999'))).toBe(true);
  });

  it('flags a paper card whose arxivId is not in the input list', () => {
    const briefing = {
      papers: [{ arxivId: '2504.88888' }],
      themes: [],
      debates: [],
      longitudinal: [],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('2504.88888'))).toBe(true);
  });

  it('flags longitudinal todayPaperId not in input list', () => {
    const briefing = {
      papers: [{ arxivId: '2504.01234' }],
      themes: [],
      debates: [],
      longitudinal: [{ todayPaperId: '2504.77777', pastPaperId: 'old-1' }],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('2504.77777'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/synthesis/validator.test.js
```

Expected: 4 failures.

- [ ] **Step 3: Implement `lib/synthesis/validator.js`**

Write to `lib/synthesis/validator.js`:

```js
import { BriefingSchema } from './schema.js';

// Run zod schema validation first; if that passes, run citation validation.
export function validateBriefing(briefing, inputPaperIds) {
  const schemaResult = BriefingSchema.safeParse(briefing);
  if (!schemaResult.success) {
    return {
      ok: false,
      errors: schemaResult.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`),
    };
  }
  return validateCitations(schemaResult.data, inputPaperIds);
}

export function validateCitations(briefing, inputPaperIds) {
  const errors = [];
  const allowed = new Set(inputPaperIds);

  // PaperCard.arxivId
  for (const paper of briefing.papers ?? []) {
    if (!allowed.has(paper.arxivId)) {
      errors.push(`paperCard references unknown arxivId "${paper.arxivId}" (not in input list)`);
    }
  }

  // ThemeSection.paperIds
  for (const theme of briefing.themes ?? []) {
    for (const id of theme.paperIds ?? []) {
      if (!allowed.has(id)) {
        errors.push(`theme "${theme.title ?? '(untitled)'}" references unknown arxivId "${id}"`);
      }
    }
  }

  // DebateBlock.paperIds
  for (const debate of briefing.debates ?? []) {
    for (const id of debate.paperIds ?? []) {
      if (!allowed.has(id)) {
        errors.push(`debate "${debate.title ?? '(untitled)'}" references unknown arxivId "${id}"`);
      }
    }
  }

  // LongitudinalConnection.todayPaperId (pastPaperId is allowed to be anything since past papers may not be in today's input)
  for (const conn of briefing.longitudinal ?? []) {
    if (conn.todayPaperId && !allowed.has(conn.todayPaperId)) {
      errors.push(`longitudinal connection references unknown todayPaperId "${conn.todayPaperId}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/synthesis/validator.test.js
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/synthesis/validator.js tests/unit/synthesis/validator.test.js
git commit -m "feat(synthesis): add citation validator for briefing output"
```

---

### Task 12: Create `lib/synthesis/repair.js` — two-pass repair prompting

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/synthesis/repair.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/synthesis/repair.test.js`

- [ ] **Step 1: Write the failing test**

Write to `tests/unit/synthesis/repair.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { repairBriefing } from '../../../lib/synthesis/repair.js';

describe('repairBriefing', () => {
  it('returns the original if validation passes', async () => {
    const briefing = {
      executiveSummary: 'ok',
      themes: [{ title: 't', argument: 'a', paperIds: ['p1'] }],
      papers: [
        {
          arxivId: 'p1',
          title: 'x',
          score: 5,
          onelinePitch: 'p',
          whyMatters: 'w',
          figures: [],
          quickSummaryPath: 'q',
          fullReportPath: 'f',
        },
      ],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    const callModel = vi.fn();
    const result = await repairBriefing({
      briefing,
      inputPaperIds: ['p1'],
      callModel,
    });
    expect(result.briefing).toEqual(briefing);
    expect(result.repaired).toBe(false);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('asks the model to repair when validation fails', async () => {
    const brokenBriefing = {
      executiveSummary: 'ok',
      themes: [],
      papers: [
        {
          arxivId: 'p-wrong',
          title: 'x',
          score: 5,
          onelinePitch: 'p',
          whyMatters: 'w',
          figures: [],
          quickSummaryPath: 'q',
          fullReportPath: 'f',
        },
      ],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    const fixedBriefing = {
      ...brokenBriefing,
      papers: [{ ...brokenBriefing.papers[0], arxivId: 'p1' }],
    };
    const callModel = vi.fn().mockResolvedValue({
      structured: fixedBriefing,
      text: '',
      tokensIn: 0,
      tokensOut: 0,
    });
    const result = await repairBriefing({
      briefing: brokenBriefing,
      inputPaperIds: ['p1'],
      callModel,
      llmConfig: { provider: 'anthropic', model: 'claude-opus-4-6', apiKey: 'k' },
    });
    expect(result.repaired).toBe(true);
    expect(result.briefing.papers[0].arxivId).toBe('p1');
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('throws if repair still fails validation', async () => {
    const brokenBriefing = {
      executiveSummary: 'ok',
      themes: [],
      papers: [
        {
          arxivId: 'still-wrong',
          title: 'x',
          score: 5,
          onelinePitch: 'p',
          whyMatters: 'w',
          figures: [],
          quickSummaryPath: 'q',
          fullReportPath: 'f',
        },
      ],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    const callModel = vi.fn().mockResolvedValue({
      structured: brokenBriefing,
      text: '',
      tokensIn: 0,
      tokensOut: 0,
    });
    await expect(
      repairBriefing({
        briefing: brokenBriefing,
        inputPaperIds: ['p1'],
        callModel,
        llmConfig: { provider: 'anthropic', model: 'claude-opus-4-6', apiKey: 'k' },
      })
    ).rejects.toThrow(/repair failed/i);
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/synthesis/repair.test.js
```

Expected: 3 failures.

- [ ] **Step 3: Implement `lib/synthesis/repair.js`**

Write to `lib/synthesis/repair.js`:

````js
import { validateBriefing } from './validator.js';
import { toJsonSchema } from './schema.js';

export async function repairBriefing({ briefing, inputPaperIds, callModel, llmConfig }) {
  const firstCheck = validateBriefing(briefing, inputPaperIds);
  if (firstCheck.ok) {
    return { briefing, repaired: false };
  }

  if (!callModel || !llmConfig) {
    throw new Error(
      `briefing validation failed and no repair callModel provided: ${firstCheck.errors.join('; ')}`
    );
  }

  const repairPrompt = buildRepairPrompt({
    originalBriefing: briefing,
    inputPaperIds,
    errors: firstCheck.errors,
  });

  const repaired = await callModel({
    ...llmConfig,
    prompt: repairPrompt,
    structuredOutput: {
      name: 'briefing',
      description: 'Aparture daily research briefing',
      schema: toJsonSchema(),
    },
  });

  if (!repaired?.structured) {
    throw new Error('repair callModel returned no structured output');
  }

  const secondCheck = validateBriefing(repaired.structured, inputPaperIds);
  if (!secondCheck.ok) {
    throw new Error(`repair failed: ${secondCheck.errors.join('; ')}`);
  }

  return { briefing: secondCheck.data ?? repaired.structured, repaired: true };
}

function buildRepairPrompt({ originalBriefing, inputPaperIds, errors }) {
  return [
    'You previously emitted a briefing that failed validation. Here is the original briefing:',
    '```json',
    JSON.stringify(originalBriefing, null, 2),
    '```',
    '',
    "The allowed set of arxivIds for today's run is:",
    inputPaperIds.map((id) => `- ${id}`).join('\n'),
    '',
    'The following validation errors were detected:',
    errors.map((e) => `- ${e}`).join('\n'),
    '',
    'Please emit a corrected briefing that (a) references only arxivIds from the allowed list, (b) preserves the original structure and content as much as possible while fixing the errors, (c) does not invent new papers. Respond with the corrected structured briefing.',
  ].join('\n');
}
````

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/synthesis/repair.test.js
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/synthesis/repair.js tests/unit/synthesis/repair.test.js
git commit -m "feat(synthesis): add two-pass repair prompting for validation failures"
```

---

## Phase C — Synthesis prompt + API route

### Task 13: Create `prompts/synthesis.md` — the synthesis prompt template

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/prompts/synthesis.md`

- [ ] **Step 1: Write the prompt template**

Write to `prompts/synthesis.md`:

```markdown
You are Aparture, a daily research triage and synthesis system for academic researchers. Your job is to take a day's worth of pre-analyzed arXiv papers and produce a coherent cross-paper briefing that tells the user what's worth their attention today, grouped by theme, with arguments for every inclusion.

# The user's profile

The user has written the following description of their research interests. Use it to ground every "why this matters to you" statement in real specifics about the user, not generic academic rhetoric.
```

{{profile}}

```

# Today's papers

Below are today's final-round papers. Each has a full technical report (~800-1500 words, dense re-derivation), a quick summary (~300 words), and metadata. **You must only reference papers whose arxivId appears in this list.** Inventing paper IDs is a hard failure.

```

{{papers}}

```

# Recent history (last 14 days)

For longitudinal connections, here are papers the user engaged with recently (starred, dismissed, or annotated). Use this to flag follow-ups, conflicts, or builds-on relationships when today's papers relate to recent interests.

```

{{history}}

```

# What to produce

Return a structured briefing with the following components:

## `executiveSummary` (one paragraph, ~80-120 words)

A single paragraph that sets up what happened in the user's field today. First sentence is the headline. Avoid generic openings ("Today in X field..."). Be specific: name the thread, name the tension, name what the user should walk away knowing. Do not list papers by name in the summary — that is the rest of the briefing's job.

## `themes` (2-5 thematic groupings)

Each theme has:
- `title`: a short headline (6-12 words) that reads as an argument or observation, not a label. Good: "Interpretability converges on attention heads." Bad: "Interpretability papers."
- `argument`: a 2-3 sentence paragraph explaining why these papers belong together and what the user should take away from the grouping. Think editorial register, not section header.
- `paperIds`: the arxivIds of the papers contained in this theme. Every paper in `papers` should appear in at least one theme.

## `papers` (one per final-round paper)

Each paper card has:
- `arxivId`: the paper's arXiv identifier (must match one from the input list)
- `title`: the full paper title
- `score`: the relevance score from the PDF analysis stage
- `onelinePitch`: a 15-25 word italicized pitch that captures the paper's argument or contribution. Not a summary — a pitch. What would this paper say if it were pitching itself in one sentence?
- `whyMatters`: a 2-4 sentence paragraph grounded in the user's profile. Reference the user's stated interests by name. Do not write generic academic commentary. Good: "This directly tests the framing in your March 3 starred paper on [specific topic]." Bad: "This paper is relevant to interpretability research."
- `figures`: an array of figure objects if the PDF analysis identified figures. May be empty.
- `quickSummaryPath`, `fullReportPath`: file paths to the drill-down artifacts (provided in the input)

## `debates` (0-5 debate blocks)

Only include a debate block when two or more of today's papers are actually in tension, build on each other, or propose a compromise. Each debate has:
- `title`: a short phrase naming the tension
- `summary`: a 2-4 sentence paragraph explaining what the papers disagree about (or agree about) and why it matters
- `paperIds`: the papers involved (at least 2)
- `stance`: one of `tension`, `builds-on`, `compromise`

Do not force debates. If the papers are not in dialogue, return an empty array.

## `longitudinal` (0-5 connections)

Only include when today's papers actually relate to papers from the user's recent history. Each connection has:
- `summary`: "This is a follow-up to..." or "This conflicts with..." or "This builds on..."
- `todayPaperId`: the arxivId from today's papers
- `pastPaperId`: the arxivId from the user's history
- `pastDate`: the date of the past paper's briefing

Do not invent longitudinal connections. If nothing connects to the history, return an empty array.

## `proactiveQuestions` (0-2 questions)

At most two questions the model wants to ask the user to update its understanding of their interests. These must be specific, grounded in something you noticed during today's run, and answerable in a sentence or two. Good: "You've starred 3 papers on normalizing flows this week — should I weight flow-based methods higher in scoring, or is this a temporary interest?" Bad: "Would you like to refine your preferences?"

These are not chat messages. They are file editor proposals. Each question may include a `proposedMemoryPatch` that describes what you would change about the user's profile if they answered yes.

# Style and voice

- Write like a serious editor at an academic briefing publication. Not like a chatbot. Not like an "AI assistant."
- Reference the user by their profile's actual contents. Be specific.
- Do not use emoji. Do not use gratuitous bold or italics.
- Do not apologize, hedge, or offer caveats. If you do not know, skip the claim.
- Do not list papers in a bibliography format inside the executive summary or theme arguments — those are in `papers`.
- Preserve the `arxivId` of every paper exactly as given. Do not normalize, shorten, or reformat.

# Hard constraints

- Every `arxivId` you emit in `papers`, `themes.paperIds`, or `debates.paperIds` must be from the input list.
- `executiveSummary` is required and must be non-empty.
- `themes` is required and must contain at least one theme.
- `papers` is required and must contain one entry per final-round paper from the input list.
- Do not emit any field not defined in the schema.
```

- [ ] **Step 2: Verify the file was written**

```bash
head -20 /mnt/d/Dropbox/GitHub/aparture/prompts/synthesis.md
```

Expected: the first 20 lines of the prompt template.

- [ ] **Step 3: Commit**

```bash
git add prompts/synthesis.md
git commit -m "feat(synthesis): add synthesis prompt template"
```

---

### Task 14: Create `pages/api/synthesize.js` — the synthesis API route

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/pages/api/synthesize.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/lib/synthesis/renderPrompt.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/synthesis/renderPrompt.test.js`

- [ ] **Step 1: Write the failing test for prompt rendering**

Write to `tests/unit/synthesis/renderPrompt.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderSynthesisPrompt } from '../../../lib/synthesis/renderPrompt.js';

describe('renderSynthesisPrompt', () => {
  it('substitutes profile, papers, and history', () => {
    const template = 'profile={{profile}}\npapers={{papers}}\nhistory={{history}}';
    const rendered = renderSynthesisPrompt(template, {
      profile: 'I study X.',
      papers: [{ arxivId: '1', title: 't' }],
      history: [],
    });
    expect(rendered).toContain('profile=I study X.');
    expect(rendered).toContain('"arxivId": "1"');
    expect(rendered).toContain('history=[]');
  });

  it('throws if template is missing required slots', () => {
    expect(() =>
      renderSynthesisPrompt('profile={{profile}}', {
        profile: 'x',
        papers: [],
        history: [],
      })
    ).toThrow(/missing template slot/i);
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npm test -- tests/unit/synthesis/renderPrompt.test.js
```

Expected: 2 failures.

- [ ] **Step 3: Implement `lib/synthesis/renderPrompt.js`**

Write to `lib/synthesis/renderPrompt.js`:

```js
const REQUIRED_SLOTS = ['profile', 'papers', 'history'];

export function renderSynthesisPrompt(template, context) {
  for (const slot of REQUIRED_SLOTS) {
    if (!template.includes(`{{${slot}}}`)) {
      throw new Error(`missing template slot: {{${slot}}}`);
    }
  }
  let out = template;
  out = out.replaceAll('{{profile}}', context.profile ?? '');
  out = out.replaceAll('{{papers}}', JSON.stringify(context.papers ?? [], null, 2));
  out = out.replaceAll('{{history}}', JSON.stringify(context.history ?? [], null, 2));
  return out;
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
npm test -- tests/unit/synthesis/renderPrompt.test.js
```

Expected: 2 passed.

- [ ] **Step 5: Implement `pages/api/synthesize.js`**

Write to `pages/api/synthesize.js`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { renderSynthesisPrompt } from '../../lib/synthesis/renderPrompt.js';
import { toJsonSchema } from '../../lib/synthesis/schema.js';
import { validateBriefing } from '../../lib/synthesis/validator.js';
import { repairBriefing } from '../../lib/synthesis/repair.js';
import { estimateTokens, budgetPreflight } from '../../lib/llm/tokenBudget.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    profile,
    papers,
    history,
    provider,
    model,
    apiKey,
    budgetThresholds,
    allowOverBudget = false,
  } = req.body ?? {};

  if (!profile || !Array.isArray(papers) || !provider || !model || !apiKey) {
    res.status(400).json({
      error: 'missing required fields: profile, papers[], provider, model, apiKey',
    });
    return;
  }

  try {
    // Load the synthesis prompt template
    const templatePath = path.resolve(process.cwd(), 'prompts', 'synthesis.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const prompt = renderSynthesisPrompt(template, { profile, papers, history: history ?? [] });

    // Token budget pre-flight
    const estimatedTokens = estimateTokens({ provider, model, text: prompt });
    const preflight = budgetPreflight({ estimatedTokens, thresholds: budgetThresholds });
    if (preflight.action === 'block' && !allowOverBudget) {
      res.status(400).json({
        error: 'synthesis prompt exceeds token budget',
        estimatedTokens,
        action: 'block',
      });
      return;
    }

    const inputPaperIds = papers.map((p) => p.arxivId);

    // First call
    const response = await callModel(
      {
        provider,
        model,
        prompt,
        apiKey,
        structuredOutput: {
          name: 'briefing',
          description: 'Aparture daily research briefing',
          schema: toJsonSchema(),
        },
      },
      { mode: 'live' }
    );

    if (!response.structured) {
      res.status(502).json({
        error: 'model did not return structured output',
        text: response.text,
      });
      return;
    }

    // Validate
    const validation = validateBriefing(response.structured, inputPaperIds);
    if (validation.ok) {
      res.status(200).json({
        briefing: response.structured,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        repaired: false,
        preflight,
      });
      return;
    }

    // Repair
    const { briefing, repaired } = await repairBriefing({
      briefing: response.structured,
      inputPaperIds,
      callModel: (input) => callModel(input, { mode: 'live' }),
      llmConfig: { provider, model, apiKey },
    });

    res.status(200).json({
      briefing,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      repaired,
      preflight,
      originalValidationErrors: validation.errors,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add pages/api/synthesize.js lib/synthesis/renderPrompt.js tests/unit/synthesis/renderPrompt.test.js
git commit -m "feat(api): add synthesize route with repair + token budget preflight"
```

---

### Task 15: Integration test for synthesize using fixture mode

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/integration/synthesize.test.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/fixtures/synthesis/sample-good-briefing.json`
- Modify: `/mnt/d/Dropbox/GitHub/aparture/pages/api/synthesize.js` — make callModel mode injectable via req.body for tests

- [ ] **Step 1: Modify synthesize.js to accept an optional `callModelMode` field**

In `pages/api/synthesize.js`, replace the two `callModel(..., { mode: 'live' })` calls with:

```js
const callMode = req.body.callModelMode ?? { mode: 'live' };
// ...
const response = await callModel(
  { ... /* unchanged fields */ },
  callMode,
);
// ...
const { briefing, repaired } = await repairBriefing({
  briefing: response.structured,
  inputPaperIds,
  callModel: (input) => callModel(input, callMode),
  llmConfig: { provider, model, apiKey },
});
```

- [ ] **Step 2: Create a sample good-briefing fixture**

Create a sample briefing and compute its expected input hash. Write the good briefing to `tests/fixtures/synthesis/sample-good-briefing.json` as follows (note: the file stored at fixture lookup time is keyed by _input hash_, and the input is what the test will pass to `callModel`, so we first need the hash).

Write a helper script `tests/fixtures/synthesis/generate-sample.mjs`:

```js
import { hashInput } from '../../../lib/llm/hash.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const prompt = 'SYNTHESIS_PROMPT_FIXTURE'; // a known synthetic prompt
const input = {
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  prompt,
  structuredOutput: {
    name: 'briefing',
    description: 'Aparture daily research briefing',
    schema: (await import('../../../lib/synthesis/schema.js')).toJsonSchema(),
  },
};
const hash = hashInput(input);

const briefing = {
  executiveSummary:
    'Today in ML, three threads pull on the same knot: interpretability methods are converging on attention-head-level analysis, a new debate is emerging about whether heads are the right unit at all, and two papers offer competing ablation strategies.',
  themes: [
    {
      title: 'Interpretability converges on attention heads',
      argument:
        'Both papers analyze circuits at the attention-head level, using different ablation strategies but reaching compatible conclusions about head specialization.',
      paperIds: ['2504.01234', '2504.02345'],
    },
  ],
  papers: [
    {
      arxivId: '2504.01234',
      title: 'Circuit-level analysis of reasoning',
      score: 9.2,
      onelinePitch:
        'A mechanistic account of how attention heads compose into multi-step reasoning circuits.',
      whyMatters:
        'Directly grounded in your stated interest in mechanistic interpretability of large language models.',
      figures: [],
      quickSummaryPath: 'reports/2026-04-13/papers/2504.01234-quick.md',
      fullReportPath: 'reports/2026-04-13/papers/2504.01234-full.md',
    },
    {
      arxivId: '2504.02345',
      title: 'Head pruning ablations',
      score: 8.5,
      onelinePitch:
        'Ablation evidence that only a small subset of attention heads matter for task-specific reasoning.',
      whyMatters: 'Tests the framing from your March 3 starred paper on circuit sparsity.',
      figures: [],
      quickSummaryPath: 'reports/2026-04-13/papers/2504.02345-quick.md',
      fullReportPath: 'reports/2026-04-13/papers/2504.02345-full.md',
    },
  ],
  debates: [],
  longitudinal: [],
  proactiveQuestions: [],
};

const fixturePath = path.resolve(`tests/fixtures/llm/${hash}.json`);
await fs.mkdir(path.dirname(fixturePath), { recursive: true });
await fs.writeFile(
  fixturePath,
  JSON.stringify(
    { hash, input, response: { text: '', structured: briefing, tokensIn: 100, tokensOut: 200 } },
    null,
    2
  ),
  'utf8'
);
console.log('wrote fixture:', fixturePath, 'hash:', hash);
```

Run the helper:

```bash
node tests/fixtures/synthesis/generate-sample.mjs
```

This writes the fixture file under `tests/fixtures/llm/<hash>.json`. Record the printed hash — you'll use it in the integration test.

- [ ] **Step 3: Write the integration test**

Write to `tests/integration/synthesize.test.js`:

```js
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import handler from '../../pages/api/synthesize.js';

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

describe('synthesize API route (fixture mode)', () => {
  it('returns a validated briefing when the fixture is good', async () => {
    const { req, res, getResponse } = createMockReqRes({
      profile: 'I study mechanistic interpretability of large language models.',
      papers: [
        { arxivId: '2504.01234', title: 'Circuit-level analysis of reasoning', abstract: '...' },
        { arxivId: '2504.02345', title: 'Head pruning ablations', abstract: '...' },
      ],
      history: [],
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
```

- [ ] **Step 4: Add test-prompt override support in synthesize.js**

In `pages/api/synthesize.js`, right after loading the template, add:

```js
const finalPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? prompt;
```

Then use `finalPrompt` in the `callModel` call instead of `prompt`.

- [ ] **Step 5: Run the integration test**

```bash
npm test -- tests/integration/synthesize.test.js
```

Expected: 1 passed. If it fails, the most likely cause is a hash mismatch between the fixture file and the hash computed from the test's input — re-run the generator script and verify the fixture filename matches.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/synthesize.test.js tests/fixtures/synthesis/generate-sample.mjs tests/fixtures/llm/*.json pages/api/synthesize.js
git commit -m "test(synthesize): add fixture-based integration test"
```

---

## Phase D — Per-paper quick summaries

### Task 16: Create `pages/api/analyze-pdf-quick.js` — quick summary from full report

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/pages/api/analyze-pdf-quick.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/prompts/analyze-pdf-quick.md`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/integration/analyze-pdf-quick.test.js`

- [ ] **Step 1: Create the quick-summary prompt template**

Write to `prompts/analyze-pdf-quick.md`:

```markdown
You are compressing a full technical report into a ~300-word pre-reading quick summary for an academic researcher. The researcher has the full report available and will read it if they want depth — your job is to give them enough to decide whether the paper is worth their attention.

# The paper

Title: {{title}}
Authors: {{authors}}
arXiv ID: {{arxivId}}

# The full technical report

{{fullReport}}

# The paper's abstract (for grounding)

{{abstract}}

# The scoring stage's justification for why this paper scored highly

{{scoringJustification}}

# What to write

Produce a ~300-word quick summary in plain prose. Structure:

1. **Opening (1-2 sentences):** What does this paper do, in plain terms? Avoid the words "novel" and "breakthrough."
2. **Key claim (2-3 sentences):** What is the main technical claim, and what's the evidence for it?
3. **Caveats (1-2 sentences):** What's the most important limitation a reader should know before going to the full PDF?
4. **Why engage (1-2 sentences):** Why is this paper worth the reader's time, grounded in the scoring justification? Not generic.

Do not use bullet points. Do not use headings in the output — it should read as a single paragraph or two of prose. Do not apologize or hedge. Do not include "I" or "we" — write in a neutral academic voice.

Respond with only the quick summary text, no preamble.
```

- [ ] **Step 2: Implement `pages/api/analyze-pdf-quick.js`**

Write to `pages/api/analyze-pdf-quick.js`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { paper, fullReport, provider, model, apiKey, callModelMode } = req.body ?? {};

  if (!paper?.arxivId || !fullReport || !provider || !model || !apiKey) {
    res.status(400).json({
      error: 'missing required fields: paper.arxivId, fullReport, provider, model, apiKey',
    });
    return;
  }

  try {
    const templatePath = path.resolve(process.cwd(), 'prompts', 'analyze-pdf-quick.md');
    const template = await fs.readFile(templatePath, 'utf8');

    const prompt = template
      .replaceAll('{{title}}', paper.title ?? '')
      .replaceAll('{{authors}}', (paper.authors ?? []).join(', '))
      .replaceAll('{{arxivId}}', paper.arxivId)
      .replaceAll('{{fullReport}}', fullReport)
      .replaceAll('{{abstract}}', paper.abstract ?? '')
      .replaceAll('{{scoringJustification}}', paper.scoringJustification ?? '');

    const response = await callModel(
      { provider, model, prompt, apiKey },
      callModelMode ?? { mode: 'live' }
    );

    res.status(200).json({
      arxivId: paper.arxivId,
      quickSummary: response.text.trim(),
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
```

- [ ] **Step 3: Write an integration test**

Write to `tests/integration/analyze-pdf-quick.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import handler from '../../pages/api/analyze-pdf-quick.js';
import { hashInput } from '../../lib/llm/hash.js';

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

describe('analyze-pdf-quick API route (fixture mode)', () => {
  beforeAll(async () => {
    // Build the prompt the handler will generate, hash it, and seed a fixture.
    const templatePath = path.resolve(process.cwd(), 'prompts', 'analyze-pdf-quick.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const prompt = template
      .replaceAll('{{title}}', 'Test Paper')
      .replaceAll('{{authors}}', 'A. Author')
      .replaceAll('{{arxivId}}', '2504.99999')
      .replaceAll('{{fullReport}}', 'Full report content goes here.')
      .replaceAll('{{abstract}}', 'Test abstract.')
      .replaceAll('{{scoringJustification}}', 'Scores well on alignment with the user.');

    const input = {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      prompt,
      apiKey: 'test-key',
    };
    const hash = hashInput(input);
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.writeFile(
      path.join(fixturesDir, `${hash}.json`),
      JSON.stringify(
        {
          hash,
          input,
          response: {
            text: 'This is a ~300 word compression of the full report. It explains the paper in plain prose.',
            tokensIn: 500,
            tokensOut: 80,
          },
        },
        null,
        2
      )
    );
  });

  it('returns a quick summary from a full report', async () => {
    const { req, res, getResponse } = createMockReqRes({
      paper: {
        arxivId: '2504.99999',
        title: 'Test Paper',
        authors: ['A. Author'],
        abstract: 'Test abstract.',
        scoringJustification: 'Scores well on alignment with the user.',
      },
      fullReport: 'Full report content goes here.',
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.arxivId).toBe('2504.99999');
    expect(jsonBody.quickSummary).toContain('compression of the full report');
  });
});
```

- [ ] **Step 4: Run the test**

```bash
npm test -- tests/integration/analyze-pdf-quick.test.js
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add pages/api/analyze-pdf-quick.js prompts/analyze-pdf-quick.md tests/integration/analyze-pdf-quick.test.js
git commit -m "feat(api): add analyze-pdf-quick for quick summary generation from full report"
```

---

## Phase E — Briefing UI

### Task 17: Set up briefing typography, palette tokens, and fonts

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/styles/briefing.css`
- Modify: `/mnt/d/Dropbox/GitHub/aparture/styles/globals.css`
- Modify: `/mnt/d/Dropbox/GitHub/aparture/pages/_app.js` — add font imports via `next/font`

- [ ] **Step 1: Read the current `_app.js`**

```bash
cat /mnt/d/Dropbox/GitHub/aparture/pages/_app.js
```

Note the existing structure so you can preserve it.

- [ ] **Step 2: Install next/font compatible fonts**

Since Source Serif 4, Inter, and JetBrains Mono are all on Google Fonts, use `next/font/google` (built into Next.js 14, no extra install needed).

- [ ] **Step 3: Modify `pages/_app.js` to load the fonts**

Replace the current `pages/_app.js` content with (preserving whatever the current contents are around the return, if any):

```js
import '../styles/globals.css';
import { Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export default function MyApp({ Component, pageProps }) {
  return (
    <main className={`${sourceSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}
```

If the existing `_app.js` has additional wrappers (e.g., a context provider), preserve them by wrapping `<Component {...pageProps} />` inside them, still inside the `<main>` with the font variables.

- [ ] **Step 4: Write `styles/briefing.css`**

Write to `styles/briefing.css`:

```css
/* Aparture briefing — reading surface typography and palette
 *
 * The briefing uses a print-register reading surface (Source Serif 4)
 * inside the Linear/Notion-register chrome (Inter). Tokens below apply
 * only inside .briefing-prose.
 */

:root {
  /* Palette (light) */
  --aparture-bg: #fafaf7;
  --aparture-surface: #f4f1ea;
  --aparture-ink: #1a1a1a;
  --aparture-mute: #6b6862;
  --aparture-hairline: #d8d4ca;
  --aparture-accent: #b31b1b;
  --aparture-debate: #ede6d5;
  --aparture-longitudinal: #e4e8ec;
  --aparture-question: #efe8d8;

  /* Typography */
  --aparture-font-serif: var(--font-serif), Georgia, 'Times New Roman', serif;
  --aparture-font-sans: var(--font-sans), system-ui, -apple-system, sans-serif;
  --aparture-font-mono: var(--font-mono), ui-monospace, 'JetBrains Mono', monospace;

  /* Type scale */
  --aparture-text-xs: 13px;
  --aparture-text-sm: 14px;
  --aparture-text-base: 17px;
  --aparture-text-lg: 20px;
  --aparture-text-xl: 24px;
  --aparture-text-2xl: 32px;

  /* Spacing */
  --aparture-space-1: 4px;
  --aparture-space-2: 8px;
  --aparture-space-3: 12px;
  --aparture-space-4: 16px;
  --aparture-space-6: 24px;
  --aparture-space-8: 32px;
  --aparture-space-12: 48px;
  --aparture-space-16: 64px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --aparture-bg: #141211;
    --aparture-surface: #1f1c1a;
    --aparture-ink: #e8e4dc;
    --aparture-mute: #8a857c;
    --aparture-hairline: #2e2a26;
    --aparture-accent: #d94545;
    --aparture-debate: #2a2520;
    --aparture-longitudinal: #1e2427;
    --aparture-question: #29231a;
  }
}

.briefing-prose {
  font-family: var(--aparture-font-serif);
  font-size: var(--aparture-text-base);
  line-height: 1.65;
  color: var(--aparture-ink);
  max-width: 68ch;
  margin: 0 auto;
  padding: var(--aparture-space-12) var(--aparture-space-6);
  background: var(--aparture-bg);
}

.briefing-prose h1,
.briefing-prose h2,
.briefing-prose h3 {
  font-family: var(--aparture-font-sans);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.briefing-prose h2 {
  font-size: var(--aparture-text-xl);
  margin-top: var(--aparture-space-12);
  margin-bottom: var(--aparture-space-4);
}

.briefing-prose p {
  margin: 0 0 var(--aparture-space-4) 0;
}

.briefing-prose .italic-pitch {
  font-style: italic;
  color: var(--aparture-mute);
}

.briefing-prose .meta-line {
  font-family: var(--aparture-font-sans);
  font-size: var(--aparture-text-sm);
  color: var(--aparture-mute);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.briefing-prose .hairline {
  border: none;
  border-top: 1px solid var(--aparture-hairline);
  margin: var(--aparture-space-6) 0;
}

.briefing-prose .paper-card {
  border: 1px solid var(--aparture-hairline);
  background: var(--aparture-surface);
  padding: var(--aparture-space-6);
  margin: var(--aparture-space-6) 0;
  border-radius: 4px;
}

.briefing-prose .paper-card .paper-title {
  font-family: var(--aparture-font-sans);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
}

.briefing-prose .paper-card .paper-meta {
  font-family: var(--aparture-font-mono);
  font-size: var(--aparture-text-xs);
  color: var(--aparture-mute);
  margin-top: var(--aparture-space-1);
}

.briefing-prose .paper-card .score-badge {
  font-family: var(--aparture-font-sans);
  font-size: var(--aparture-text-xl);
  font-weight: 700;
  color: var(--aparture-mute);
  float: right;
}

.briefing-prose .paper-card .score-badge.score-high {
  color: var(--aparture-accent);
}

.briefing-prose .paper-card .action-row {
  margin-top: var(--aparture-space-4);
  font-family: var(--aparture-font-sans);
  font-size: var(--aparture-text-sm);
  display: flex;
  gap: var(--aparture-space-4);
  flex-wrap: wrap;
}

.briefing-prose .paper-card .action-row a,
.briefing-prose .paper-card .action-row button {
  background: none;
  border: none;
  padding: 0;
  color: var(--aparture-ink);
  font: inherit;
  cursor: pointer;
  text-decoration: none;
}

.briefing-prose .paper-card .action-row a:hover,
.briefing-prose .paper-card .action-row button:hover {
  text-decoration: underline;
}

.briefing-prose .block-debate {
  background: var(--aparture-debate);
}

.briefing-prose .block-longitudinal {
  background: var(--aparture-longitudinal);
}

.briefing-prose .block-question {
  background: var(--aparture-question);
}
```

- [ ] **Step 5: Import `briefing.css` from `globals.css`**

Read the current `styles/globals.css`:

```bash
cat /mnt/d/Dropbox/GitHub/aparture/styles/globals.css
```

Append the import at the end:

```css
@import './briefing.css';
```

- [ ] **Step 6: Verify the dev server starts without CSS errors**

```bash
cd /mnt/d/Dropbox/GitHub/aparture && timeout 15 npm run dev &
sleep 10
curl -s http://localhost:3000 > /dev/null && echo "dev server up"
kill %1 2>/dev/null
```

Expected: "dev server up" printed, no CSS parsing errors in the server logs.

- [ ] **Step 7: Commit**

```bash
git add styles/briefing.css styles/globals.css pages/_app.js
git commit -m "feat(briefing): add typography tokens, palette, and font imports"
```

---

### Task 18: Create `BriefingProse.jsx` wrapper component

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/BriefingProse.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/BriefingProse.test.jsx`

- [ ] **Step 1: Write the failing test**

Write to `tests/component/BriefingProse.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingProse from '../../components/briefing/BriefingProse.jsx';

describe('BriefingProse', () => {
  it('wraps children in the briefing-prose class', () => {
    render(
      <BriefingProse>
        <p>Hello reader.</p>
      </BriefingProse>
    );
    const para = screen.getByText('Hello reader.');
    const wrapper = para.closest('.briefing-prose');
    expect(wrapper).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- tests/component/BriefingProse.test.jsx
```

Expected: module not found.

- [ ] **Step 3: Implement `BriefingProse.jsx`**

Write to `components/briefing/BriefingProse.jsx`:

```jsx
export default function BriefingProse({ children }) {
  return <article className="briefing-prose">{children}</article>;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- tests/component/BriefingProse.test.jsx
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add components/briefing/BriefingProse.jsx tests/component/BriefingProse.test.jsx
git commit -m "feat(briefing): add BriefingProse wrapper component"
```

---

### Task 19: Create `BriefingHeader.jsx` — date, tagline, stats line

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/BriefingHeader.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/BriefingHeader.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/component/BriefingHeader.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingHeader from '../../components/briefing/BriefingHeader.jsx';

describe('BriefingHeader', () => {
  it('renders date, tagline, and stats line', () => {
    render(
      <BriefingHeader
        date="April 13, 2026"
        papersInFocus={5}
        papersScreened={287}
        readingTimeMinutes={14}
      />
    );
    expect(screen.getByText(/DAILY BRIEFING/i)).toBeInTheDocument();
    expect(screen.getByText(/April 13, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Bringing the arXiv into focus/i)).toBeInTheDocument();
    expect(screen.getByText(/5 papers in focus/)).toBeInTheDocument();
    expect(screen.getByText(/287 screened/)).toBeInTheDocument();
    expect(screen.getByText(/~14 min/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- tests/component/BriefingHeader.test.jsx
```

- [ ] **Step 3: Implement `BriefingHeader.jsx`**

```jsx
export default function BriefingHeader({
  date,
  papersInFocus,
  papersScreened,
  readingTimeMinutes,
}) {
  return (
    <header>
      <div className="meta-line">DAILY BRIEFING · {date} · Bringing the arXiv into focus</div>
      <hr className="hairline" />
      <div className="meta-line">
        {papersInFocus} papers in focus · {papersScreened} screened · ~{readingTimeMinutes} min
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/BriefingHeader.jsx tests/component/BriefingHeader.test.jsx
git commit -m "feat(briefing): add BriefingHeader component"
```

---

### Task 20: Create `ExecutiveSummary.jsx`

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/ExecutiveSummary.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/ExecutiveSummary.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExecutiveSummary from '../../components/briefing/ExecutiveSummary.jsx';

describe('ExecutiveSummary', () => {
  it('renders the summary text in a paragraph', () => {
    render(<ExecutiveSummary text="Today in ML, three threads pull on the same knot." />);
    expect(
      screen.getByText(/Today in ML, three threads pull on the same knot\./)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
export default function ExecutiveSummary({ text }) {
  return <p className="executive-summary">{text}</p>;
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/ExecutiveSummary.jsx tests/component/ExecutiveSummary.test.jsx
git commit -m "feat(briefing): add ExecutiveSummary component"
```

---

### Task 21: Create `PaperCard.jsx`

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/PaperCard.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/PaperCard.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaperCard from '../../components/briefing/PaperCard.jsx';

const paper = {
  arxivId: '2504.01234',
  title: 'Circuit-level analysis of reasoning',
  score: 9.2,
  onelinePitch: 'A mechanistic account of how attention heads compose into reasoning circuits.',
  whyMatters: 'Directly grounded in your stated interest in mechanistic interpretability.',
  figures: [],
};

describe('PaperCard', () => {
  it('renders title, score, pitch, and whyMatters', () => {
    render(<PaperCard paper={paper} />);
    expect(screen.getByText(paper.title)).toBeInTheDocument();
    expect(screen.getByText('9.2')).toBeInTheDocument();
    expect(screen.getByText(paper.onelinePitch)).toBeInTheDocument();
    expect(screen.getByText(paper.whyMatters)).toBeInTheDocument();
  });

  it('applies score-high class to scores ≥ 9', () => {
    const { container } = render(<PaperCard paper={paper} />);
    const badge = container.querySelector('.score-badge');
    expect(badge).toHaveClass('score-high');
  });

  it('fires onStar when the star action is clicked', async () => {
    const onStar = vi.fn();
    render(<PaperCard paper={paper} onStar={onStar} />);
    await userEvent.click(screen.getByRole('button', { name: /star/i }));
    expect(onStar).toHaveBeenCalledWith(paper.arxivId);
  });

  it('fires onDismiss when the dismiss action is clicked', async () => {
    const onDismiss = vi.fn();
    render(<PaperCard paper={paper} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith(paper.arxivId);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `PaperCard.jsx`**

```jsx
export default function PaperCard({
  paper,
  onStar,
  onDismiss,
  onOpenQuickSummary,
  onOpenFullReport,
}) {
  const scoreHigh = paper.score >= 9;
  return (
    <section className="paper-card">
      <span className={`score-badge${scoreHigh ? ' score-high' : ''}`}>
        {paper.score.toFixed(1)}
      </span>
      <h3 className="paper-title">{paper.title}</h3>
      <div className="paper-meta">
        <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noreferrer">
          {paper.arxivId}
        </a>
      </div>
      <hr className="hairline" />
      <p className="italic-pitch">{paper.onelinePitch}</p>
      <p>{paper.whyMatters}</p>
      <div className="action-row">
        <button type="button" onClick={() => onOpenQuickSummary?.(paper.arxivId)}>
          → quick summary
        </button>
        <button type="button" onClick={() => onOpenFullReport?.(paper.arxivId)}>
          → full report
        </button>
        <button type="button" aria-label="star" onClick={() => onStar?.(paper.arxivId)}>
          ☆ star
        </button>
        <button type="button" aria-label="dismiss" onClick={() => onDismiss?.(paper.arxivId)}>
          ⊘ dismiss
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/PaperCard.jsx tests/component/PaperCard.test.jsx
git commit -m "feat(briefing): add PaperCard component with star/dismiss/drill-down actions"
```

---

### Task 22: Create `ThemeSection.jsx`

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/ThemeSection.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/ThemeSection.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThemeSection from '../../components/briefing/ThemeSection.jsx';

describe('ThemeSection', () => {
  it('renders the theme label, title, argument, and child papers', () => {
    render(
      <ThemeSection
        index={1}
        title="Interpretability converges on attention heads"
        argument="Both papers analyze circuits at the attention-head level."
      >
        <div data-testid="child-paper">Paper 1</div>
      </ThemeSection>
    );
    expect(screen.getByText(/THEME 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Interpretability converges/)).toBeInTheDocument();
    expect(screen.getByText(/Both papers analyze circuits/)).toBeInTheDocument();
    expect(screen.getByTestId('child-paper')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
export default function ThemeSection({ index, title, argument, children }) {
  return (
    <section className="theme-section">
      <div className="meta-line">── THEME {index} ──</div>
      <h2>{title}</h2>
      <p className="italic-pitch">{argument}</p>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/ThemeSection.jsx tests/component/ThemeSection.test.jsx
git commit -m "feat(briefing): add ThemeSection component"
```

---

### Task 23: Create `DebateBlock.jsx`

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/DebateBlock.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/DebateBlock.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebateBlock from '../../components/briefing/DebateBlock.jsx';

describe('DebateBlock', () => {
  it('renders the debate label, title, and summary', () => {
    render(
      <DebateBlock
        title="Are attention heads the right unit?"
        summary="Smith argues yes; Chen counters that activation patches are more reliable."
        paperIds={['2504.01234', '2504.02345']}
      />
    );
    expect(screen.getByText(/⚡.*DEBATE/)).toBeInTheDocument();
    expect(screen.getByText(/Are attention heads the right unit/)).toBeInTheDocument();
    expect(screen.getByText(/Smith argues yes/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
export default function DebateBlock({ title, summary, paperIds }) {
  return (
    <section className="paper-card block-debate">
      <div className="meta-line">⚡ ── DEBATE ──</div>
      <h3 className="paper-title">{title}</h3>
      <p>{summary}</p>
      {paperIds?.length ? (
        <div className="paper-meta">References: {paperIds.join(', ')}</div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/DebateBlock.jsx tests/component/DebateBlock.test.jsx
git commit -m "feat(briefing): add DebateBlock component"
```

---

### Task 24: Create `LongitudinalBlock.jsx`

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/LongitudinalBlock.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/LongitudinalBlock.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LongitudinalBlock from '../../components/briefing/LongitudinalBlock.jsx';

describe('LongitudinalBlock', () => {
  it('renders the longitudinal label and connection summary', () => {
    render(
      <LongitudinalBlock
        summary="This is a direct follow-up to the March 3 paper on circuit sparsity."
        todayPaperId="2504.01234"
        pastPaperId="2503.55555"
        pastDate="2026-03-03"
      />
    );
    expect(screen.getByText(/LONGITUDINAL/i)).toBeInTheDocument();
    expect(screen.getByText(/direct follow-up to the March 3/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
export default function LongitudinalBlock({ summary, todayPaperId, pastPaperId, pastDate }) {
  return (
    <section className="paper-card block-longitudinal">
      <div className="meta-line">── LONGITUDINAL ──</div>
      <p>{summary}</p>
      <div className="paper-meta">
        Today: {todayPaperId} · Past ({pastDate}): {pastPaperId}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/LongitudinalBlock.jsx tests/component/LongitudinalBlock.test.jsx
git commit -m "feat(briefing): add LongitudinalBlock component"
```

---

### Task 25: Create `ProactiveQuestionPanel.jsx`

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/ProactiveQuestionPanel.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/ProactiveQuestionPanel.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProactiveQuestionPanel from '../../components/briefing/ProactiveQuestionPanel.jsx';

describe('ProactiveQuestionPanel', () => {
  it('renders the question and skip button', () => {
    render(
      <ProactiveQuestionPanel
        question="You've starred 3 papers on normalizing flows this week. Should I weight flow-based methods higher in scoring?"
        onSkip={() => {}}
        onPreview={() => {}}
      />
    );
    expect(screen.getByText(/A QUESTION FROM APARTURE/i)).toBeInTheDocument();
    expect(screen.getByText(/starred 3 papers on normalizing flows/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('fires onSkip when skip is clicked', async () => {
    const onSkip = vi.fn();
    render(<ProactiveQuestionPanel question="q?" onSkip={onSkip} onPreview={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('calls onPreview with the textarea content when preview is clicked', async () => {
    const onPreview = vi.fn();
    render(<ProactiveQuestionPanel question="q?" onSkip={() => {}} onPreview={onPreview} />);
    await userEvent.type(screen.getByRole('textbox'), 'yes widen RLHF');
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    expect(onPreview).toHaveBeenCalledWith('yes widen RLHF');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
import { useState } from 'react';

export default function ProactiveQuestionPanel({ question, onSkip, onPreview }) {
  const [answer, setAnswer] = useState('');
  return (
    <section className="paper-card block-question">
      <div className="meta-line">── A QUESTION FROM APARTURE ──</div>
      <p className="italic-pitch">{question}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
        }}
      />
      <div className="action-row">
        <button type="button" onClick={() => onPreview?.(answer)}>
          Preview changes to profile.md
        </button>
        <button type="button" onClick={() => onSkip?.()}>
          Skip
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/ProactiveQuestionPanel.jsx tests/component/ProactiveQuestionPanel.test.jsx
git commit -m "feat(briefing): add ProactiveQuestionPanel component"
```

**Note:** In Phase 1, the `onPreview` handler on the ArxivAnalyzer side can be a stub that logs or shows an alert. The full diff-apply workflow is Phase 2.

---

### Task 26: Create `QuickSummaryInline.jsx` — inline-expandable quick summary

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/QuickSummaryInline.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/QuickSummaryInline.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuickSummaryInline from '../../components/briefing/QuickSummaryInline.jsx';

describe('QuickSummaryInline', () => {
  it('shows the quick summary text when open', () => {
    render(<QuickSummaryInline open text="A compressed 300-word quick summary of the paper." />);
    expect(screen.getByText(/A compressed 300-word quick summary/)).toBeInTheDocument();
  });

  it('hides the content when not open', () => {
    render(<QuickSummaryInline open={false} text="Hidden summary." />);
    expect(screen.queryByText(/Hidden summary/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
export default function QuickSummaryInline({ open, text }) {
  if (!open) return null;
  return (
    <div
      className="quick-summary-inline"
      style={{
        marginTop: 'var(--aparture-space-4)',
        padding: 'var(--aparture-space-4)',
        borderLeft: '2px solid var(--aparture-hairline)',
      }}
    >
      <p>{text}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/QuickSummaryInline.jsx tests/component/QuickSummaryInline.test.jsx
git commit -m "feat(briefing): add QuickSummaryInline expansion component"
```

---

### Task 27: Create `FullReportSidePanel.jsx` — Radix Dialog side panel

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/FullReportSidePanel.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/FullReportSidePanel.test.jsx`

- [ ] **Step 1: Test**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullReportSidePanel from '../../components/briefing/FullReportSidePanel.jsx';

describe('FullReportSidePanel', () => {
  it('shows the full report content when open', () => {
    render(
      <FullReportSidePanel
        open
        onOpenChange={() => {}}
        title="Circuit-level analysis of reasoning"
        content="Full ~1200-word technical report text."
      />
    );
    expect(screen.getByText(/Full ~1200-word technical report text/)).toBeInTheDocument();
  });

  it('calls onOpenChange when the close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(<FullReportSidePanel open onOpenChange={onOpenChange} title="t" content="c" />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

```jsx
import * as Dialog from '@radix-ui/react-dialog';

export default function FullReportSidePanel({ open, onOpenChange, title, content }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '55%',
            background: 'var(--aparture-bg)',
            borderLeft: '1px solid var(--aparture-hairline)',
            padding: 'var(--aparture-space-8)',
            overflowY: 'auto',
          }}
        >
          <Dialog.Title
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xl)',
            }}
          >
            {title}
          </Dialog.Title>
          <article
            className="briefing-prose"
            style={{ padding: 'var(--aparture-space-6) 0', maxWidth: 'none' }}
          >
            <p>{content}</p>
          </article>
          <Dialog.Close asChild>
            <button type="button" aria-label="close">
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add components/briefing/FullReportSidePanel.jsx tests/component/FullReportSidePanel.test.jsx
git commit -m "feat(briefing): add FullReportSidePanel via Radix Dialog"
```

---

### Task 28: Create `BriefingView.jsx` — composes everything

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/components/briefing/BriefingView.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/component/BriefingView.test.jsx`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/fixtures/briefing/sample-output.json`

- [ ] **Step 1: Create the sample briefing fixture**

Write to `tests/fixtures/briefing/sample-output.json`:

```json
{
  "executiveSummary": "Today in ML, three threads pull on the same knot: interpretability is converging on attention-head-level analysis, a new debate is emerging about whether heads are the right unit at all, and two papers offer competing ablation strategies.",
  "themes": [
    {
      "title": "Interpretability converges on attention heads",
      "argument": "Both papers analyze circuits at the attention-head level, using different ablation strategies but reaching compatible conclusions about head specialization.",
      "paperIds": ["2504.01234", "2504.02345"]
    }
  ],
  "papers": [
    {
      "arxivId": "2504.01234",
      "title": "Circuit-level analysis of reasoning",
      "score": 9.2,
      "onelinePitch": "A mechanistic account of how attention heads compose into multi-step reasoning circuits.",
      "whyMatters": "Directly grounded in your stated interest in mechanistic interpretability.",
      "figures": [],
      "quickSummaryPath": "reports/2026-04-13/papers/2504.01234-quick.md",
      "fullReportPath": "reports/2026-04-13/papers/2504.01234-full.md"
    },
    {
      "arxivId": "2504.02345",
      "title": "Head pruning ablations",
      "score": 8.5,
      "onelinePitch": "Ablation evidence that only a small subset of attention heads matter for task-specific reasoning.",
      "whyMatters": "Tests the framing from your March 3 starred paper on circuit sparsity.",
      "figures": [],
      "quickSummaryPath": "reports/2026-04-13/papers/2504.02345-quick.md",
      "fullReportPath": "reports/2026-04-13/papers/2504.02345-full.md"
    }
  ],
  "debates": [
    {
      "title": "Are attention heads the right unit?",
      "summary": "Smith argues attention-head-level analysis is sufficient; Chen counters that activation patches are more reliable.",
      "paperIds": ["2504.01234", "2504.02345"],
      "stance": "tension"
    }
  ],
  "longitudinal": [],
  "proactiveQuestions": [
    {
      "question": "You've starred 3 papers on normalizing flows this week. Should I weight flow-based methods higher in scoring, or is this a temporary interest?"
    }
  ]
}
```

- [ ] **Step 2: Write the test**

```jsx
// tests/component/BriefingView.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingView from '../../components/briefing/BriefingView.jsx';
import sample from '../fixtures/briefing/sample-output.json';

describe('BriefingView', () => {
  it('renders header, executive summary, themes, paper cards, debates, and proactive questions', () => {
    render(
      <BriefingView
        briefing={sample}
        date="April 13, 2026"
        papersScreened={287}
        quickSummariesById={{
          2504.01234: 'Quick summary text for paper 1.',
          2504.02345: 'Quick summary text for paper 2.',
        }}
        fullReportsById={{
          2504.01234: 'Full report 1.',
          2504.02345: 'Full report 2.',
        }}
      />
    );
    // Header
    expect(screen.getByText(/DAILY BRIEFING/i)).toBeInTheDocument();
    // Executive summary
    expect(screen.getByText(/three threads pull on the same knot/)).toBeInTheDocument();
    // Theme
    expect(screen.getByText(/Interpretability converges/)).toBeInTheDocument();
    // Paper cards
    expect(screen.getByText('Circuit-level analysis of reasoning')).toBeInTheDocument();
    expect(screen.getByText('Head pruning ablations')).toBeInTheDocument();
    // Debate
    expect(screen.getByText(/DEBATE/i)).toBeInTheDocument();
    expect(screen.getByText(/Are attention heads the right unit/)).toBeInTheDocument();
    // Proactive question
    expect(screen.getByText(/starred 3 papers on normalizing flows/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — expect failure**

- [ ] **Step 4: Implement `BriefingView.jsx`**

```jsx
import { useState } from 'react';
import BriefingProse from './BriefingProse.jsx';
import BriefingHeader from './BriefingHeader.jsx';
import ExecutiveSummary from './ExecutiveSummary.jsx';
import ThemeSection from './ThemeSection.jsx';
import PaperCard from './PaperCard.jsx';
import DebateBlock from './DebateBlock.jsx';
import LongitudinalBlock from './LongitudinalBlock.jsx';
import ProactiveQuestionPanel from './ProactiveQuestionPanel.jsx';
import QuickSummaryInline from './QuickSummaryInline.jsx';
import FullReportSidePanel from './FullReportSidePanel.jsx';

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(briefing) {
  let words = countWords(briefing.executiveSummary ?? '');
  for (const theme of briefing.themes ?? []) {
    words += countWords(theme.argument ?? '') + countWords(theme.title ?? '');
  }
  for (const paper of briefing.papers ?? []) {
    words += countWords(paper.onelinePitch ?? '') + countWords(paper.whyMatters ?? '');
  }
  for (const debate of briefing.debates ?? []) {
    words += countWords(debate.summary ?? '');
  }
  return Math.max(1, Math.round(words / 250));
}

export default function BriefingView({
  briefing,
  date,
  papersScreened = 0,
  quickSummariesById = {},
  fullReportsById = {},
  onStar,
  onDismiss,
  onSkipQuestion,
  onPreviewProfileUpdate,
}) {
  const [openQuickId, setOpenQuickId] = useState(null);
  const [openFullId, setOpenFullId] = useState(null);

  const papersById = Object.fromEntries((briefing.papers ?? []).map((p) => [p.arxivId, p]));
  const readingTimeMinutes = estimateReadingTime(briefing);

  return (
    <BriefingProse>
      <BriefingHeader
        date={date}
        papersInFocus={briefing.papers?.length ?? 0}
        papersScreened={papersScreened}
        readingTimeMinutes={readingTimeMinutes}
      />
      <ExecutiveSummary text={briefing.executiveSummary} />

      {(briefing.themes ?? []).map((theme, idx) => (
        <ThemeSection
          key={theme.title}
          index={idx + 1}
          title={theme.title}
          argument={theme.argument}
        >
          {(theme.paperIds ?? []).map((id) => {
            const paper = papersById[id];
            if (!paper) return null;
            return (
              <div key={id}>
                <PaperCard
                  paper={paper}
                  onStar={onStar}
                  onDismiss={onDismiss}
                  onOpenQuickSummary={(pid) => setOpenQuickId(pid === openQuickId ? null : pid)}
                  onOpenFullReport={(pid) => setOpenFullId(pid)}
                />
                <QuickSummaryInline
                  open={openQuickId === id}
                  text={quickSummariesById[id] ?? 'Quick summary not yet generated.'}
                />
              </div>
            );
          })}
        </ThemeSection>
      ))}

      {(briefing.debates ?? []).map((debate, idx) => (
        <DebateBlock
          key={`debate-${idx}`}
          title={debate.title}
          summary={debate.summary}
          paperIds={debate.paperIds}
        />
      ))}

      {(briefing.longitudinal ?? []).map((conn, idx) => (
        <LongitudinalBlock
          key={`long-${idx}`}
          summary={conn.summary}
          todayPaperId={conn.todayPaperId}
          pastPaperId={conn.pastPaperId}
          pastDate={conn.pastDate}
        />
      ))}

      {(briefing.proactiveQuestions ?? []).map((q, idx) => (
        <ProactiveQuestionPanel
          key={`q-${idx}`}
          question={q.question}
          onSkip={onSkipQuestion}
          onPreview={onPreviewProfileUpdate}
        />
      ))}

      <FullReportSidePanel
        open={openFullId !== null}
        onOpenChange={(open) => setOpenFullId(open ? openFullId : null)}
        title={openFullId ? (papersById[openFullId]?.title ?? '') : ''}
        content={
          openFullId ? (fullReportsById[openFullId] ?? 'Full report not yet available.') : ''
        }
      />
    </BriefingProse>
  );
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npm test -- tests/component/BriefingView.test.jsx
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add components/briefing/BriefingView.jsx tests/component/BriefingView.test.jsx tests/fixtures/briefing/sample-output.json
git commit -m "feat(briefing): add BriefingView root composition with fixture-based test"
```

---

## Phase F — Integration into ArxivAnalyzer

### Task 29: Add profile textarea to the Settings section of `ArxivAnalyzer.js`

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/components/ArxivAnalyzer.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/hooks/useProfile.js`

- [ ] **Step 1: Create `hooks/useProfile.js`**

Write to `hooks/useProfile.js`:

```js
import { useEffect, useState } from 'react';

const LOCAL_STORAGE_KEY = 'aparture-profile-md';
const DEFAULT_PROFILE = `I work on [your field here]. I am interested in [specific sub-topics]. I am trying to keep up with [research threads]. Replace this text with your actual research interests in plain prose — every synthesis call will be grounded in what you write here.`;

export function useProfile() {
  const [profile, setProfile] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    setProfile(stored ?? DEFAULT_PROFILE);
  }, []);

  const updateProfile = (value) => {
    setProfile(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, value);
    }
  };

  return [profile, updateProfile];
}
```

- [ ] **Step 2: Find the Settings section of `ArxivAnalyzer.js` and add the profile textarea**

Grep the current component for a natural mount point:

```bash
grep -n "scoringCriteria" /mnt/d/Dropbox/GitHub/aparture/components/ArxivAnalyzer.js | head -10
```

Expected: find references where `scoringCriteria` state is defined and rendered as a textarea.

- [ ] **Step 3: Add profile import and usage**

Near the top of `components/ArxivAnalyzer.js`, add:

```js
import { useProfile } from '../hooks/useProfile.js';
```

Inside the component function, add:

```js
const [profile, setProfile] = useProfile();
```

- [ ] **Step 4: Add a Profile textarea to the Settings section**

Find the section in `ArxivAnalyzer.js` that renders the `scoringCriteria` textarea and add — **immediately above it** — a new profile textarea:

```jsx
<div style={{ marginBottom: '24px' }}>
  <label
    htmlFor="aparture-profile"
    style={{
      display: 'block',
      fontFamily: 'var(--aparture-font-sans, system-ui)',
      fontSize: '14px',
      fontWeight: 600,
      marginBottom: '8px',
    }}
  >
    Your research interests (profile.md)
  </label>
  <p
    style={{
      fontFamily: 'var(--aparture-font-sans, system-ui)',
      fontSize: '13px',
      color: '#6b6862',
      margin: '0 0 8px 0',
    }}
  >
    Describe your research in prose. Every synthesis call will be grounded in this text. This is the
    closest thing Phase 1 has to a <code>profile.md</code> file — Phase 2 will move it to disk.
  </p>
  <textarea
    id="aparture-profile"
    value={profile}
    onChange={(e) => setProfile(e.target.value)}
    rows={8}
    style={{
      width: '100%',
      fontFamily: 'var(--aparture-font-serif, Georgia, serif)',
      fontSize: '15px',
      lineHeight: 1.6,
      padding: '12px',
      border: '1px solid #d8d4ca',
      borderRadius: '4px',
      background: '#fafaf7',
    }}
  />
</div>
```

- [ ] **Step 5: Verify the dev server still starts**

```bash
cd /mnt/d/Dropbox/GitHub/aparture && timeout 15 npm run dev &
sleep 10
curl -s http://localhost:3000 > /dev/null && echo "dev server up"
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add hooks/useProfile.js components/ArxivAnalyzer.js
git commit -m "feat(briefing): add profile textarea to Settings (localStorage-backed)"
```

---

### Task 30: Create `hooks/useBriefing.js` — localStorage persistence for current + past briefings

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/hooks/useBriefing.js`
- Create: `/mnt/d/Dropbox/GitHub/aparture/tests/unit/hooks/useBriefing.test.js`

- [ ] **Step 1: Test**

Write to `tests/unit/hooks/useBriefing.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBriefing } from '../../../hooks/useBriefing.js';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useBriefing', () => {
  it('starts with no current briefing', () => {
    const { result } = renderHook(() => useBriefing());
    expect(result.current.current).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it('sets the current briefing and appends to history', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = {
      executiveSummary: 'Test',
      themes: [],
      papers: [{ arxivId: '2504.01234', title: 't', score: 8 }],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    act(() => {
      result.current.saveBriefing('2026-04-13', briefing);
    });
    expect(result.current.current.date).toBe('2026-04-13');
    expect(result.current.current.briefing.executiveSummary).toBe('Test');
    expect(result.current.history.some((b) => b.date === '2026-04-13')).toBe(true);
  });

  it('keeps at most 14 past briefings in history', () => {
    const { result } = renderHook(() => useBriefing());
    act(() => {
      for (let i = 1; i <= 20; i++) {
        result.current.saveBriefing(`2026-04-${i.toString().padStart(2, '0')}`, {
          executiveSummary: 'x',
          themes: [],
          papers: [],
          debates: [],
          longitudinal: [],
          proactiveQuestions: [],
        });
      }
    });
    expect(result.current.history.length).toBe(14);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

Write to `hooks/useBriefing.js`:

```js
import { useEffect, useState, useCallback } from 'react';

const CURRENT_KEY = 'aparture-briefing-current';
const HISTORY_KEY = 'aparture-briefing-history';
const MAX_HISTORY = 14;

export function useBriefing() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cur = window.localStorage.getItem(CURRENT_KEY);
      if (cur) setCurrent(JSON.parse(cur));
      const hist = window.localStorage.getItem(HISTORY_KEY);
      if (hist) setHistory(JSON.parse(hist));
    } catch {
      // Ignore parse errors — start fresh
    }
  }, []);

  const saveBriefing = useCallback((date, briefing) => {
    const entry = { date, briefing };
    setCurrent(entry);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CURRENT_KEY, JSON.stringify(entry));
    }
    setHistory((prev) => {
      const filtered = prev.filter((b) => b.date !== date);
      const next = [entry, ...filtered].slice(0, MAX_HISTORY);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return { current, history, saveBriefing };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- tests/unit/hooks/useBriefing.test.js
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add hooks/useBriefing.js tests/unit/hooks/useBriefing.test.js
git commit -m "feat(briefing): add useBriefing hook with 14-day localStorage history"
```

---

### Task 31: Add "Generate Briefing" button + wire BriefingView into ArxivAnalyzer

**Files:**

- Modify: `/mnt/d/Dropbox/GitHub/aparture/components/ArxivAnalyzer.js`

- [ ] **Step 1: Add imports**

At the top of `components/ArxivAnalyzer.js`, add:

```js
import BriefingView from './briefing/BriefingView.jsx';
import { useBriefing } from '../hooks/useBriefing.js';
```

- [ ] **Step 2: Add state and handlers inside the component**

Find the component function body and, near the other `useState` declarations, add:

```js
const { current: currentBriefing, history: briefingHistory, saveBriefing } = useBriefing();
const [synthesizing, setSynthesizing] = useState(false);
const [synthesisError, setSynthesisError] = useState(null);
const [quickSummariesById, setQuickSummariesById] = useState({});
const [fullReportsById, setFullReportsById] = useState({});
```

Add a handler for generating the briefing:

```js
const handleGenerateBriefing = async () => {
  setSynthesizing(true);
  setSynthesisError(null);
  try {
    // results.finalRanking is the top N papers from the existing pipeline
    const papers = (results?.finalRanking ?? []).map((p) => ({
      arxivId: p.arxivId ?? p.id,
      title: p.title,
      abstract: p.abstract ?? '',
      score: p.score ?? p.finalScore ?? 0,
      scoringJustification: p.justification ?? p.relevanceAssessment ?? '',
      fullReport: p.detailedSummary ?? p.pdfAnalysis?.summary ?? '',
    }));

    // Generate quick summaries for each paper (calls analyze-pdf-quick)
    const quickById = {};
    const fullById = {};
    for (const p of papers) {
      fullById[p.arxivId] = p.fullReport;
      if (p.fullReport) {
        const quickRes = await fetch('/api/analyze-pdf-quick', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            paper: p,
            fullReport: p.fullReport,
            provider: 'google', // use scoring model provider by default
            model: config.scoringModel,
            apiKey: config.googleApiKey ?? config.claudeApiKey ?? config.openaiApiKey,
          }),
        });
        const quickJson = await quickRes.json();
        if (quickRes.ok) {
          quickById[p.arxivId] = quickJson.quickSummary;
        }
      }
    }
    setQuickSummariesById(quickById);
    setFullReportsById(fullById);

    // Call the synthesis route
    const history = briefingHistory.map((h) => ({
      date: h.date,
      paperIds: (h.briefing.papers ?? []).map((p) => p.arxivId),
    }));

    const synthRes = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        profile,
        papers,
        history,
        provider: 'anthropic',
        model: config.pdfModel,
        apiKey: config.claudeApiKey ?? config.googleApiKey ?? config.openaiApiKey,
      }),
    });
    const synthJson = await synthRes.json();
    if (!synthRes.ok) {
      throw new Error(synthJson.error ?? 'synthesis failed');
    }

    const today = new Date().toISOString().slice(0, 10);
    saveBriefing(today, synthJson.briefing);
  } catch (err) {
    setSynthesisError(String(err?.message ?? err));
  } finally {
    setSynthesizing(false);
  }
};
```

Note: `config.pdfModel`, `config.scoringModel`, `config.claudeApiKey`, etc. names depend on the existing `ArxivAnalyzer.js` config shape. Read the current state declarations and adapt. If API keys are currently only in `.env.local` (not in state), use a placeholder `apiKey: 'from-env'` and read from `process.env` server-side in the API route.

- [ ] **Step 3: Add the button to the results view**

Find the section of `ArxivAnalyzer.js` that renders the final-ranking paper list, and add — **above the ranking** — a new "Generate Briefing" button:

```jsx
{
  results?.finalRanking?.length > 0 && (
    <div
      style={{
        padding: '24px',
        background: '#f4f1ea',
        border: '1px solid #d8d4ca',
        borderRadius: '4px',
        marginBottom: '24px',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--aparture-font-sans, system-ui)',
          fontSize: '20px',
          fontWeight: 600,
          margin: '0 0 8px 0',
        }}
      >
        Briefing (Phase 1)
      </h2>
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans, system-ui)',
          fontSize: '14px',
          color: '#6b6862',
          margin: '0 0 16px 0',
        }}
      >
        Generate a synthesized briefing from the final-ranking papers above. The briefing is the new
        output format for Phase 1 — the existing markdown report is still available unchanged below.
      </p>
      <button
        type="button"
        onClick={handleGenerateBriefing}
        disabled={synthesizing}
        style={{
          padding: '10px 20px',
          fontFamily: 'var(--aparture-font-sans, system-ui)',
          fontSize: '14px',
          fontWeight: 600,
          background: '#1a1a1a',
          color: '#fafaf7',
          border: 'none',
          borderRadius: '4px',
          cursor: synthesizing ? 'not-allowed' : 'pointer',
        }}
      >
        {synthesizing ? 'Generating…' : '→ Generate Briefing'}
      </button>
      {synthesisError && (
        <p
          style={{
            color: '#b31b1b',
            marginTop: '8px',
            fontFamily: 'var(--aparture-font-sans, system-ui)',
            fontSize: '13px',
          }}
        >
          Error: {synthesisError}
        </p>
      )}
    </div>
  );
}

{
  currentBriefing && (
    <BriefingView
      briefing={currentBriefing.briefing}
      date={new Date(currentBriefing.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}
      papersScreened={results?.allPapers?.length ?? 0}
      quickSummariesById={quickSummariesById}
      fullReportsById={fullReportsById}
      onStar={(id) => console.log('star', id)}
      onDismiss={(id) => console.log('dismiss', id)}
      onSkipQuestion={() => console.log('skip question')}
      onPreviewProfileUpdate={(answer) =>
        alert(`Phase 2 will show a diff. Phase 1 just captures the answer: ${answer}`)
      }
    />
  );
}
```

- [ ] **Step 4: Verify the dev server starts and the button renders**

```bash
cd /mnt/d/Dropbox/GitHub/aparture && timeout 15 npm run dev &
sleep 10
curl -s http://localhost:3000 > /dev/null && echo "dev server up"
kill %1 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add components/ArxivAnalyzer.js
git commit -m "feat(briefing): integrate BriefingView into ArxivAnalyzer with Generate Briefing button"
```

---

### Task 32: Manual end-to-end verification + Phase 1 acceptance gate checklist

**Files:**

- Create: `/mnt/d/Dropbox/GitHub/aparture/docs/superpowers/plans/2026-04-13-aparture-phase-1-acceptance-checklist.md`

- [ ] **Step 1: Run the full test suite**

```bash
cd /mnt/d/Dropbox/GitHub/aparture && npm test
```

Expected: all tests passing. If anything fails, fix it before proceeding.

- [ ] **Step 2: Start the dev server and run an end-to-end analysis manually**

```bash
cd /mnt/d/Dropbox/GitHub/aparture && npm run dev
```

In a browser:

1. Authenticate with the existing password
2. Paste a real API key into the existing settings (or set via `.env.local`)
3. Write a prose research profile in the new Profile textarea (e.g., "I work on mechanistic interpretability of large language models with a focus on attention-head-level analysis and circuit discovery. I am trying to keep up with activation-patching, sparse-autoencoder, and ablation-study papers.")
4. Pick categories (e.g., `cs.LG`, `cs.AI`, `cs.CL`)
5. Set `daysBack` to 1 and `maxDeepAnalysis` to 5 to keep the test run cheap
6. Click "Start Analysis"
7. Wait for the full pipeline to complete (fetch → filter → score → PDF analysis)
8. Click "→ Generate Briefing"
9. Verify the briefing renders with the expected structure (executive summary, theme sections, paper cards with pitch + whyMatters, any debates or longitudinal connections, proactive questions)
10. Click "→ quick summary" on a paper card and verify it expands inline
11. Click "→ full report" and verify the side panel opens
12. Close the side panel with Escape

- [ ] **Step 3: Write the acceptance gate checklist document**

Write to `docs/superpowers/plans/2026-04-13-aparture-phase-1-acceptance-checklist.md`:

```markdown
# Aparture Phase 1 — Acceptance Gate Checklist

**Purpose:** This document captures the acceptance criteria for moving from Phase 1 to Phase 2 of the Aparture refactor (as specified in `2026-04-13-aparture-refactor-design.md` §11).

**Gate condition:** Before starting Phase 2, the builder runs Aparture daily for **2 weeks** and honestly answers the question: **"Is the Phase 1 briefing better than the current tool's `arxiv_analysis` markdown output for my morning triage?"**

If yes, Phase 2 begins. If no, synthesis prompt iteration continues before any platform work.

## What "better" means, operationally

At least **3 of the following 5** must be true after 2 weeks of daily use:

- [ ] **The executive summary is consistently useful.** It gives me a headline I couldn't have gotten from the paper titles alone. It does not read like a generic "Today in X field..." boilerplate.
- [ ] **Theme sections actually group related papers meaningfully.** Themes reflect real editorial connections, not just "papers that happened on the same day." I can trust the theme headline to tell me what the grouping is about.
- [ ] **The "why this matters to you" paragraph is grounded in my profile.** It references specific things I wrote in `profile.md`, not generic academic commentary. When it's wrong, it's wrong in a way I can correct by editing the profile.
- [ ] **Debate blocks and longitudinal connections appear when they should, and don't appear when they shouldn't.** The model does not invent tensions between unrelated papers. When two papers actually disagree, the debate block names the disagreement correctly.
- [ ] **The faithful technical depth of the per-paper full report is preserved.** The briefing references papers with ~800–1500 word reports that are faithful compressed re-derivations (this is the current tool's moat and must not regress).

## Regressions that block Phase 2 regardless of "better"

- [ ] **The current tool's `arxiv_analysis_XXmin.md` output is still generated** and still has the same quality as before Phase 1 started. Phase 1 must not degrade the existing tool.
- [ ] **Structured output repair does not fall over** more than once or twice per 14-day period (occasional failures are fine; consistent failures mean the schema or prompt needs revision).
- [ ] **Token budget pre-flight fires** when it should — at least one notice or block event during the 2-week window, to verify the mechanism works.
- [ ] **The test suite remains green.** Any added test fixtures are kept up-to-date.

## If the gate fails

If fewer than 3 of the 5 "better" criteria hold or any regression is present, **do not start Phase 2**. Instead:

1. Identify which criterion failed and why
2. Iterate on `prompts/synthesis.md` (most likely cause)
3. Add any new failing scenarios as cached fixtures in `tests/fixtures/llm/`
4. Re-run the 2-week test

## If the gate passes

1. Write a short note in `docs/superpowers/plans/` summarizing: which criteria passed cleanly, which were marginal, what prompt changes happened during the 2 weeks, and any issues to address in Phase 2
2. Begin writing the Phase 2 implementation plan
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-13-aparture-phase-1-acceptance-checklist.md
git commit -m "docs: add Phase 1 acceptance gate checklist"
```

---

## Self-review

After writing the plan above, re-check against the spec:

**Spec coverage (§11 Phase 1 items):**

- ✓ Synthesis stage as `pages/api/synthesize.js` — Task 14
- ✓ Structured-output validator + repair — Tasks 10, 11, 12
- ✓ LLM test harness (provider abstraction + cached fixtures + golden-output tests) — Tasks 1, 3, 4, 5, 15
- ✓ Briefing renderer (alphaxiv-style components) — Tasks 17–28
- ✓ Two-level per-paper reports (full preserved, quick added) — Task 16
- ✓ History in localStorage — Task 30
- ✓ Profile textarea — Task 29
- ✓ Token budget pre-flight — Tasks 9, 14
- ✓ Current tool's outputs remain available — Task 32 verification includes this
- ✓ Acceptance gate for Phase 2 — Task 32

**Spec §6 pipeline coverage:**

- ✓ Stage 5 Synthesis with structured output (Anthropic tool_use, Google responseSchema, OpenAI response_format) — Tasks 6, 7, 8, 14
- ✓ Citation validation pass — Task 11
- ✓ Two-pass repair prompting — Task 12
- ✓ Token budget pre-flight — Tasks 9, 14

**Spec §7 briefing design coverage:**

- ✓ Typography (Source Serif 4 + Inter + JetBrains Mono) — Task 17
- ✓ Warm gray palette with arXiv red as one accent — Task 17 (briefing.css tokens)
- ✓ 68ch measure — Task 17
- ✓ BriefingProse wrapper — Task 18
- ✓ Header with tagline + stats — Task 19
- ✓ ExecutiveSummary — Task 20
- ✓ PaperCard with text-links-with-arrows action row — Task 21
- ✓ ThemeSection with typographic hierarchy — Task 22
- ✓ DebateBlock — Task 23
- ✓ LongitudinalBlock — Task 24
- ✓ ProactiveQuestionPanel (Phase 1 version — captures answer, Phase 2 adds diff-apply) — Task 25
- ✓ Inline quick-summary expansion — Task 26
- ✓ Right-side panel via Radix Dialog for full report — Task 27
- ✓ BriefingView composition — Task 28

**Placeholder scan:**

- No "TBD"/"TODO"/"similar to Task N" — all tasks contain concrete code
- No "add appropriate error handling" — error handling is specified inline
- Tasks 17 and 31 reference "the current `_app.js`" and "the existing config shape" — these instruct the engineer to read current code and adapt, which is appropriate since the ArxivAnalyzer monolith is being modified incrementally. This is not a placeholder; it is a necessary adaptation step.

**Type consistency check:**

- The `BriefingSchema` types (Task 10) match the typed components referenced in Tasks 14 (synthesis API), 28 (BriefingView), and 32 (verification)
- The `callModel` signature is consistent across Tasks 5, 6, 7, 8, 14, 16
- The `hashInput` function is used consistently across Tasks 3, 4, 5, 15, 16
- `useBriefing` and `useProfile` hook exports match their usage in Task 31

**Gaps / things deferred to Phase 2 (correctly):**

- Electron shell — Phase 2
- OS keychain — Phase 2
- Filesystem layout — Phase 2
- First-run wizard — Phase 2
- memory/\*.md files beyond the profile — Phase 2
- Full proactive-question diff-apply workflow — Phase 2
- Figure image extraction (captions only in Phase 1) — Phase 2
- Daily scheduler — Phase 2
- HTML export — Phase 2
- NotebookLM ZIP bundle — Phase 2
- Structured logging infrastructure — Phase 2

No spec requirements were dropped without being deferred with justification.

---

## End of Phase 1 plan
