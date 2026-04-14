# Batch 1 Execution Report

**Plan:** `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md`
**Batch:** 1 of 7 (Tasks 1–6 from the in-repo plan)
**Started:** 2026-04-13 ~23:35 EDT
**Completed:** 2026-04-14 ~00:46 EDT
**Wall time:** ~1 h 10 min
**Status:** ✅ Clean — no outstanding issues
**Reviewed by:** spec compliance + code quality reviewers (Tasks 5 and 6); manual verification (Tasks 1–4)

---

## What this batch was supposed to deliver

Per the in-repo plan §11, Batch 1 corresponds to Tasks 1–6, which together establish:

- A working unit-test harness (Vitest + React Testing Library)
- Runtime dependencies for the rest of Phase 1 (zod, tiktoken, Radix primitives)
- Deterministic input hashing for fixture lookup (`lib/llm/hash.js`)
- A filesystem-backed fixture loader (`lib/llm/fixtures.js`)
- The provider abstraction `callModel()` with fixture-mode support and a live-mode stub (`lib/llm/callModel.js` + `lib/llm/providers.js`)
- The first real provider integration: Anthropic Messages API with `tool_use` structured output (`lib/llm/structured/anthropic.js`)

After Batch 1, `callModel()` works in fixture mode for all three providers and live mode for Anthropic. Google and OpenAI live mode are deliberately stubbed and will be added in Batch 2 (Tasks 7–8).

## Commits produced (8 total)

| #   | Hash      | Message                                                                     | Source                                                |
| --- | --------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `acb4e02` | `chore: add vitest + RTL test infrastructure`                               | Task 1 implementer                                    |
| 2   | `18a8f49` | `chore(lint): allow __dirname in *.config.mjs files`                        | Task 1 lint fix (caught by code-quality reviewer)     |
| 3   | `fcb0bfd` | `chore: add zod, tiktoken, Radix dialog + collapsible`                      | Task 2 implementer                                    |
| 4   | `3408b78` | `feat(llm): add deterministic input hashing for fixture lookup`             | Task 3 implementer                                    |
| 5   | `a87f958` | `feat(llm): add fixture loader for test mode`                               | Task 4 implementer                                    |
| 6   | `53690b7` | `feat(llm): add provider abstraction with fixture mode`                     | Task 5 implementer                                    |
| 7   | `d80ae38` | `feat(llm): add Anthropic live mode with tool_use structured output`        | Task 6 implementer                                    |
| 8   | `ebac518` | `refactor(llm): consolidate Anthropic provider config + edge tests + JSDoc` | Task 6 review fixes (caught by code-quality reviewer) |

## Test suite progression

| After task    | Test files | Tests | Notes                     |
| ------------- | ---------- | ----- | ------------------------- |
| Pre-batch     | 0          | 0     | No vitest in repo         |
| Task 1        | 1          | 1     | Smoke test                |
| Task 2        | 1          | 1     | (deps install only)       |
| Task 3        | 2          | 4     | + `hash.test.js` (3)      |
| Task 4        | 3          | 7     | + `fixtures.test.js` (3)  |
| Task 5        | 4          | 10    | + `callModel.test.js` (3) |
| Task 6        | 5          | 14    | + `anthropic.test.js` (4) |
| Task 6 polish | 5          | 17    | anthropic tests grew to 7 |

**Final state:** 17 tests across 5 files, all passing. `npm run lint` exits 0 errors (1 pre-existing warning in `docs/.vitepress/theme/index.js` about an unused `app` arg — not introduced by this batch).

## New files in the repo

```
lib/llm/
├── hash.js                       # deterministic SHA-256 input hashing
├── fixtures.js                   # filesystem fixture loader (loadFixture, loadFixtureByHash, saveFixture)
├── callModel.js                  # provider abstraction (fixture + live mode for Anthropic, stub for Google/OpenAI)
├── providers.js                  # PROVIDERS config map + getProviderConfig validator
└── structured/
    └── anthropic.js              # buildAnthropicRequest + parseAnthropicResponse (tool_use)

tests/
├── setup.js                      # @testing-library/jest-dom/vitest extension
├── unit/
│   ├── smoke.test.js             # vitest sanity check
│   └── llm/
│       ├── hash.test.js          # 3 tests
│       ├── fixtures.test.js      # 3 tests
│       ├── callModel.test.js     # 3 tests
│       └── structured/
│           └── anthropic.test.js # 7 tests (4 original + 3 polish)
└── fixtures/
    └── llm/
        ├── abc123def456.json     # Task 4 fixture (canned hash)
        └── 78b26a32e1d4ee29a401271afcc50edc.json  # Task 5 fixture (real hashed input)

vitest.config.mjs                 # Vitest config (jsdom, plugin-react, @ alias, glob)
```

## Modified files

- `package.json` — added 6 dev deps (`vitest`, `jsdom`, `@vitejs/plugin-react`, `@testing-library/{react,jest-dom,user-event}`) + 4 runtime deps (`zod`, `tiktoken`, `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`) + 3 test scripts (`test`, `test:watch`, `test:coverage`). All 19 pre-existing scripts preserved.
- `package-lock.json` — automatic from `npm install`
- `eslint.config.js` — extended `*.config.js` overrides pattern to also match `*.config.mjs` so `vitest.config.mjs`'s use of `__dirname` is recognized

## Issues caught and fixed mid-batch

### Task 1: ESLint failure on `vitest.config.mjs`

