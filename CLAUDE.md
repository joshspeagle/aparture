# CLAUDE.md

This file provides architectural guidance and operational invariants for coding agents working in the Aparture repository.

Aparture lets a researcher stop skimming the arXiv without worrying about missing relevant papers. Every design decision supports a synthesized briefing tuned by a user-written research profile, deterministic and model-backed verification of citations and claims before display, and explicit user control over profile edits, review gates, and local API key execution.

Mechanically, Aparture is a Next.js application that runs a staged arXiv analysis pipeline across LLM providers. Architectural design principles and code pointers live in `docs/concepts/design-principles.md`. Product positioning lives in `POSITIONING.md`, where §9 defines the voice rules for all user-facing prose. User documentation is built from `docs/` and published at [joshspeagle.github.io/aparture](https://joshspeagle.github.io/aparture/).

## Commands and checks

- **Application commands:** Run `npm run dev | build | lint | test`, or run a single test file with `npx vitest run <path>`. Run `npm run format` to check formatting and `npm run format:fix` to write changes. Node 22 or newer is required. Both `dev` and `start` bind to `127.0.0.1` by default (pass `npm run dev -- -H 0.0.0.0` to listen on the local network).
- **Documentation commands:** Run `cd docs && npm ci` once, then run `npm run docs:dev` or `npm run docs:build` from the repository root. The VitePress build checks for broken page links, whereas `#anchor` fragments must be verified separately.
- **Vitest project routing:** `vitest.config.mjs` defines two projects (`node` and `jsdom`) selected by include globs. Every new test file must match a glob in exactly one project so that Vitest executes it, and any new top-level test directory requires a corresponding glob entry. A test file under a `node` glob that requires `document`, `DOMParser`, or `localStorage` must be listed in `NODE_PROJECT_EXCEPTIONS`.
- **Hermetic test setup:** `tests/setup.js` clears provider API keys, `ARXIV_CONTACT_EMAIL`, and `APARTURE_REPORTS_DIR` before tests run so the suite stays hermetic; individual tests that require those variables set them explicitly.
- **Git hooks and CI:** The pre-commit hook runs `lint-staged` (ESLint and Prettier), and the pre-push hook runs `eslint .` and `npm test`. Continuous integration (`.github/workflows/ci.yml`, triggered on pushes to `main`, pull requests, and weekly schedules) runs linting, `npx prettier --check .`, `npm audit --omit=dev --audit-level=high`, `npm test`, and `npm run build` on Node 22 and 24, re-runs `npm test` at UTC+14 (`TZ=Pacific/Kiritimati`) on Node 22, and builds the documentation site. Because briefing dates follow local calendar days, run the `TZ=Pacific/Kiritimati` test pass locally whenever modifying date-handling code. Dependabot opens grouped weekly dependency updates.
- **Live smoke scripts:** `node scripts/smoke-llm-routes.mjs` calls every LLM route in-process across all three providers and **bills the configured accounts**. It requires keys in `.env.local` and documents its CLI flags in the file header. The `scripts/probe-arxiv*.mjs` scripts query arXiv live and are run manually.

## Invariants

Violating any of the following invariants causes corrupted output, unexpected API charges, or data loss:

1. **Single LLM dispatcher:** Every model call goes through `lib/llm/callModel.js`, with the sole exception of the zero-cost validation probes in `lib/llm/validateSetup.js`.
2. **Prompt cache split:** Routes split each prompt into a stable `cachePrefix` (the rubric template and research profile) and a variable `prompt` tail such that `cachePrefix + prompt` equals the full rendered prompt byte for byte. Caching is enabled when `useCaching = provider === 'anthropic' && !isFixture && !promptOverride`. Routes using `loadRubricPrompt` pass `cachePrefix` and `cacheable` as explicit keys (`''` and `false` when disabled), whereas briefing-style routes spread `...(useCaching ? { cachePrefix, cacheable: true } : {})`. Keep each route's convention consistent because fixture hashes depend on the exact request shape.
3. **Structured-output portability rules:** Route schemas use only the JSON Schema subset accepted by all three providers, while server-side validators enforce counts, ranges, and string lengths:
   - Every object sets `additionalProperties: false` (required by Anthropic and OpenAI, and stripped automatically by `sanitizeSchemaForGoogle`).
   - Every property appears in `required`, and optional fields use `["T", "null"]`, which the Google sanitizer converts to `nullable: true`.
   - The top-level schema is always `type: 'object'` (arrays are wrapped as `{ items: [...] }`).
   - Schemas omit `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `multipleOf`, `oneOf`, `allOf`, and `anyOf`.
4. **Prompts describe meaning while schemas define shape:** A prompt explains what each field represents, and the route's schema enforces the JSON structure. Prompts must never specify a JSON shape that conflicts with the route schema.
5. **Safety refusals:** Provider safety refusals arrive inside successful HTTP responses. The provider adapter's `parse*` function throws `RefusalError`, the API route responds with HTTP 422 and `code: 'CONTENT_REFUSAL'`, `parseRouteError` throws `ContentRefusalError`, and the pipeline stage applies `config.refusalPolicy`:
   - Refusals bypass the retry ladder because safety classifiers are deterministic and each retry bills input tokens.
   - HTTP 422 is shared with `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA`, discriminated by the `code` field. `analyzePDFs.js` reads the response body inline because the stream can be consumed only once.
   - Google's `MAX_TOKENS` finish reason indicates output truncation, whereas only reasons in `GOOGLE_REFUSAL_FINISH_REASONS` count as refusals (checked outside the `expectStructured` branch).
   - When `refusalPolicy` is `'fail'`, the stage throws `RefusalHaltError` (`fatal: true`), which halts the worker pool and ends the run with a message naming the stage, provider, and policy.
6. **Accurate model billing:** Each stage's `makeAPICall(prompt, isCorrection, modelOverride)` resolves `const effectiveModel = modelOverride ?? config.<slot>Model` and passes that identifier to both the request payload and `recordUsage`.
7. **Single AbortSignal per run:** `startProcessing` assigns each run a unique ID and its own `AbortController`, captures `signal` once, and passes it to every stage, worker pool, fetch call, sleep timer, and review gate (`lib/abort.js`). Stages must never re-read `abortControllerRef` mid-run because stopping and restarting a run replaces `abortControllerRef.current` with the new run's controller. Superseded runs skip their end-of-run persistence writes. Because `callModel` does not take an abort signal, any in-flight provider request completes and is billed.
8. **Call-time state reads:** Pipeline stages read `store()` and `store().reactContext` inside the returned stage function at execution time, never inside the factory closure.
9. **Test-only fixture mode:** Client-supplied fixture mode (`lib/llm/resolveCallModelMode.js`) and `_testPdfBase64` are honored exclusively when `NODE_ENV === 'test'`. The automated test suite makes zero live LLM calls.
10. **arXiv request hygiene** (`lib/arxiv/`):
    - OAI-PMH harvesting requests the `arXivRaw` metadata format and anchors `published` on the `v1` submission date because the standard `arXiv` format's `<created>` element includes re-announced replacements in `submitted-only` windows.
    - Atom query URLs omit `sortBy` and `sortOrder`; results are sorted in memory after merging batches.
    - Metadata API requests are spaced 3–5 seconds apart with jitter (`arxivSpacingMs`) after the initial request. Requests to pages and files on `arxiv.org` (including server-side PDF downloads) are spaced 15 seconds apart (`ARXIV_PAGE_DELAY_MS`, following `robots.txt`), and a Playwright fallback consumes two spacing slots.
    - The arXiv proxy routes rewrite upstream 5xx responses into the HTTP 429 shape so a single client retry ladder handles both conditions.
11. **Cross-run deduplication** (`hooks/useSeenPapers.js`, `lib/analyzer/applyDedupe.js`): `applyDedupe` runs inside `fetchPapers` immediately after `harvest()` (including lookback fill-ups) and before any LLM call. The seen-papers index updates only when a briefing is saved so that aborted runs do not mark unread papers as seen. Keys prefixed with `_` store metadata, `CURRENT_DEDUPE_VERSION` must be incremented whenever migration semantics change, and the hot index maps `{arxivId -> YYYY-MM-DD}`. Because briefing paper cards come from synthesis output, `components/briefing/PaperCard.jsx` (and any new surface downstream of synthesis) derives its duplicate badge from `seenPapersIndex`.
12. **Persistence stability:** The localStorage session key `arxivAnalyzerState` must keep its exact name unless a migration moves existing user sessions. Cold briefing JSON files on disk are deleted only when the user explicitly deletes a briefing in the UI.
13. **Model registry discipline:** Always update `MODEL_REGISTRY` and `AVAILABLE_MODELS` (`utils/models.js`) together. Any removed model ID must be added to `RETIRED_MODEL_REMAP` (`hooks/useAnalyzerPersistence.js`) alongside a config version increment, and every remap target must exist in the active registry (enforced by unit tests).
14. **Playwright browser profile:** Preserve `temp/playwright-profile/` because it stores the arXiv reCAPTCHA cookies required by the headless PDF fallback.

## Architecture

### Directory map

- `pages/api/`: One Next.js API route per LLM step (`quick-filter`, `score-abstracts`, `rescore-abstracts`, `analyze-pdf`, `analyze-pdf-quick`, `synthesize`, `check-briefing`, `editor-questions`, `suggest-profile`, `generate-notebooklm`), the arXiv proxies (`harvest-arxiv` for OAI-PMH and `fetch-arxiv` for Atom), disk persistence (`briefings/*` and `sessions/*`), and `validate-setup` (zero-cost provider probes).
- `components/shell/App.jsx`: Owns the top-level React hooks, pipeline instance, and application layout, and publishes hook-owned state (`profile`, `config`, `currentBriefing`, `feedback`, `saveBriefing`, `briefingHistory`, `seenPapersIndex`, `seenPapersReady`) into the `reactContext` slice of the Zustand store (`stores/analyzerStore.js`) for pipeline stages to read via `getState()`.
- `hooks/`: `localStorage`-backed state hooks, where `useAnalyzerPersistence` manages `DEFAULT_CONFIG`, config migrations, and session persistence.
- `lib/analyzer/` (pipeline orchestration), `lib/llm/` (dispatcher, provider adapters, structured-output extraction, route authentication, typed errors, fixtures, token budget), `lib/arxiv/` (OAI-PMH and Atom harvesting and window math), `lib/persistence/` (shared cold-tier JSON store and `localStorage` quota wrapper), `lib/figures/` (key-figure PDF cropping and storage), `lib/synthesis/` (briefing schema, deterministic checks, LLM repair, audit corpus formatting, reader notes), and `lib/profile/` (feedback status, suggestion outcome attribution, suggestion prompt builder, starter templates).
- `bin/`, `lib/headless/`, `lib/briefing/v2/`, and `.claude/skills/aparture/`: The headless Node CLI runner and agent skill.
- `audits/`: Point-in-time audit reports retained as historical provenance describing the codebase prior to subsequent fixes.
- `reports/` and `temp/`: Gitignored runtime directories resolved relative to `process.cwd()` at the repository root.

### Pipeline

`App.jsx` instantiates the analysis pipeline once via `useState(() => createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef }))`. `lib/analyzer/pipeline.js` constructs the shared helpers in `stages/core.js` (`recordUsage`, `waitForResume`, `makeRobustAPICall`) and passes a single `deps` object to each stage factory in `lib/analyzer/stages/`. `startProcessing` drives the stages sequentially with the run's `{ signal }` and returns a `RUN_OUTCOME` (`ignored`, `aborted`, `superseded`, `finished`) that callers branch on. Full stage semantics are documented in `docs/concepts/pipeline.md`.

To add a pipeline stage, export `create<Stage>(deps)` from `lib/analyzer/stages/<stage>.js`, instantiate it inside `createAnalysisPipeline` before `createStartProcessing`, invoke it from `startProcessing.js` with the run's `signal`, and publish any required hook values into `reactContext`. Pure in-memory transformations belong as helper functions inside an existing stage (following `applyDedupe`). To test a stage, populate store state with `useAnalyzerStore.setState(...)` and drive `startProcessing` against mocked API routes.

- **Concurrency:** Stages 2–4 execute batches through `AnalysisWorkerPool` (`lib/analyzer/rateLimit.js`, defaulting to concurrency 3, clamped to 1–20, and fixed at 1 during dry runs). Individual task errors are logged and recorded by the worker, whereas an abort or `fatal` error stops the pool and causes `run()` to reject. On Anthropic model slots, `cacheWarmup` runs worker 0's first task alone so subsequent workers read the warm prompt cache; the refusal-fallback path triggers mid-task and coordinates through `CacheWarmupGate` instead.
- **Retries:** `parseRouteError` (`lib/analyzer/RateLimitError.js`) converts HTTP 429, 503, and 529 responses into `RateLimitError`: `makeRobustAPICall` honors `Retry-After` up to 60 seconds (or backs off exponentially up to 30 seconds), while `getLLMBarrier(provider)` pauses all concurrent workers for that provider. HTTP 400, 401, 403, 404, 413, and 422 responses without a sentinel `code` become `NonRetryableRouteError` and fail immediately on the first attempt. Other transient errors retry up to `config.maxRetries` times.
- **Review gates:** `startProcessing.js` pauses at `filter-review` (`pauseAfterFilter`), `score-review` (`pauseBeforeDeepAnalysis`), and `pre-briefing-review` (`pauseBeforeBriefing`). Each gate renders `<ReviewGateBanner>` (`components/run/`) at the top of its review surface (`FilterResultsList`, `ScoreReviewSurface`, `PreBriefingGate`), while `ProgressTimeline` displays status only. The PDF analysis set is computed by `resolveAdditiveSet.js` as `(top maxDeepAnalysis) ∪ starred − dismissed`.
- **Briefing generation:** `lib/analyzer/briefingClient.js` runs quick summaries, `/api/synthesize`, `/api/check-briefing`, an optional synthesis retry, and `/api/editor-questions`, then saves the result through `useBriefing` after verifying the run's abort signal. If the hallucination check fails to execute after one retry, the briefing is saved as unaudited with `generationMetadata.hallucinationCheckError` populated so that an unaudited briefing never appears verified. Editor's questions are non-fatal, and `lib/editorQuestions/questions.js` retains only well-formed questions that cite an arXiv ID from the input set. Quick summaries are shown only to the reader in the UI and are excluded from both synthesis and the audit corpus. General comments entered at Gate 3 (`origin: 'pre-briefing'`) are passed to `/api/synthesize` as `readerNotes` appended after the cached prompt prefix (`lib/synthesis/readerNotes.js`).
- **Briefing checks** (`lib/synthesis/validator.js`): `normalizeBriefing` overwrites card titles and scores from the input paper metadata, and `validateBriefing` rejects unknown arXiv IDs (in cards, themes, or prose) as well as missing, duplicate, or unthemed cards. Validation failures trigger one LLM repair pass (`repair.js`) followed by deterministic `salvageBriefing` if repair fails. Full details appear in `docs/concepts/briefing-anatomy.md`.
- **Audit corpus:** `/api/check-briefing` formats source papers through `lib/synthesis/checkCorpus.js` without truncation. Because the auditor must inspect the exact text the synthesis model received, always update `mapFinalRankingToBriefingPapers`, `callCheckBriefing`, and `checkCorpus.js` together.

### Model slots

Pipeline model configuration keys are `filterModel`, `scoringModel`, `postProcessingModel`, `pdfModel`, `briefingModel` (shared across `synthesize`, `check-briefing`, `editor-questions`, and `suggest-profile`), `quickSummaryModel`, and `refusalFallbackModel`, while `notebookLMModel` lives in the store's `notebookLM` slice. All default values are defined solely in `DEFAULT_CONFIG`. `postProcessingModel` backs the Review Model selector under Enable Post-Processing (Scoring options) and must be updated independently of `scoringModel`.

### Authentication pattern

- All LLM routes and `validate-setup` accept either a client-supplied `apiKey` (the Phase 2 desktop path) or `password` (verified against `ACCESS_PASSWORD` and exchanged for the server's environment key). They share `lib/llm/resolveRouteAuth.js`, where `checkRoutePassword` checks the password alone and `resolveRouteAuth` executes the full authentication and fixture-mode resolution ladder.
- Routes that perform local I/O prior to calling an LLM authenticate first: `analyze-pdf` verifies `password` or validates the provider key prefix via `lib/auth/apiKeyShape.js` before downloading a PDF or launching Playwright.
- The arXiv proxy routes read `password` from the request body. Persistence routes read `password` from the request body on `POST` and `PATCH` and from the percent-encoded `x-aparture-password` header on `GET` and `DELETE` (`lib/auth/passwordHeader.js`).
- `checkAccessPassword` fails closed when `ACCESS_PASSWORD` is unset and compares strings in constant time.

### Persistence

Hot state lives in browser `localStorage` and cold state lives on disk, with all `localStorage` writes routed through `safeSetItem` (`lib/persistence/safeStorage.js`) and cold JSON storage shared through `lib/persistence/coldStore.js` (`getColdStoreDir`, `validateColdId`, `resolveColdFile`, `listColdJsonFiles`, and `atomicWriteColdJson`):

- **Briefings:** Hot state uses `aparture-briefing-current` and the newest-first `aparture-briefing-index` (keeping `filterBriefings` synchronous). Cold state writes `reports/briefings/<id>.json` through `/api/briefings[/:id]` (backed by `lib/persistence/coldStore.js`), loaded on demand by `useBriefing.loadBriefing(id)`. When the hot index exceeds `HOT_INDEX_BUDGET_CHARS`, `safeSetItem` trims entries starting with test runs (`testRun`, set by `buildIndexEntry`), while cold files remain on disk. Key extension points are `MUTABLE_FIELDS` (`pages/api/briefings/[id].js`), `HEAVY_FIELDS` (`hooks/useBriefing.js`), and `buildIndexEntry`.
- **Sessions:** Hot state writes a compact summary (under ~600 KB, capped at the top-30 `finalRanking`) to `arxivAnalyzerState` (`lib/session/buildHotEntry.js`), while cold state writes full session data to `reports/sessions/<sessionId>.json` via `/api/sessions[/:id]` (backed by `lib/persistence/coldStore.js`).
- **Key figures:** `/api/analyze-pdf` crops the model-selected figure from the already-downloaded PDF (`lib/figures/cropFigure.js`, using `pdf.js` and `@napi-rs/canvas`, both listed in `serverExternalPackages`), writes `reports/figures/<arxivId>.png` and `.json`, and serves the image from `/api/figures/[id]` behind the password header. The model selects only the figure label, while the displayed caption is extracted directly from the PDF text. If cropping fails, the paper's analysis still succeeds. Briefings store figure metadata in `figuresById` (listed in `HEAVY_FIELDS`), and the headless runner's `figure` and `render` commands use the same cropping logic for PDF-only papers.
- **Directory override and deduplication trigger:** `APARTURE_REPORTS_DIR` overrides the `reports/` base directory across all three persistence stores. In `App.jsx`, `saveBriefingAndSwitch` invokes `useSeenPapers.recordRun` after `saveBriefing` resolves, extracting paper IDs via `lib/seenPapers/papersFromBriefing.js`.

### Profile and feedback

- Every pipeline stage reads `useProfile().content` through `profileWithNotes(content, notes, scope)` (`lib/profile/editorialNotes.js`), which appends the active scope's editorial notes (`selection` for filter, scoring, rescoring, and PDF analysis; `writing` for synthesis and editor's questions; `podcast` for the focus prompt; none for `check-briefing`) and returns the raw profile string unchanged when no notes exist. Editorial notes are stored alongside `content` on the working profile, named snapshots, and revision history entries, updated exclusively via `updateNotes` or accepted suggestions (`noteChanges` from `/api/suggest-profile`, validated by `validateNoteChanges`), and capped at 12 notes per scope. The agent skill stores editorial notes in `learned.md` using the identical section format, read via `node bin/aparture.mjs notes`.
- The working profile uses the `aparture-profile` key, named profiles are stored as snapshots in `aparture-profiles` with an `aparture-active-profile` pointer, and every committed edit writes through to the active snapshot. `BLANK_PROFILE_TEMPLATE` is assigned to `DEFAULT_CONFIG.scoringCriteria` so fresh installs start with a neutral template.
- `useFeedback` records seven event types: `star` and `dismiss` (latest event wins), `paper-comment` and `general-comment` (append-only), `filter-override` (latest wins per paper and run date, recorded when clicking the verdict pill during or after a run), `scoped-feedback` (latest wins per scope and briefing date), and `answer` (replies to editor's questions, where latest wins per question and date and clicking again withdraws the reply). Events carry optional `testMode`, `incorporatedAt`, `editedAt`, and `origin` metadata.
- `lib/profile/feedbackStatus.js` classifies each event as `test` (recorded during a Dry Run or Minimal API Test and excluded from suggestions and live briefings), `pending`, or `incorporated`. Editing an incorporated comment resets its status to `pending`.
- `resolveSuggestionOutcome` (`lib/profile/suggestOutcome.js`) marks an event as `incorporated` only when an accepted change's rationale cites its arXiv ID or title, or quotes its text; reverting a profile revision reopens those events via `reopenIncorporatedSince`.
- **Automatic proposals:** After a live briefing saves, `saveBriefingAndSwitch` invokes `runProposalRound` (`lib/profile/runProposalRound.js`) when `config.autoProposals` is enabled. `proposalGate` (`lib/profile/autoProposals.js`) weights pending events (1 point for a star, dismissal, or filter override; 2 points for a comment; 4 points for an answer) and triggers a proposal round once unweighed events reach 4 points across at least 2 briefings or include an answer, provided no earlier proposals are awaiting review. Generated proposals are stored in `useAutoProposals` (`aparture-auto-proposals`) and reviewed in `SuggestDialog` via its `preset` prop, sharing `lib/profile/requestSuggestion.js` with manual suggestion requests. The skill's `references/feedback.md` applies the identical threshold.
- `/api/suggest-profile` filters selected pending events through `applyCap` (`lib/profile/feedbackCap.js`), which caps comment counts and drops unlisted event types. Question replies are formatted under `"ANSWERS TO THE EDITOR'S QUESTIONS"`, and the 10 most recent entries from `useProfile().rejectedSuggestions` are appended as `"PREVIOUSLY REJECTED SUGGESTIONS"` by `suggestPrompt.js`.

### LLM adapters

`lib/llm/structured/{anthropic,google,openai}.js` construct provider payloads and parse responses, while `lib/llm/structured/extractParsed.js` unwraps the parsed structured output across the rubric and PDF routes. All three adapters accept `pdfBase64`, while only the Anthropic adapter uses `cacheable` and `cachePrefix`:

- **Anthropic:** Structured output is configured via `output_config.format` (`{type: 'json_schema', schema}`) without tool definitions, which works whether adaptive thinking is enabled or disabled. The response parser extracts JSON from the text block, skips `thinking` blocks, and retains compatibility with `tool_use` blocks in legacy test fixtures. The cacheable prefix is sent as a dedicated text block with `cache_control: {type: 'ephemeral'}`, and `callModel` logs `[anthropic cache] read=N create=N`.
- **Google:** The API key is sent in the `x-goog-api-key` HTTP header. `thoughtsTokenCount` is billed and tracked as output tokens, and `sanitizeSchemaForGoogle` adapts JSON schemas for `responseSchema`. Aparture relies on Google's implicit caching rather than creating explicit cache objects.
- **OpenAI:** Text-only calls use Chat Completions with a strict `response_format` schema, whereas PDF calls use `/v1/responses` (`buildOpenAIResponsesRequest`) and extract the `phase: 'final_answer'` message (or the final message if unmarked).

### arXiv ingestion

`fetchPapers` wraps `ingest.harvest`, and the user-facing ingestion model is documented in `docs/concepts/arxiv-ingestion.md`:

- `config.arxivIngestion` supports `auto` (OAI-PMH with a per-run circuit breaker that falls back to Atom on the first hard failure), `oai-only`, and `atom-only`. OAI-PMH and Atom use separate arXiv rate-limit buckets.
- `daysBack` specifies $N$ days of announcement content. Under `submitted-only` semantics, the OAI fetch window widens backward by `ANNOUNCE_LAG_BUFFER_DAYS` (7 days) and `harvest` anchors on the most recent `v1` submission date with content. `buildHarvestWindow`, `shiftIsoDate`, and `ANNOUNCE_LAG_BUFFER_DAYS` live in `lib/arxiv/window.js` and are shared across `stages/fetchPapers.js`, `lib/arxiv/ingest.js`, and `lib/arxiv/fillups.js`.
- The harvest cache (`lib/arxiv/cache.js`) keys on set, `from`, `until`, mode, and window semantics for lookback fill-ups. `lib/arxiv/sets.js` derives OAI set specs from prefix rules independently of `utils/arxivCategories.js`, so adding a category may require updating both files.
- `harvest` and `harvestOai` accept injectable `spacingMsImpl` and `sleepImpl` functions so multi-request unit tests can pass a no-op sleep.
- `analyze-pdf` verifies that fetched bytes start with `%PDF-` and falls back to Playwright (`temp/playwright-profile/`) when arXiv returns a reCAPTCHA page. When Playwright is unavailable, the route returns HTTP 422 `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA` and the stage records the paper in `skippedDueToRecaptcha`.

### Headless runner and agent skill (prototype)

`bin/aparture.mjs` executes the mechanical steps of a briefing run from Node without starting the web server: `fetch`, `enrich`, `validate`, `render`, `record`, `ingest`, and `figure` (`node bin/aparture.mjs help`). It makes no LLM calls; the agent skill in `.claude/skills/aparture/` performs the reading and writing steps and invokes the runner between phases (`.agents/skills/aparture` is a symlink to `.claude/skills/aparture/`, so always edit the files under `.claude/`).

- **JSON-only stdout:** The runner redirects `console.log` to `stderr` because imported route handlers log status lines; keep all non-JSON output off `stdout`.
- **In-process routes:** The runner invokes the arXiv proxy handlers in-process (`lib/headless/inProcessRoute.js`), installs `jsdom`'s `DOMParser` (requiring a full `npm ci` including `devDependencies`), and generates a random `ACCESS_PASSWORD` when none is set in the environment.
- **Crawl spacing:** Requests to `arxiv.org` pages and PDFs are spaced 15 seconds apart (`arxivPageSpacingMs`), with `--spacing-ms` available for tests.
- **Isolated skill state:** Skill state lives in `$APARTURE_STATE` (defaulting to `./aparture-state`), separate from the web app's `reports/` directory, and skill briefings use `lib/briefing/v2/` (schema, grounding validator for cited IDs and verbatim quotes, and HTML renderer).
- **Skill parity maintenance:** Because the web app and the agent skill share prompts, arXiv harvesting code, and briefing rules, any change to briefing structure, feedback proposal gating, prompt sections referenced by the skill, or runner commands and flags must update `.claude/skills/aparture/` in the same pull request (or document why they diverge). New mechanical logic belongs in `lib/` so the runner can invoke it in-process. `tests/unit/skillParity.test.js` verifies all prompt headings, score formulas, banned words, runner commands and flags, and reference file paths used by the skill.

## Model information

`utils/models.js` is the single source of truth for model metadata; never duplicate model IDs or prices into application code or this file. The registry maintains each provider's current and previous model generations:

- **Pricing:** `inputPerMTok` and `outputPerMTok` record USD list prices per million tokens, with optional time-bounded `promo` blocks resolved by `effectivePricing`. Setting price fields to `null` marks pricing as unverified, causing `lib/analyzer/costEstimate.js` to omit the cost estimate rather than guessing.
- **Adaptive thinking:** Every Anthropic registry entry defines `supportsAdaptiveThinking` (queried via `supportsAdaptiveThinkingByApiId`), which adds `thinking: {type: 'adaptive'}` to the request when true. `output_config.effort` is valid only when thinking is enabled and is not set by any route. For unregistered Anthropic model IDs, the adapter falls back to name matching (enabling thinking for Fable, Mythos, Haiku 5+, and Opus/Sonnet 4.6+). Always set `supportsAdaptiveThinking` explicitly when registering new Anthropic models.
- **Output token budget:** Anthropic calls default to `maxTokens: 16000` because adaptive thinking tokens count toward the output limit; a structured response truncated at `max_tokens` throws a descriptive error rather than a JSON parse failure.
- **Data retention requirements:** Certain Anthropic models (such as the Fable series) return HTTP 400 unless the organization's data retention is set to 30 days, as noted in their registry comments.
- **Token pre-flight check:** `lib/llm/tokenBudget.js` estimates prompt length at roughly 4 characters per token across all providers, and `/api/synthesize` blocks prompts that exceed the threshold unless `allowOverBudget` is set.

## Prompts

Prompt templates in `prompts/*.md` are read from disk on every request, with `synthesis.md` having the largest effect on briefing prose. The four `rubric-*.md` files contain a `{{CACHE_BOUNDARY}}` marker where `lib/llm/loadRubricPrompt.js` splits the cacheable prefix from the per-batch paper list. Test overrides (`APARTURE_TEST_*` and `_testPdfBase64`) are documented in `docs/reference/environment.md`; setting a prompt override also disables prompt caching so fixture hashes remain deterministic.

Follow these harmony rules whenever editing a prompt:

1. **Label the profile `"Research profile:"`** in every rubric and in `editor-questions.md`, treating the profile as the reader's voice.
2. **Profile-aware quality strictness:** `rubric-scoring.md`, `rubric-pdf.md`, and `rubric-rescoring.md` each contain a `"Calibrate Quality strictness to the profile"` paragraph with a breadth-versus-selectivity clause so broad profiles are not penalized.
3. **Unified claims standard for writer and auditor:** Every factual claim about an individual paper (a number, named method or dataset, comparative result, or attribution) requires support in that paper's abstract or full report, whereas cross-paper synthesis in `executiveSummary` and `themes[].argument` is valid unless it contradicts a source paper. Keep `"Sourcing discipline"` in `synthesis.md` and `"What counts as a hallucination"` in `check-briefing.md` synchronized.
4. **Permissive quick filter:** A paper that passes the quick filter as `MAYBE` should score 3–5 on Alignment in `rubric-scoring.md` unless the abstract clearly supports a higher match.
5. **Demonstrate rather than promote:** `"novel"`, `"breakthrough"`, and `"paradigm-shift"` are the named banned words across `synthesis.md`, `analyze-pdf-quick.md`, `rubric-pdf.md`, `notebooklm-discussion-guide.md`, and `.claude/skills/aparture/references/briefing.md`; update those files together or leave them unchanged.
6. **Podcast alignment with the briefing:** `notebooklm-discussion-guide.md` retains the lead paper of each theme even when its score falls below the pruning cutoff, and its pruning table mirrors the length presets in `lib/notebooklm/podcastLength.js` (`Short`, `Default`, `Long`, matched to Gemini Notebook's length options).
7. **Caveats as factual content:** State a paper's reported limitations directly as facts while avoiding model self-hedging.
8. **Meaning in prompts, shape in schemas:** Omit example JSON blocks and `"respond only with"` instructions from prompt prose.
9. **Calm rule statements:** State each constraint once with its rationale instead of using all-caps emphasis, because current models over-weight shouted constraints.
10. **Populate known metadata in code:** Validator normalization overwrites card `title` and `score` fields from the input paper metadata; new schema fields should take an `arxivId` and populate metadata in code.
11. **Explicitly label unaudited text:** Quick summaries and full PDF reports are model-written and unaudited, so UI surfaces must not present them as claim-checked.
12. **Parseable suggestion rationales:** `suggest-profile.md` requires each rationale to cite papers by arXiv ID and quote user comments so that `resolveSuggestionOutcome` can track incorporated feedback.

The agent skill references prompt sections by exact heading (`"Style and voice"` and `"Sourcing discipline"` in `synthesis.md`, `"What counts as a hallucination"` and `"Output schema"` in `check-briefing.md`, the verdict rules in `rubric-filter.md`, and the score formula and calibration paragraph in `rubric-scoring.md` and `rubric-pdf.md`), all enforced by `tests/unit/skillParity.test.js`.

## UI conventions

- **Styling layers:** Design tokens live in `styles/tokens.css` (`var(--aparture-*)`), structural layout and mobile rules live in `styles/shell.css`, reading-surface rules scoped to `.briefing-prose` live in `styles/briefing.css`, and component-specific styling uses inline React `style={{...}}` objects.
- **No hardcoded palette or new Tailwind classes:** Use `className` for shell layout classes, `.briefing-prose` BEM classes, and Lucide icon sizing (`w-*`, `h-*`, `animate-spin`), and use inline styles with CSS custom properties for everything else.
- **Safe Markdown rendering:** Render model-written text as React elements through `components/briefing/MarkdownLite.jsx`, never via `dangerouslySetInnerHTML`.
- **Responsive rules:** Mobile layout styles live inside the `< 768px` media query in `shell.css` (`.shell-topbar`, `.shell-scrim`, `.shell-sidebar--open`, `.touch-target` at 40px minimum, and `.settings-field-row`).
- **View composition** (`components/shell/MainArea.jsx`): The pipeline view stacks stage results, the Download Report card, the reCAPTCHA and refusal summary cards, and the briefing preview card; the briefing view stacks `BriefingView`, `GenerationDetails`, `FeedbackPanel`, and `NotebookLMCard`.

**Semantic status colors** are hardcoded intentionally for fills, borders, tints, and status dots because they represent semantic state across themes. Because raw status hues fall below a 4.5:1 contrast ratio on light backgrounds, status-colored text and icons use the theme-aware `--aparture-{success,warning,danger,override,comment}-text` tokens (`--aparture-info-text` for blue), and text on a filled status badge uses `--aparture-on-status`. Keep UI text at `12px` or larger, dim secondary text with color tokens rather than opacity below `0.7`, and use muted tokens for informational markers such as `DuplicateBadge`.

<!-- prettier-ignore -->
| Value | Meaning |
| --- | --- |
| `#22c55e` | done, success, added, YES; positive score adjustment |
| `#f59e0b` | running, MAYBE, warning, test mode; star events |
| `#ef4444` | error, stop, NO, removed |
| `#f97316` | filter-override events; negative score adjustment |
| `#6366f1` | scoped-feedback events |
| `#a855f7` | paper-comment events; score badge accent |
| `#3b82f6` | informational, suggested source; general-comment and answer events |
| `#64748b` | dismissed, muted negative |
| `rgba(0,0,0,0.5)` | modal overlay scrim |

## Recipes

- **Adding a feedback type:** Extend the event union in `hooks/useFeedback.js`, add a rendering variant in `components/feedback/FeedbackItem.jsx` and a color in `eventMeta.js`, whitelist the type in `applyCap` (`lib/profile/feedbackCap.js`) and `renderFeedbackSection` (`lib/profile/suggestPrompt.js`), and specify its editability in `isEditableFeedback` and attribution rule in `resolveSuggestionOutcome`.
- **Adding an LLM provider:** Register the provider in `lib/llm/providers.js`, implement `lib/llm/structured/<provider>.js` (supporting `pdfBase64`, refusal detection in `parse*`, and token accounting), wire it into `callModel.js`, `validateSetup.js`, and `apiKeyShape.js`, and add unit tests under `tests/unit/llm/structured/`.
- **Adding a configuration key:** Add the default to `DEFAULT_CONFIG`, increment the config `version`, seed existing configurations in `migrateLegacyConfig` using `??` so user values survive, add integer keys to `INTEGER_CONFIG_KEYS`, expose the control in Settings, and update `docs/`.
- **Refreshing the model registry:** Update both tables in `utils/models.js`, add retired model IDs to `RETIRED_MODEL_REMAP` with a config version bump, verify `DEFAULT_CONFIG` and `DEFAULT_MODEL_ID`, and update model references across `docs/`.
- **Adding a mutable briefing field:** Whitelist the field in `MUTABLE_FIELDS`, add it to `HEAVY_FIELDS` if it should be stripped under `localStorage` quota pressure, and include it in `buildIndexEntry` if history search needs it.
- **Adding an LLM-backed test:** Use deterministic fixtures hashed by `lib/llm/hash.js` under `tests/fixtures/llm/<hash>.json`, generated via `tests/fixtures/synthesis/generate-sample.mjs` or the `beforeAll` pattern in existing integration tests.

## Writing conventions

- All user-facing prose (documentation, UI strings, and prompts) follows `POSITIONING.md` §9 and the Synergistic Prose Register.
- Code comments explain why a design choice or invariant holds, omitting temporary plan labels, dates, or references to gitignored scratch files.
- The term `"Phase 2"` refers exclusively to the planned Electron desktop packaging below (note that `resolveRouteAuth.js` uses `"Phase 1"` and `"Phase 2"` internally for its two authentication steps).
- Documentation headings never contain em-dashes because VitePress preserves them in URL slugs.
- `CLAUDE.md` is maintained by hand, and `next.config.mjs` sets `agentRules: false` so `next dev` does not append auto-generated blocks to this file.
- `docs/superpowers/` is gitignored and local-only; all required architectural and user documentation belongs in `CLAUDE.md` or `docs/`.

## Docs upkeep

`README.md` is a concise overview, while `docs/` is the comprehensive user guide. Whenever you change a default value, Settings label, model ID, configuration key, or user-visible error or log string, search `docs/` and `README.md` for the old value and update every occurrence. Consult the table below for code-to-documentation dependencies that a literal string search will not surface (paths are relative to `docs/` except for the agent skill row):

<!-- prettier-ignore -->
| Code | Pages to check |
| --- | --- |
| `utils/models.js`, model defaults | `concepts/model-selection.md`, `getting-started/api-keys*.md`, `using/tuning-the-pipeline.md` |
| `lib/analyzer/stages/*`, retry and rate-limit code | `concepts/pipeline.md`, `using/review-gates.md`, `using/tuning-the-pipeline.md`, `reference/troubleshooting.md` |
| `lib/arxiv/*`, the arXiv proxies | `concepts/arxiv-ingestion.md`, `concepts/pipeline.md`, `reference/troubleshooting.md`, `reference/environment.md`, `getting-started/install.md` |
| any `prompts/*.md` | `reference/prompts.md`; `synthesis.md` and `check-briefing.md` also `concepts/briefing-anatomy.md` |
| `lib/synthesis/*`, `briefingClient.js`, `components/briefing/*` | `concepts/briefing-anatomy.md`, `concepts/pipeline.md`, `using/reading-a-briefing.md` |
| `useFeedback.js`, `components/feedback/*` | `using/giving-feedback.md`, `using/feedback-in-practice.md` |
| `useProfile.js`, `components/profile/*`, `lib/profile/*` | `using/writing-a-profile.md`, `using/refining-over-time.md` |
| gate UIs, `components/run/*`, `components/score-review/*` | `using/review-gates.md` |
| Settings panel, dedupe | `using/tuning-the-pipeline.md` |
| `lib/notebooklm/*`, `components/notebooklm/*` | `add-ons/podcast.md` |
| persistence hooks and routes, auth, `process.env.*`, `package.json` scripts | `reference/environment.md`, `reference/troubleshooting.md`, `getting-started/install.md` |
| prompt sections the skill quotes, feedback and proposal rules, `lib/briefing/v2/*`, `bin/aparture.mjs` | the skill: `.claude/skills/aparture/SKILL.md` and `references/*.md` |

Screenshots live in `docs/public/screenshots/`, captured at `1440x900` in the light theme, and should be recaptured whenever the UI layout changes materially.

## Phase 2

Phase 2 is the planned desktop packaging as an Electron application with runtime state under `~/aparture/` (`reports/` via `APARTURE_REPORTS_DIR`, and `cache/` for the Playwright profile currently stored in `temp/`), API keys stored in the OS keychain and passed via the `apiKey` request field, a first-run setup wizard, a built-in daily scheduler, NotebookLM ZIP and HTML export, and native platform installers. This transition is supported by `APARTURE_REPORTS_DIR`, dual `apiKey`/`password` route authentication, and the stable `arxivAnalyzerState` storage key.
