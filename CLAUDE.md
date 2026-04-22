# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aparture is a Next.js web app for multi-stage arXiv paper discovery + analysis using LLMs.

📚 **Full user docs (VitePress):** [joshspeagle.github.io/aparture](https://joshspeagle.github.io/aparture/) — built from `docs/`. For features, configuration, or usage questions, check there first.

## Commands

Standard scripts are in `package.json` (`npm run dev|build|test|lint|format:fix`, `npm run docs:dev|build`). Non-obvious runners:

- `npm run setup` — interactive first-run CLI config
- `npm run analyze[:report|:document|:podcast]` — unattended browser automation (Playwright-driven, Win/Linux/WSL). Settings persist in browser localStorage; Google auth cached after first podcast run.
- `npm run test:dryrun` — mock API test (fast, no cost)
- `npm run test:minimal` — real API test (5 papers, minimal cost)
- `node scripts/smoke-llm-routes.mjs` — calls every LLM-backed API route in-process against all 3 providers with minimal-cost payloads (1–2 papers, short text). Requires `.env.local` with `ACCESS_PASSWORD` + provider keys. Sets `NODE_ENV=test` so analyze-pdf uses the `_testPdfBase64` escape hatch (no real PDF download). Bills the user — keep payloads small. Flags: `--only=route1,route2`, `--providers=anthropic,google`, `--model-<provider>=<id>` (override both batch + briefing models for a provider, e.g. `--model-anthropic=claude-sonnet-4.6` to test an Opus/Sonnet thinking path), `--batch-model-<provider>=<id>` / `--briefing-model-<provider>=<id>` for split overrides. On Windows Node, must be launched via `file://` URL loader (the script's `importRoute` helper handles this automatically).

## Architecture

### Tech Stack (non-obvious bits)

- **State:** Zustand (`stores/analyzerStore.js`) — central store replacing ~28 useState calls; 9 slices incl. `reactContext`. Pipeline reads via `getState()`. React hooks (`useProfile`, `useBriefing`, `useFeedback`) wrap localStorage persistence.
- **Typography (briefing view):** Source Serif 4 + Inter + JetBrains Mono via `next/font/google` in `pages/_app.js`.
- **Structured output:** `zod` schema + provider-native structured output (Anthropic `tool_use`, Google `responseSchema`, OpenAI `response_format` strict).
- **Testing:** Vitest + @testing-library/react + jsdom, **fully fixture-based — zero real LLM calls**.

### File Structure

Conventional Next.js layout. Directories that carry non-obvious responsibilities:

- `pages/api/` — one API route per pipeline stage (see "API Integration" below)
- `components/shell/App.jsx` — entry point; owns all hook calls, Zustand selectors, pipeline creation, layout
- `components/ui/` — warm-palette primitives; all inline-styled with `var(--aparture-*)`
- `lib/analyzer/` — extracted pipeline internals (see "Analyzer module split" below)
- `lib/llm/` — provider abstraction (callModel, providers, hash, fixtures, tokenBudget, resolveApiKey). `callModel.js` logs every live call + `[<provider> cache] read=N create=N` on cache hits.
- `lib/llm/structured/` — per-provider request/response shaping (anthropic/google/openai). Each accepts optional `pdfBase64` and `cacheable`/`cachePrefix`.
- `lib/synthesis/` — briefing schema, validator, repair, renderPrompt
- `lib/profile/` — profile utilities (migrations, diff, feedbackCap, suggestPrompt)
- `hooks/` — React hooks, all localStorage-backed. `useProfile.content` is read by every pipeline stage. `useBriefing` has a 90-day rolling window, ID-keyed entries. `useFeedback` has 5 event types (`star`, `dismiss`, `paper-comment`, `general-comment`, `filter-override`); star/dismiss are latest-wins, comments append-only.
- `prompts/` — editable LLM prompt templates (changes live without rebuild). The four `rubric-*.md` files contain a `{{CACHE_BOUNDARY}}` marker that `lib/llm/loadRubricPrompt.js` uses to split each into a cache-stable prefix (rubric + profile) and a variable tail (per-batch papers) for Anthropic caching.
- `utils/models.js` — **single source of truth for model IDs/names/capabilities** (`MODEL_REGISTRY` + `AVAILABLE_MODELS` — always update together)
- `styles/` — `tokens.css`, `shell.css`, `briefing.css` (see "Styling conventions")
- `tests/fixtures/llm/` — cached LLM responses keyed by input hash
- `cli/` — CLI browser automation **(scheduled for deletion in Phase 2)**
- `reports/`, `temp/` — **runtime state** (gitignored; see below)

### Runtime state directories

`reports/` and `temp/` are gitignored but pinned to the repo root because API routes resolve them via `process.cwd()`. **Do NOT delete** `temp/playwright-profile/` (arXiv reCAPTCHA bypass state) or `temp/notebooklm-profile/` (Google session cookies) unless willing to re-auth. Phase 2 migrates both to `~/aparture/{reports,cache}/`.

### API Integration

Each file in `pages/api/` owns one pipeline stage — read the file for its purpose. Two cross-cutting patterns:

**Auth pattern.** All routes accept EITHER `apiKey` (for future BYOK flows) OR `password` validated against `process.env.ACCESS_PASSWORD`. When `password` is provided, the route reads the env-var key for the resolved provider (`CLAUDE_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENAI_API_KEY`). Web UI uses the password path; Phase 2 Electron will use the apiKey path from OS keychain.

**Model slot separation.** Config has distinct `briefingModel` (drives `/api/synthesize` + `/api/suggest-profile`), `pdfModel` (drives `/api/analyze-pdf`), `filterModel`, `scoringModel`, `quickSummaryModel`, `notebookLMModel`. All default to the same model on first run; tunable independently.

## Development Notes

### Environment Variables

See `docs/reference/environment.md` (authoritative). Minimum: `ACCESS_PASSWORD` + one provider key (`CLAUDE_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`).

### Analysis Workflow

Pipeline stages follow `docs/concepts/pipeline.md` (Stage 1 fetch → Stage 5 briefing, with Stage 3.5 post-processing). Beyond that doc:

- **Filter-override pill (Stage 2).** UI click-cycles YES/MAYBE/NO; each override becomes a `filter-override` feedback event that flows into the suggest-profile prompt as a "too narrow/broad" signal.
- **Batch parallelism.** Stages 2/3/3.5/4 each have a concurrency knob (`filterConcurrency`, `scoringConcurrency`, `postProcessingConcurrency`, `pdfAnalysisConcurrency`, default 3, clamped 1–20), all routed through `AnalysisWorkerPool` in `lib/analyzer/rateLimit.js`. Anthropic model slots get a single-flight cache-warmup barrier (worker 0 primes the ephemeral cache entry before siblings start). Dry-run forces concurrency=1. Stage 4 also serializes arXiv downloads server-side at ~5s spacing.
- **Feedback opens after Stage 4**, not gated on briefing.
- **Briefing auto-runs at end** via `lib/analyzer/briefingClient.js`. If `pauseBeforeBriefing` is on (default), pipeline stops at `'pre-briefing-review'` first. Flow: quick summaries (parallel, `quickSummaryConcurrency` default 5) → `/api/synthesize` → `/api/check-briefing` → optional one-shot retry → save via `useBriefing` → render `<BriefingView>`.
- **Main-area layout order after a run:** Results → Download Report → Briefing → NotebookLM.

### Styling conventions

Four layers, each with a distinct job:

| Layer                   | File                  | Used for                                                             |
| ----------------------- | --------------------- | -------------------------------------------------------------------- |
| **Tokens**              | `styles/tokens.css`   | Palette, typography, spacing — consumed via `var(--aparture-*)`      |
| **Shell layout**        | `styles/shell.css`    | Structural classes (`.shell`, `.shell-sidebar`, `.briefing-surface`) |
| **Briefing typography** | `styles/briefing.css` | Reading-surface rules scoped to `.briefing-prose`                    |
| **Inline styles**       | component files       | Component-local visual properties, variant/state switching           |

**Rules:** always reference `var(--aparture-*)` for colors/typography/spacing (never hardcode palette); use `className` for shell layout, briefing-prose BEM, and Lucide icon sizing (`w-*`, `h-*`, `animate-spin`); use inline `style={{...}}` for everything else. **Avoid adding new Tailwind classes** — utility layer is present in `globals.css` but only Lucide sizing + one legacy `md:grid-cols-3` remain.

#### Semantic status colors (hardcoded by design)

These recur with consistent meaning across components and have no `--aparture-*` token because they are status indicators, not palette:

| Value                 | Meaning                               |
| --------------------- | ------------------------------------- |
| `#22c55e`             | done / success / added / YES          |
| `#f59e0b` / `#eab308` | running / MAYBE / warning / test mode |
| `#ef4444`             | error / stop / NO / removed           |
| `#f97316`             | filter-override feedback event        |
| `#3b82f6`             | informational / suggested source      |
| `rgba(0,0,0,0.5)`     | modal overlay scrim                   |

When adding a new status color, document it here rather than introducing a token.

### Profile + Briefing Pipeline

"Your Profile" is the single source of research intent. Every pipeline stage reads `profile.content` from `useProfile`. The profile is refined manually or via the LLM-assisted `SuggestDialog` flow.

**Suggest-improvements flow.** `/api/suggest-profile` accepts current profile + accumulated feedback and returns a revised profile with per-change rationales, or a `noChangeReason` if feedback doesn't point to a gap. All stars/dismisses/overrides are always included in the prompt; comments are capped at most-recent N per type (default 30) with a transparent trimming notice.

**Backend synthesis.** `/api/synthesize` loads `prompts/synthesis.md`, renders placeholders via `lib/synthesis/renderPrompt.js`, dispatches via `lib/llm/callModel.js`, runs zod + citation validation via `lib/synthesis/validator.js`, and falls back to two-pass LLM repair via `lib/synthesis/repair.js`. Every `arxivId` in the output must be in the input list.

**Tuning knobs:**

- **Briefing quality:** edit `prompts/synthesis.md` (highest-impact single knob)
- **Suggest quality:** edit `prompts/suggest-profile.md`
- **Briefing visuals:** edit `styles/briefing.css` (palette tokens propagate automatically)
- **New feedback type:** extend event union in `hooks/useFeedback.js`, add variant in `components/feedback/FeedbackItem.jsx`, add section in `lib/profile/suggestPrompt.js`'s `renderFeedbackSection`
- **New LLM provider:** add entry to `lib/llm/providers.js`, create `lib/llm/structured/<provider>.js` following anthropic/google/openai templates (incl. optional `pdfBase64` + `cacheable`/`cachePrefix`), add a branch in `lib/llm/callModel.js`, add a unit test file under `tests/unit/llm/structured/`. ~150–200 lines.

**Testing LLM-backed code:** all tests are fixture-based. `lib/llm/hash.js` produces a deterministic input hash; cached responses live at `tests/fixtures/llm/<hash>.json`. To add a fixture, run `tests/fixtures/synthesis/generate-sample.mjs` or use the `beforeAll` pattern in existing integration tests.

**Test escape hatches:**

- `APARTURE_TEST_PROMPT_OVERRIDE` env var — routes substitute the variable portion of the prompt so fixture hashes are deterministic. Also disables caching (so `cachePrefix`/`cacheable` are absent from the hashed input).
- `_testPdfBase64` body field on `pages/api/analyze-pdf.js` (active only when `NODE_ENV === 'test'`) — injects PDF bytes directly, bypassing Playwright. Minimal fixture at `tests/fixtures/pdf/minimal.pdf`.
- Occasional vitest worker-pool timeouts in WSL are infrastructure flakes — the test count + pass/fail summary are authoritative.

### LLM Dispatcher + Prompt Caching

All LLM-calling routes go through `lib/llm/callModel.js` — never call a provider API directly.

**Prompt caching (Anthropic only).** Each route splits its prompt into a stable `cachePrefix` (template + profile) and variable `prompt` (per-batch content). When `cacheable: true`, the adapter emits multi-block `content` with `cache_control: {type: 'ephemeral'}` on the prefix. **Invariant:** `cachePrefix + prompt === fullRenderedPrompt` byte-for-byte — test each route's split logic against a known-good rendering. OpenAI auto-caches on repeated prefixes; Google caching is not enabled.

**PDF content blocks.** All 3 adapters accept `pdfBase64`. When present: Anthropic emits a `document` block; Google emits `inlineData` in `parts`; OpenAI switches to `/v1/responses` via `buildOpenAIResponsesRequest` (different shape from Chat Completions — parses `response.output[].content[].text`, not `output_text`). OpenAI Responses structured output uses `text.format.json_schema`, not `response_format`.

**Structured-output schema constraints.** The three providers disagree on which JSON Schema fields are supported. Keep schemas in the **portable subset** and enforce value constraints (count, range, length) in the server-side validator, not the schema. All Aparture routes use the same provider-portable shape:

| Keyword                                                          | Anthropic strict tool_use | Google `responseSchema` (v1beta)                               | OpenAI strict json_schema                                                     |
| ---------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `type`, `properties`, `required`, `items`, `enum`, `description` | ✅                        | ✅                                                             | ✅                                                                            |
| `additionalProperties: false`                                    | ✅ **required**           | ❌ 400 (stripped by `sanitizeSchemaForGoogle`)                 | ✅ **required on every object**                                               |
| `minimum`, `maximum`, `multipleOf`, `pattern`                    | ❌ stripped/400           | ✅ (`minimum`/`maximum` only)                                  | ❌ 400                                                                        |
| `minLength`, `maxLength`                                         | ❌ stripped/400           | ❌ silently ignored                                            | ❌ 400                                                                        |
| `minItems`, `maxItems`                                           | ❌ stripped/400           | ✅                                                             | ❌ 400                                                                        |
| `oneOf`/`allOf`/`anyOf` at root                                  | ❌ 400                    | ❌ unsupported                                                 | n/a                                                                           |
| Top-level `type: 'array'`                                        | ❌ object-rooted          | ❌ object-rooted                                               | ❌ **wrap in `{items: [...]}`**                                               |
| Optional properties (not in `required`)                          | ✅                        | ✅                                                             | ❌ **all properties must be in `required`** — use `["T","null"]` for optional |
| `["T","null"]` nullable type union                               | ✅                        | ❌ 400 (converted to `{type: T, nullable: true}` by sanitizer) | ✅ canonical OpenAI optional-field pattern                                    |

**About the Google column:** Nov 2025 added native `additionalProperties` support to Gemini's newer `response_json_schema` field, but NOT to the `responseSchema` field used by our v1beta adapter — verified via live 400 error. If we ever migrate to `response_json_schema` the sanitizer should drop the `additionalProperties` strip.

**Concrete portability rules for new routes:**

1. Every object MUST include `additionalProperties: false`. Anthropic strict requires it, OpenAI strict 400s without it, and Google's sanitizer strips it cleanly.
2. Every property MUST appear in `required`. For semantically optional fields, use `["string","null"]` so OpenAI strict accepts them. The zod schema should then be `z.union([z.string(), z.null()]).transform(v => v ?? '')` or similar. The Google sanitizer auto-converts `["T","null"]` → `{type: T, nullable: true}` for Google's OpenAPI subset.
3. Top-level schema MUST be `type: 'object'`. Wrap arrays as `{items: [...]}`.
4. Do NOT use `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `multipleOf`, or `oneOf`/`allOf`/`anyOf` — enforce these in the server-side validator instead.

**Adapter behavior:**

- **Anthropic** (`lib/llm/structured/anthropic.js`): tool definition emits `strict: true` for grammar-constrained sampling. Adaptive thinking is gated on model family: enabled for Opus and Sonnet (`claude-opus-*`, `claude-sonnet-*`), disabled for Haiku (live 400: "adaptive thinking is not supported on this model"). When thinking is on, `tool_choice` must be `{type: 'auto'}`; when off, the adapter forces the tool call via `{type: 'tool', name: <schema.name>}` for guaranteed structured output.
- **Google** (`lib/llm/structured/google.js`): `sanitizeSchemaForGoogle` strips `additionalProperties`, `$schema`, `$id`, `$ref`, and converts `["T","null"]` type unions to OpenAPI-3.0 `nullable: true`.
- **OpenAI Chat Completions** (`buildOpenAIRequest`): structured output via `response_format: {type: 'json_schema', json_schema: {name, strict: true, schema}}`.
- **OpenAI Responses API** (`buildOpenAIResponsesRequest`): used when `pdfBase64` is present. Structured output via `text.format: {type: 'json_schema', name, strict: true, schema}` (NOT `response_format`). Response parsed at `output[].content[].text` where `output[].type === 'message'`.

**Cache-hit measurement.** `callModel` surfaces `cacheReadTok` / `cacheCreateTok`; dispatcher logs `[anthropic cache] read=N create=N`.

**Route pattern.** Two patterns coexist depending on whether the route uses the rubric template loader (`loadRubricPrompt`) or assembles its own prompt:

- **Batch routes** (`quick-filter`, `score-abstracts`, `rescore-abstracts`, `analyze-pdf`): always pass `cachePrefix` and `cacheable` as explicit object keys (with `''` and `false` when caching is disabled). Fixture hashes therefore include these keys as empty values, but cleanly within fixture mode.
- **Briefing routes** (`synthesize`, `check-briefing`, `suggest-profile`, `analyze-pdf-quick`): use the conditional-spread idiom `...(useCaching ? { cachePrefix, cacheable: true } : {})` so cache fields are absent from the input when caching is off.

Both patterns are consistent within their own fixture sets — the two cannot share fixtures across modes. Route requirements:

- Accept `apiKey` (BYOK) OR `password` (env lookup per provider). Briefing routes use the shared `resolveApiKey()` helper; batch routes inline the same logic.
- Resolve `provider` (lowercased) from `MODEL_REGISTRY[model]?.provider` before auth.
- Skip the `!apiKey` 401 when `callModelMode?.mode === 'fixture'` so fixture-based tests don't need a fake key.
- Compute `const useCaching = provider === 'anthropic' && !isFixture && !promptOverride;` — all three conditions required.
- Accept `callModelMode` from body and pass as 2nd arg to `callModel`.

### Analyzer module split

`App.jsx` creates the pipeline once via `useMemo(() => createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef}), [])`. The pipeline reads all state from `useAnalyzerStore.getState()` — including the `reactContext` slice, which holds hook-derived values (profile, config, saveBriefing, briefingHistory) that `App.jsx` republishes on every render.

**To add a new pipeline stage:**

1. Add the stage function inside `createAnalysisPipeline` in `lib/analyzer/pipeline.js`, reading deps from `store()` and `store().reactContext`.
2. Declare it after any sibling stages it calls.
3. Wire it into `startProcessing`.
4. If it reads a new React-hook value, add the key to the `reactContext` publish in `App.jsx`.

**To unit-test a stage:** mock the store via `useAnalyzerStore.setState(...)`, then call `createAnalysisPipeline({...refs})` and invoke the returned handler. Internal stages aren't exported — test via `startProcessing` with mocked API responses.

### ArXiv Metadata Queries

`pages/api/fetch-arxiv.js` proxies the public `export.arxiv.org/api/query` endpoint. Three hygiene rules that aren't obvious from the code alone:

- **No `sortBy`/`sortOrder` in the URL.** arXiv's user manual flags sorted queries as more expensive and more throttled. `lib/analyzer/pipeline.js` sorts client-side after the merge. Don't add the params back.
- **Inter-request spacing is jittered 3000–5000ms** via `arxivSpacingMs()` in `pipeline.js`. 3s is arXiv's stated floor — deterministic 3000ms back-to-back trips their sliding-window heuristics more often than jittered spacing.
- **5xx maps onto the 429 retry path.** The proxy rewrites upstream 5xx to a 429-shaped response with `upstreamStatus` passed through; the client retry ladder in `executeArxivQuery` handles both identically (5 / 15 / 45-second exponential backoff, honoring `Retry-After`). Keep them unified — arXiv's 503s behave like their 429s in practice.

**Optional `ARXIV_CONTACT_EMAIL` env var.** When set, sent as the HTTP `From` header on every proxied request. Not authenticated — purely a goodwill signal for arXiv's abuse team. Documented in `docs/reference/environment.md` and `docs/getting-started/install.md` §4.

### ArXiv PDF Download Handling

`pages/api/analyze-pdf.js` tries direct fetch first; if the response lacks `%PDF-` magic bytes, it falls back to Playwright with a persistent profile at `temp/playwright-profile/` that caches arXiv cookies + reCAPTCHA bypass state. Fallback adds ~5–10s/paper.

Concurrency in `lib/analyzer/rateLimit.js`:

- **`ArxivDownloadThrottle`** — module-level singleton in the API route; serializes arXiv fetches to ~5s spacing across concurrent POSTs, honors `Retry-After` on 429/503 (cap 60s). Only the download step is throttled; the LLM call runs in parallel.
- **`AnalysisWorkerPool`** — client-side N-wide queue. Optional `cacheWarmup` barrier runs worker 0's first task alone so Anthropic's ephemeral cache is primed before siblings start. Google/OpenAI skip warmup (OpenAI auto-caches; Google has no caching).

If Playwright is unavailable (e.g. Vercel), route returns HTTP 422 `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA` and the pipeline aggregates skips into `skippedDueToRecaptcha` without halting.

### Refactor Context

Specs + plans for recent refactors live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (gitignored, local-only — check for existence before referencing). Phase 2 scope is in the v2 spec §11 (Electron, filesystem-first state, OS keychain, first-run wizard, memory loop, daily scheduler, full NotebookLM ZIP, HTML export, installers).

## Model Information

**Source of truth:** `utils/models.js` (`MODEL_REGISTRY` + `AVAILABLE_MODELS`). Don't duplicate IDs/pricing here — they rot fast.

**Anthropic adaptive thinking + strict tool use (non-obvious).** Tool definitions are emitted with `strict: true` for grammar-constrained sampling. Adaptive thinking (`thinking: {type: "adaptive"}`) is gated on model family — enabled for Opus/Sonnet, disabled for Haiku. When thinking is on, `tool_choice` must be `{type: "auto"}` (forced `tool`/`any` are rejected); when off, the adapter forces the tool call via `{type: "tool", name: <schema.name>}`. `parseAnthropicResponse` skips `thinking` content blocks. Default `maxTokens` is raised to 16000 to accommodate thinking overhead.

**Not in the registry:** OpenAI o-series (`o3`, `o4-mini`) and xAI Grok. Adding Grok would need a new `lib/llm/structured/xai.js` adapter — xAI's OpenAI-compatible endpoint may not honor `response_format: json_schema` strict mode the same way.

Provider docs: [Anthropic](https://platform.claude.com/docs/en/docs/about-claude/models) · [OpenAI](https://developers.openai.com/api/docs/models) · [Google](https://ai.google.dev/gemini-api/docs/models)

## Documentation maintenance

Two user-facing doc surfaces: README + VitePress docs at `docs/`.

**Split rule.** README is thin (one-paragraph pitch, screenshot, 5-line Quickstart, links into `docs/`). `docs/` is source of truth for everything else. Change one → check the other.

**Trigger → impacted docs:**

| Code area                                                         | Impacted docs                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `utils/models.js`                                                 | `concepts/model-selection.md`, `getting-started/api-keys.md`                                        |
| `lib/analyzer/pipeline.js`                                        | `concepts/pipeline.md`, `using/review-gates.md`, `using/tuning-the-pipeline.md`                     |
| `prompts/synthesis.md`                                            | `concepts/briefing-anatomy.md`, `reference/prompts.md`                                              |
| Any `prompts/*.md`                                                | `reference/prompts.md`                                                                              |
| `lib/synthesis/validator.js`                                      | `concepts/briefing-anatomy.md`                                                                      |
| `pages/api/*` env usage, any new `process.env.*`                  | `reference/environment.md`                                                                          |
| `components/briefing/*`                                           | `using/reading-a-briefing.md`                                                                       |
| `components/feedback/*`                                           | `using/giving-feedback.md`                                                                          |
| `components/profile/*`, `DiffPreview.jsx`, `/api/suggest-profile` | `using/writing-a-profile.md`, `using/refining-over-time.md`                                         |
| `components/run/*` + review-gate UIs                              | `using/review-gates.md`                                                                             |
| Settings panel                                                    | `using/tuning-the-pipeline.md`                                                                      |
| `lib/notebooklm/*`                                                | `add-ons/podcast.md`                                                                                |
| `pages/api/analyze-pdf.js` Playwright changes                     | `getting-started/install.md`, `reference/troubleshooting.md`                                        |
| `pages/api/fetch-arxiv.js` query-shape or retry changes           | `getting-started/install.md` (§4 contact email), `reference/troubleshooting.md` (arXiv rate limits) |

**Skip docs for:** internal refactors, bug fixes for hidden behavior, test additions, `docs/superpowers/**` changes (gitignored).