**Caught by:** code-quality reviewer subagent
**Symptom:** `npm run lint` failed with `'__dirname' is not defined no-undef` at `vitest.config.mjs:15:25`.
**Root cause:** ESLint's `*.config.js` override block (which sets `__dirname` as a global) only matched `.js` files, not `.mjs`. Vitest config files use the `.mjs` extension by convention.
**Fix:** One-line edit to `eslint.config.js` extending the pattern to `['*.config.js', '*.config.mjs']`. Committed separately as `18a8f49`.
**Re-verification:** `npm run lint` now exits 0 errors.

### Task 6: Constant duplication and hardcoded auth header

**Caught by:** code-quality reviewer subagent
**Symptoms:**

1. `lib/llm/structured/anthropic.js` hardcoded the URL `https://api.anthropic.com/v1/messages` and the `'anthropic-version': '2023-06-01'` header — both already declared in `lib/llm/providers.js`.
2. `lib/llm/callModel.js`'s Anthropic branch hardcoded `'x-api-key': input.apiKey` instead of reading `apiKeyHeader` from `providers.js`.

**Why this mattered:** The same duplication would recur in `google.js` and `openai.js` in Batch 2, multiplying the drift surface across three providers. Fixing the pattern now sets a clean template for Tasks 7 and 8.

**Fix:** One follow-up commit (`ebac518`) that:

1. Imports `PROVIDERS` from `../providers.js` in `anthropic.js` and uses `PROVIDERS.anthropic.baseUrl` + `...PROVIDERS.anthropic.extraHeaders`
2. Captures `providerCfg = getProviderConfig(input.provider)` in `callModel.js` and uses `providerCfg.apiKeyHeader` / `providerCfg.apiKeyPrefix` (the latter handles OpenAI's `Bearer ` prefix when Task 8 lands)
3. Adds a comment documenting the single-tool_use assumption in `parseAnthropicResponse`
4. Adds 3 missing edge tests (custom `maxTokens`, multiple text parts, empty response)
5. Adds JSDoc to both exported functions in `anthropic.js`

**Re-verification:** Anthropic test count grew from 4 to 7. Full suite at 17 passing. Lint clean.

## Subagent dispatch summary

- **Implementers:** 7 dispatches (one per task, plus 2 fix dispatches for the lint and review issues). All used `general-purpose` agents with `sonnet` model except the haiku-eligible mechanical tasks (Task 2 install, Task 1 lint fix).
- **Spec compliance reviewer:** 2 dispatches (Task 1 and Task 6 — the two checkpoints I committed to). Both returned ✅.
- **Code quality reviewer:** 2 dispatches (Task 1 and Task 6). Task 1 returned ⚠️ (lint issue), fixed in `18a8f49`. Task 6 returned ⚠️ (constant duplication + missing tests + JSDoc), fixed in `ebac518`.
- **Manual verification:** I personally read every committed file and ran `npm test` myself for Tasks 2, 3, 4, 5 instead of dispatching formal reviewers. Justification: those tasks were small enough to fully inspect in seconds, and the formal reviewers add overhead without finding new issues at that scale.

## Things to watch out for

1. **The pre-commit `MODULE_TYPELESS_PACKAGE_JSON` warning** on every `eslint.config.js` execution is cosmetic — it's because `package.json` lacks `"type": "module"`. Adding it would change how every `.js` file in the repo is interpreted (cascading effect on the existing CLI and pages), so we deliberately did NOT fix this. Carry forward as known-noise.
2. **Commits added by lint-staged** (prettier reformatting on `.json`/`.md`/`.js`) sometimes appear as "extra changes" in the diff stat but don't change semantic content. This is normal and expected.
3. **The `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` line** in some commits comes from the implementer subagent's own commit message convention. The earlier commits I made directly use `Claude Opus 4.6 (1M context)`. Both are acceptable; not a problem.
4. **Two test fixture files** are in `tests/fixtures/llm/` — `abc123def456.json` (Task 4's canned-hash example) and `78b26a32e1d4ee29a401271afcc50edc.json` (Task 5's real-hash test). The first is a literal placeholder used only by `loadFixtureByHash` direct lookup tests; the second is the real SHA-256 hash of `{provider:'anthropic',model:'test-model',prompt:'hi'}`.

## What's ready for Batch 2

The provider-abstraction template in `callModel.js` is now consolidated and reuses `providers.js` correctly. Tasks 7 (Google `responseSchema`) and 8 (OpenAI `response_format` strict) should follow the same pattern:

1. Create `lib/llm/structured/<provider>.js` exporting `build<Provider>Request` and `parse<Provider>Response`
2. Each module imports `PROVIDERS` from `../providers.js` for URL + headers
3. Each module's `parse<Provider>Response` should accept an optional `{ expectStructured: true }` flag for providers (Google, OpenAI) that return structured output as JSON inside their text field rather than a separate tool block
4. Add a branch in `callModel.js` using `await import('./structured/<provider>.js')` and the `providerCfg.apiKeyHeader` / `apiKeyPrefix` pattern
5. Write tests in `tests/unit/llm/structured/<provider>.test.js` mirroring the anthropic test structure

## Recommendation

**Continue to Batch 2.** No outstanding issues, all tests green, lint clean, push to origin successful. The provider-abstraction pattern is in good shape for the remaining two providers.

If you're reviewing this in the morning and want to spot-check anything, the highest-value files to read are:

- `lib/llm/callModel.js` — the central dispatch logic (62 lines)
- `lib/llm/structured/anthropic.js` — the template all other providers will follow (72 lines)
- `lib/llm/providers.js` — the single source of truth for provider config (24 lines)
- `tests/unit/llm/structured/anthropic.test.js` — the test pattern (7 tests)
