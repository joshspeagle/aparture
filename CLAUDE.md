# CLAUDE.md

Guidance for coding agents working in this repository.

Aparture lets a researcher stop skimming the arXiv without worrying about what they're missing. Every design decision serves one of three requirements. The briefing must be worth reading: synthesis across papers, tuned by a profile the user wrote. It must be checkable: citations validated and claims audited before display. The user stays in control: profile edits are proposed, never silent; expensive steps are gated; everything runs locally on their keys.

Mechanically, it is a Next.js app running a staged arXiv pipeline over LLMs. Design principles with code pointers: `docs/concepts/design-principles.md`. Positioning: `POSITIONING.md`, whose §9 voice rules apply to all user-facing prose. User docs, built from `docs/`, are at [joshspeagle.github.io/aparture](https://joshspeagle.github.io/aparture/); check them for questions about behavior.

## Commands and checks

- `npm run dev | build | lint | test`; one file: `npx vitest run <path>`. `npm run format` checks formatting; `format:fix` writes it. Node 22 or newer. `dev` and `start` bind to 127.0.0.1 (`npm run dev -- -H 0.0.0.0` for the LAN).
- Docs: `cd docs && npm ci` once, then `npm run docs:dev` or `docs:build`. The build catches dead page links, not dead `#anchors`.
- **Vitest has two projects**, `node` and `jsdom`, chosen by include globs in `vitest.config.mjs`. A new test file must match a glob in exactly one project, or it silently never runs. A new top-level test directory needs its own glob in one project. A file under a node glob that needs `document`, `DOMParser`, or `localStorage` goes in `NODE_PROJECT_EXCEPTIONS`.
- `tests/setup.js` deletes the provider keys, `ARXIV_CONTACT_EMAIL`, and `APARTURE_REPORTS_DIR` so the suite stays hermetic; a test that needs one sets it.
- Hooks: pre-commit runs lint-staged (eslint and prettier); pre-push runs `eslint .` and `npm test`. CI (`.github/workflows/ci.yml`: pushes to main, PRs, weekly) runs lint, `npx prettier --check .`, `npm audit --omit=dev --audit-level=high`, `npm test`, and `npm run build` on Node 22 and 24, `npm test` again at UTC+14 (`TZ=Pacific/Kiritimati`) on Node 22, and a docs build. Briefing days are local calendar days, so run that leg locally after touching date code. Dependabot opens grouped weekly updates.
- `node scripts/smoke-llm-routes.mjs` calls every LLM route in-process on all three providers. **It bills the user.** Needs `.env.local` keys; flags are in its header. `scripts/probe-arxiv*.mjs` hit arXiv live: by hand only.

## Invariants

Breaking one of these produces wrong output, an unexpected bill, or lost data.

1. **One LLM dispatcher.** Every model call goes through `lib/llm/callModel.js`. The only direct provider calls are the free probes in `lib/llm/validateSetup.js`.
2. **Cache split.** Routes split each prompt into a stable `cachePrefix` (the template, usually with the profile) and a variable `prompt`; `cachePrefix + prompt` must equal the full rendered prompt byte for byte. `useCaching = provider === 'anthropic' && !isFixture && !promptOverride`. Routes using `loadRubricPrompt` pass `cachePrefix`/`cacheable` as explicit keys (`''`/`false` when off); briefing-style routes spread `...(useCaching ? { cachePrefix, cacheable: true } : {})`. Don't mix the styles: fixtures don't transfer.
3. **Structured-output portability rules.** Route schemas stay in the subset all three providers accept; validators enforce counts, ranges, and lengths server-side.
   - Every object has `additionalProperties: false` (Anthropic and OpenAI require it; `sanitizeSchemaForGoogle` strips it).
   - Every property is in `required`; optional fields use `["T", "null"]`, which the Google sanitizer turns into `nullable: true`.
   - The top level is `type: 'object'`; wrap arrays, as in `{ items: [...] }`.
   - No `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `multipleOf`, `oneOf`, `allOf`, `anyOf`.
4. **Prompts don't restate the shape.** A prompt says what fields mean; the route's schema carries the shape. A prompt must never describe a JSON shape that contradicts its route's schema.
5. **Refusals** arrive as successful HTTP responses. The adapter's `parse*` throws `RefusalError`, the route answers 422 with `code: 'CONTENT_REFUSAL'`, `parseRouteError` throws `ContentRefusalError`, and the stage applies `config.refusalPolicy`.
   - Refusals never enter the retry ladder: they are deterministic, and each attempt bills input tokens.
   - 422 is shared with `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA`; `code` discriminates. `analyzePDFs.js` reads the body inline because it can be read only once.
   - Google's `MAX_TOKENS` is truncation, not a refusal; only `GOOGLE_REFUSAL_FINISH_REASONS` count, detected outside the `expectStructured` branch.
   - Under `fail`, the stage throws `RefusalHaltError` (`fatal: true`), which stops the worker pool and ends the run with a message naming the stage, provider, and policy.
6. **Bill the model that ran.** Each stage's `makeAPICall(prompt, isCorrection, modelOverride)` resolves `const effectiveModel = modelOverride ?? config.<slot>Model` and uses it for both the request body and `recordUsage`.
7. **One run, one signal.** `startProcessing` gives each run an id and its own `AbortController`, captures the signal once, and passes it to every stage, pool, fetch, sleep, and gate (`lib/abort.js`). Never re-read `abortControllerRef` mid-run: after Stop then Start it holds the next run's signal. A superseded run skips its end-of-run writes. `callModel` takes no signal, so a request already sent finishes and bills.
8. **Stages read state at call time:** `store()` and `store().reactContext` inside the returned function, never in the factory closure.
9. **Fixture mode is test-only.** Client-supplied fixture mode is honored only under `NODE_ENV === 'test'` (`lib/llm/resolveCallModelMode.js`), as is `_testPdfBase64`. The suite makes no live LLM calls.
10. **arXiv hygiene** (`lib/arxiv/`):
    - OAI-PMH uses `arXivRaw` and anchors `published` on the v1 date; the `arXiv` format's `<created>` leaks re-announced papers into submitted-only windows.
    - No `sortBy`/`sortOrder` in Atom URLs; sort after merging.
    - API requests are 3–5 s apart with jitter (`arxivSpacingMs`), never before the first. Pages and files on arxiv.org, including the server's PDF downloads, are 15 s apart (`ARXIV_PAGE_DELAY_MS`, from robots.txt); a Playwright fallback takes two slots.
    - The proxies rewrite upstream 5xx to the 429 shape so one retry ladder handles both.
11. **Dedupe** (`hooks/useSeenPapers.js`, `lib/analyzer/applyDedupe.js`). `applyDedupe` runs in `fetchPapers` after `harvest()` (fill-ups included), before any LLM call. The index is fed on briefing save, not session save, so aborted runs can't poison it. `_`-prefixed keys are metadata; bump `CURRENT_DEDUPE_VERSION` when migration semantics change; keep the hot index `{arxivId → YYYY-MM-DD}`. Briefing cards come from synthesis output, so `components/briefing/PaperCard.jsx` derives the duplicate flag from the index, as any new surface downstream of synthesis must.
12. **Persistence.** The hot session key `arxivAnalyzerState` keeps its name: renaming it strands every saved session unless a migration moves them. Cold briefing files are removed only by an explicit delete, never by retention.
13. **Registry discipline.** Update `MODEL_REGISTRY` and `AVAILABLE_MODELS` (`utils/models.js`) together. A removed ID goes into `RETIRED_MODEL_REMAP` (`hooks/useAnalyzerPersistence.js`) with a config version bump; remap targets must be registered (a test asserts it).
14. **Browser profile.** Never delete `temp/playwright-profile/`: it holds the arXiv reCAPTCHA state the PDF fallback relies on.

## Architecture

### Map

- `pages/api/`: one route per LLM step (`quick-filter`, `score-abstracts`, `rescore-abstracts`, `analyze-pdf`, `analyze-pdf-quick`, `synthesize`, `check-briefing`, `editor-questions`, `suggest-profile`, `generate-notebooklm`), the arXiv proxies (`harvest-arxiv` for OAI-PMH, `fetch-arxiv` for Atom), persistence (`briefings/*`, `sessions/*`), and `validate-setup` (free probes).
- `components/shell/App.jsx` owns the hooks, the pipeline, and the layout. It publishes hook-owned values (profile, config, currentBriefing, feedback, saveBriefing, briefingHistory, seenPapersIndex, seenPapersReady) into the `reactContext` slice of the Zustand store (`stores/analyzerStore.js`), which the pipeline reads through `getState()`.
- `hooks/`: localStorage-backed state. `useAnalyzerPersistence` holds `DEFAULT_CONFIG`, config migrations, and session persistence.
- `lib/analyzer/` (pipeline), `lib/llm/` (dispatcher, adapters, route auth, typed errors, fixtures, token budget), `lib/arxiv/`, `lib/figures/` (key-figure crop and store), `lib/synthesis/` (briefing schema, checks, repair, audit corpus, reader notes), `lib/profile/` (feedback status, suggestion outcome, suggest prompt, templates).
- `bin/`, `lib/headless/`, `lib/briefing/v2/`, `.claude/skills/aparture/`: the headless runner and agent skill.
- `audits/`: point-in-time audit reports kept as provenance; they describe the state before the fixes that followed.
- `reports/`, `temp/`: gitignored runtime state, resolved from `process.cwd()`, so they stay at the repo root.

### Pipeline

`App.jsx` creates the pipeline once: `useState(() => createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef }))`. `lib/analyzer/pipeline.js` builds the helpers in `stages/core.js` (`recordUsage`, `waitForResume`, `makeRobustAPICall`) once and passes one `deps` object to every stage factory in `lib/analyzer/stages/`. `startProcessing` drives the stages, passes each the run's `{ signal }`, and returns a `RUN_OUTCOME` (`ignored`, `aborted`, `superseded`, `finished`) that callers branch on. Stage behavior: `docs/concepts/pipeline.md`.

To add a stage: export `create<Stage>(deps)` from `lib/analyzer/stages/<stage>.js`, instantiate it in `createAnalysisPipeline` before `createStartProcessing`, call it from `startProcessing.js` with the run's signal, and add any new hook value to the `reactContext` publish. A pure in-memory transform is a helper inside an existing stage (`applyDedupe` is the model). To test a stage, set state with `useAnalyzerStore.setState(...)` and drive `startProcessing` with mocked API responses.

- **Concurrency.** Stages 2–4 run through `AnalysisWorkerPool` (`lib/analyzer/rateLimit.js`; default 3, clamped 1–20; dry runs 1). A task error is logged and dropped, so workers record their own failures; an abort or a `fatal` error stops the pool and `run()` rejects with it. On Anthropic slots, `cacheWarmup` runs worker 0's first task alone so the rest read the prompt cache. The refusal-fallback leg fires mid-task, so it uses `CacheWarmupGate` instead; the class comment explains why both exist.
- **Retries.** `parseRouteError` (`lib/analyzer/RateLimitError.js`) turns 429, 503, and 529 into `RateLimitError`: `makeRobustAPICall` waits for `Retry-After` up to 60 s, else backs off up to 30 s, and `getLLMBarrier(provider)` pauses every worker for that provider. 400, 401, 403, 404, 413, and a 422 without a sentinel `code` become `NonRetryableRouteError` and fail on the first attempt. Other errors are retried up to `config.maxRetries` times.
- **Review gates.** `startProcessing.js` pauses at `filter-review` (`pauseAfterFilter`), `score-review` (`pauseBeforeDeepAnalysis`), and `pre-briefing-review` (`pauseBeforeBriefing`). Each gate renders `<ReviewGateBanner>` (`components/run/`) at the head of its section (`FilterResultsList`, `ScoreReviewSurface`, `PreBriefingGate`); `ProgressTimeline` hosts no gate controls. The PDF set is `(top maxDeepAnalysis) ∪ starred − dismissed` (`resolveAdditiveSet.js`).
- **Briefing.** `lib/analyzer/briefingClient.js` runs quick summaries, `/api/synthesize`, `/api/check-briefing`, an optional retry, and `/api/editor-questions`, then saves through `useBriefing` after checking the run's signal. A claims check that fails to run is retried once, then the briefing is saved unaudited with `generationMetadata.hallucinationCheckError`; never let an unaudited briefing look checked. Editor's questions are non-fatal, and `lib/editorQuestions/questions.js` keeps only well-formed questions citing an ID the model saw. Quick summaries are reader-facing only; neither synthesis nor the audit gets them. The day's Gate 3 notes (general comments with `origin: 'pre-briefing'`) reach synthesize as `readerNotes`, appended after the rendered prompt (`lib/synthesis/readerNotes.js`).
- **Briefing checks** (`lib/synthesis/validator.js`, deterministic): `normalizeBriefing` corrects card titles and scores from the input; `validateBriefing` rejects unknown IDs (cards, themes, prose) and missing, duplicate, or unthemed cards; failures get one LLM repair (`repair.js`), then `salvageBriefing`. The full list is in `docs/concepts/briefing-anatomy.md`. The app doesn't display `corrections` or salvage actions yet.
- **Audit corpus.** `/api/check-briefing` renders papers with `lib/synthesis/checkCorpus.js`, untruncated. The audit must see what the writer saw: change `mapFinalRankingToBriefingPapers`, `callCheckBriefing`, and `checkCorpus.js` together.

### Model slots

Config keys: `filterModel`, `scoringModel`, `postProcessingModel`, `pdfModel`, `briefingModel` (synthesize, check-briefing, editor-questions, suggest-profile), `quickSummaryModel`, `refusalFallbackModel`. `notebookLMModel` lives in the store's `notebookLM` slice. Defaults live only in `DEFAULT_CONFIG`. `postProcessingModel` is the Review Model under Enable Post-Processing (Scoring options) and doesn't follow `scoringModel`.

### Auth pattern

- LLM routes and `validate-setup` accept `apiKey` (bring your own key; the Phase 2 path) or `password`, checked against `ACCESS_PASSWORD` and swapped for the provider's env key. They share `lib/llm/resolveRouteAuth.js`: `checkRoutePassword` checks the password alone; `resolveRouteAuth` runs the full ladder (password, env key, call mode, fixture-aware credential check).
- A route that does local work before its LLM call authenticates first: `analyze-pdf` requires the password, or a key with the provider's published shape (`lib/auth/apiKeyShape.js`), before any download or browser launch.
- The arXiv proxies take `password` in the body. The persistence routes take it in the body on POST and PATCH and in the percent-encoded `x-aparture-password` header on GET and DELETE (`lib/auth/passwordHeader.js`).
- `checkAccessPassword` fails closed when `ACCESS_PASSWORD` is unset and compares in constant time.

### Persistence

Hot state in localStorage, cold state on disk; both write through `safeSetItem` (`lib/persistence/safeStorage.js`).

- **Briefings.** Hot: `aparture-briefing-current` and the newest-first `aparture-briefing-index`, which keeps `filterBriefings` synchronous. Cold: `reports/briefings/<id>.json` through `/api/briefings[/:id]`, loaded by `useBriefing.loadBriefing(id)`. The index has no entry cap; it is trimmed to `HOT_INDEX_BUDGET_CHARS`, test runs first (`testRun`, set by `buildIndexEntry`), and trimmed briefings stay on disk. Extension points: `MUTABLE_FIELDS` (`pages/api/briefings/[id].js`), `HEAVY_FIELDS` (`hooks/useBriefing.js`), `buildIndexEntry`.
- **Sessions.** Hot: `arxivAnalyzerState` (`lib/session/buildHotEntry.js`, under about 600 KB, with the top-30 `finalRanking`). Cold: `reports/sessions/<sessionId>.json` through `/api/sessions[/:id]`.
- **Key figures.** `/api/analyze-pdf` crops the figure the full read names from the PDF it already holds (`lib/figures/cropFigure.js`: pdf.js plus `@napi-rs/canvas`, both in `serverExternalPackages`) and writes `reports/figures/<arxivId>.png` and `.json`; `/api/figures/[id]` serves it behind the password header. The model picks only the label; the caption shown is the PDF's text. A failed crop leaves the analysis intact. Briefings record `figuresById` (a heavy field). The runner's `figure` command and `render` use the same crop for PDF-only papers.
- `APARTURE_REPORTS_DIR` replaces the `reports/` base for all three; it is the Phase 2 seam. `saveBriefingAndSwitch` in `App.jsx` feeds `useSeenPapers.recordRun` after `saveBriefing` resolves (IDs from `lib/seenPapers/papersFromBriefing.js`).

### Profile and feedback

- Every stage reads `useProfile().content`, through `profileWithNotes(content, notes, scope)` (`lib/profile/editorialNotes.js`), which appends that scope's editorial notes after the profile and returns the profile byte for byte when there are none. Scopes: `selection` (filter, scoring, rescoring, PDF), `writing` (synthesize, editor-questions), `podcast` (the focus prompt only); check-briefing gets none. Notes live on the working slot, each snapshot, and each revision (`notes` beside `content`), change only through `updateNotes` or an accepted suggestion (`noteChanges` from `/api/suggest-profile`, checked by `validateNoteChanges`), and cap at 12 per scope. The skill keeps them in `learned.md` in the same format; `node bin/aparture.mjs notes` reads it.
- The working slot `aparture-profile` keeps its key; named profiles are snapshots in `aparture-profiles` with an `aparture-active-profile` pointer, and every committed change writes through to the active snapshot. `BLANK_PROFILE_TEMPLATE` is also `DEFAULT_CONFIG.scoringCriteria`, so fresh installs ship a neutral template, never a personal profile.
- `useFeedback` has seven event types: `star` and `dismiss` (latest wins), `paper-comment` and `general-comment` (append-only), `filter-override` (latest wins per paper and run day, recorded on the pill click, including after a run), `scoped-feedback` (latest wins per scope and briefing date), and `answer` (an editor's-question reply; latest wins per question and day, and re-tapping takes it back). Events may carry `testMode`, `incorporatedAt`, `editedAt`, and `origin`.
- `lib/profile/feedbackStatus.js` decides status: `test` (made during a Dry Run or Minimal Test; never sent to suggestions or a real briefing), `pending`, or `incorporated`. An edited event is pending again.
- `resolveSuggestionOutcome` (`lib/profile/suggestOutcome.js`) marks an event incorporated only when an accepted change's rationale cites its arXiv ID or title, or quotes its text; reverting a revision reopens those events (`reopenIncorporatedSince`).
- `/api/suggest-profile` gets the ticked pending events through `applyCap` (`lib/profile/feedbackCap.js`), which caps only comments and drops any type it doesn't list. Answers get their own "ANSWERS TO THE EDITOR'S QUESTIONS" section. The 10 newest of `useProfile`'s `rejectedSuggestions` ride along as `rejected-suggestion` items, rendered by `suggestPrompt.js` as a "PREVIOUSLY REJECTED SUGGESTIONS" section.

### LLM adapters

`lib/llm/structured/{anthropic,google,openai}.js` shape requests and parse responses. All three accept `pdfBase64`; only Anthropic uses `cacheable`/`cachePrefix`.

- **Anthropic.** Structured output goes in `output_config.format` (`{type: 'json_schema', schema}`): no tools, no `tool_choice`, valid with thinking on or off. The parser reads JSON from the text block, skips `thinking` blocks, and still accepts `tool_use` blocks from older fixtures. The cacheable prefix is its own text block with `cache_control: {type: 'ephemeral'}`; `callModel` logs `[anthropic cache] read=N create=N`.
- **Google.** The key goes in the `x-goog-api-key` header, never the URL. `thoughtsTokenCount` counts as output, as Google bills it. `sanitizeSchemaForGoogle` adapts schemas for `responseSchema`. Aparture creates no Google cache objects.
- **OpenAI.** Text calls use Chat Completions with a strict `response_format` schema. PDF calls use `/v1/responses` (`buildOpenAIResponsesRequest`); the parser takes the `phase: 'final_answer'` message, else the last one.

### arXiv ingestion

`fetchPapers` wraps `ingest.harvest`; the user-facing model is in `docs/concepts/arxiv-ingestion.md`.

- `config.arxivIngestion`: `auto` (OAI-PMH, with a per-run circuit breaker to Atom on the first hard failure), `oai-only`, `atom-only`. OAI and Atom have separate arXiv rate-limit buckets.
- `daysBack` means N days of content. For `submitted-only`, the OAI window widens backward by `ANNOUNCE_LAG_BUFFER_DAYS` (7) and `harvest` anchors on the newest v1 day with content. The constant and window math live in both `stages/fetchPapers.js` and `lib/arxiv/window.js`; change both.
- The cache (`lib/arxiv/cache.js`) keys on set, from, until, and mode, plus window semantics for fill-ups. `lib/arxiv/sets.js` derives OAI sets from prefix rules, not from `utils/arxivCategories.js`, so a new category may need both.
- `harvest` and `harvestOai` take injectable `spacingMsImpl`/`sleepImpl`; multi-request tests pass a no-op sleep.
- `analyze-pdf` checks fetched bytes for `%PDF-` and falls back to Playwright (`temp/playwright-profile/`). Without Playwright it returns 422 `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA`, and the stage records the paper in `skippedDueToRecaptcha`.

### Headless runner and agent skill (prototype)

`bin/aparture.mjs` runs a briefing's mechanical steps from Node without the web app: `fetch`, `enrich`, `validate`, `render`, `record`, `ingest`, `figure` (`node bin/aparture.mjs help`). It makes no LLM calls. The skill in `.claude/skills/aparture/` does the reading and writing and calls the runner between steps; `.agents/skills/aparture` is a symlink to it, for agents that look there; edit the files under `.claude/`. No user docs yet.

- stdout is JSON only: the runner sends `console.log` to stderr because route handlers log. Keep new output off stdout.
- It calls the arXiv proxy handlers in-process (`lib/headless/inProcessRoute.js`), installs jsdom's `DOMParser` (a devDependency, so it needs a full `npm ci`), and sets a random `ACCESS_PASSWORD` when none is set.
- Requests to arxiv.org pages and files are 15 s apart (`arxivPageSpacingMs`); `--spacing-ms` is for tests.
- Skill state lives in `$APARTURE_STATE` (default `./aparture-state`), separate from the web app's storage. Skill briefings use `lib/briefing/v2/` (schema, a grounding validator for cited IDs and verbatim quotes, renderer), not `lib/synthesis/schema.js`.
- **Keeping the skill in step is part of maintenance.** The app and the skill share prompts, arXiv code, and the briefing's rules. A change to what a briefing contains, how feedback turns into proposals, a prompt section the skill quotes, or a runner command or flag updates `.claude/skills/aparture/` in the same PR, or the PR says why the two should differ. New mechanics go in `lib/`, where the runner can call them in-process, not in skill prose or a component. `tests/unit/skillParity.test.js` checks the names the skill relies on: prompt headings and restated rules, runner commands and flags, and reference files.

## Model information

`utils/models.js` is the source of truth; don't copy model IDs or prices into code or this file. The registry keeps each provider's current and previous generation.

- **Pricing.** `inputPerMTok`/`outputPerMTok` are USD list prices; an optional `promo` block with an end date applies through `effectivePricing`. `null` means unverified, and `lib/analyzer/costEstimate.js` hides that estimate rather than guess.
- **Adaptive thinking.** Every Anthropic entry has `supportsAdaptiveThinking` (read by `supportsAdaptiveThinkingByApiId`); when true the request gets `thinking: {type: 'adaptive'}`. `output_config.effort` is sent only with thinking on, and no route sets it. For unregistered IDs the adapter falls back on the name: Fable and Mythos on, Haiku 5+ on, Opus and Sonnet 4.6+ on, everything else off. Register new Anthropic models with the flag.
- **Output budget.** Anthropic calls default to `maxTokens` 16000, since thinking counts toward it; a structured reply cut off at `max_tokens` throws a named error, not a JSON parse error.
- **Data retention.** Some Anthropic models 400 on every request unless the organization keeps data 30 days; their registry comments say which.
- **Token pre-flight.** `lib/llm/tokenBudget.js` assumes about 4 characters per token for every provider; `/api/synthesize` blocks over-threshold prompts unless `allowOverBudget` is set.

## Prompts

`prompts/*.md` are read at request time; `synthesis.md` has the most effect on briefing quality. The four `rubric-*.md` files contain `{{CACHE_BOUNDARY}}`, where `lib/llm/loadRubricPrompt.js` splits the cacheable prefix from the per-batch tail. Test overrides (`APARTURE_TEST_*`, `_testPdfBase64`) are listed in `docs/reference/environment.md`; prompt overrides also disable caching so fixture hashes are stable.

**Harmony rules** for editing any prompt:

1. **Label the profile "Research profile:"** in every rubric (and in `editor-questions.md`) and call it the research profile: the user's voice, not a constraint document.
2. **Quality strictness is profile-aware.** `rubric-scoring.md`, `rubric-pdf.md`, and `rubric-rescoring.md` each have a "Calibrate Quality strictness to the profile" paragraph. Keep its breadth-versus-selectivity escape hatch, or breadth profiles get downgraded silently.
3. **One claims standard for writer and auditor.** A factual claim about a paper (a number, a named method or dataset, a comparative result, an attribution) needs support in that paper's abstract or full report; cross-paper synthesis in `executiveSummary` and `themes[].argument` is legitimate unless it contradicts a source. `synthesis.md` ("Sourcing discipline") and `check-briefing.md` ("What counts as a hallucination") state it identically; change them together.
4. **The filter is permissive.** A paper that survived as MAYBE should score 3–5 on Alignment, not 6–7 (`rubric-scoring.md`).
5. **Demonstrate, don't promote.** "novel", "breakthrough", and "paradigm-shift" are the named banned words in `synthesis.md`, `analyze-pdf-quick.md`, `rubric-pdf.md`, `notebooklm-discussion-guide.md`, and the skill's `references/briefing.md`; change all five or none.
6. **The podcast follows the briefing.** `notebooklm-discussion-guide.md` keeps the paper the briefing puts first in a theme even below the score cutoff.
7. **Caveats are content.** Report a paper's stated limitations as facts; ban only hedging about the model's own certainty.
8. **Describe meaning, not shape:** no example JSON, no "respond only with" lines.
9. **No shouting.** Current models over-apply emphasized rules. State each constraint once, with its reason.
10. **Don't ask the model for what code holds.** Cards still carry `title` and `score`, which the validator overwrites; new fields should take an `arxivId` and let code fill the rest.
11. **Don't present unaudited text as checked.** Quick summaries and full reports are model-written and unaudited.
12. **Suggest rationales are parsed.** `suggest-profile.md` must keep asking each rationale to name papers by arXiv ID and quote the comments it used; incorporation tracking reads them.

The agent skill reads prompts by heading: "Style and voice" and "Sourcing discipline" in `synthesis.md`; "What counts as a hallucination" and "Output schema" in `check-briefing.md`; the verdict rules in `rubric-filter.md`; the score formula and calibration paragraph in `rubric-scoring.md` and `rubric-pdf.md`. Renaming them breaks the skill; `tests/unit/skillParity.test.js` fails first.

## UI conventions

- Styling layers: tokens in `styles/tokens.css`, consumed as `var(--aparture-*)`; structural classes and the mobile rules in `styles/shell.css`; reading-surface rules scoped to `.briefing-prose` in `styles/briefing.css`; everything else inline in the component.
- Never hardcode the palette. Use `className` for shell layout, briefing-prose BEM, and Lucide sizing (`w-*`, `h-*`, `animate-spin`); inline `style={{...}}` for the rest. Don't add Tailwind classes.
- Render model-written text as React elements, never through `dangerouslySetInnerHTML`; `components/briefing/MarkdownLite.jsx` handles the Markdown in reports.
- Mobile rules live only inside the under-768px media query in `shell.css`: the off-canvas drawer (`.shell-topbar`, `.shell-scrim`, `.shell-sidebar--open`), `.touch-target` (40px minimum), `.settings-field-row`.
- `components/shell/MainArea.jsx`: the pipeline view stacks results, Download Report, the reCAPTCHA and refusal cards, and the briefing card; the briefing view stacks `BriefingView`, `GenerationDetails`, `FeedbackPanel`, and `NotebookLMCard`. Put a new card in the view it belongs to.

**Semantic status colors** are hardcoded by design for fills, borders, tints, and dots: they mark status and aren't palette. Add new ones here, not as tokens. As text or icons the raw hues fall under 4.5:1 on the light surfaces, so status-coloured text uses the theme-aware `--aparture-{success,warning,danger,override,comment}-text` tokens (`--aparture-info-text` for blue), and text on a filled hue uses `--aparture-on-status`. Keep UI text at 12px or larger, and dim with colour rather than opacity below 0.7. Informational markers such as `DuplicateBadge` use muted tokens.

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

- **New feedback type.** Extend the union in `hooks/useFeedback.js`; add a variant in `components/feedback/FeedbackItem.jsx` and a color in `eventMeta.js`; add it to `applyCap` in `lib/profile/feedbackCap.js` (unknown types are silently dropped there) and a section in `renderFeedbackSection` (`lib/profile/suggestPrompt.js`); decide whether `isEditableFeedback` allows edits and how `resolveSuggestionOutcome` attributes it.
- **New LLM provider.** Add it to `lib/llm/providers.js`; write `lib/llm/structured/<provider>.js` like the others (`pdfBase64`, refusal detection in `parse*`, token counts); add a branch in `callModel.js`, a probe in `validateSetup.js`, a key shape in `apiKeyShape.js`, and tests in `tests/unit/llm/structured/`.
- **New config key.** Add it to `DEFAULT_CONFIG`, bump `version`, and seed existing configs in `migrateLegacyConfig` (with `??`, so explicit values survive). Integer keys go in `INTEGER_CONFIG_KEYS`. Add the Settings control and grep `docs/`.
- **Registry refresh.** Edit both registry tables; move removed IDs into `RETIRED_MODEL_REMAP` with a version bump; check `DEFAULT_CONFIG` and `DEFAULT_MODEL_ID`; grep `docs/`, where model IDs appear on many pages.
- **New mutable briefing field.** Whitelist it in `MUTABLE_FIELDS`; add it to `HEAVY_FIELDS` if quota pressure may strip it, and to `buildIndexEntry` if search needs it.
- **New LLM-backed test.** Use fixtures: `lib/llm/hash.js` hashes the input, responses live at `tests/fixtures/llm/<hash>.json`, and `tests/fixtures/synthesis/generate-sample.mjs` or the `beforeAll` pattern in existing integration tests creates them. Vitest worker timeouts under WSL are infrastructure flakes; trust the final count.

## Writing conventions

- User-facing prose (docs, UI strings, prompts) follows `POSITIONING.md` §9.
- Comments explain why. No plan labels ("Phase B", "Task 4b"), dates, provenance ("introduced", "verified live"), or pointers to gitignored specs.
- "Phase 2" means only the desktop packaging below. (`resolveRouteAuth.js` calls its two steps "Phase 1" and "Phase 2"; don't extend that.)
- Docs headings avoid em-dashes: VitePress keeps them in slugs, which breaks links to the heading.
- CLAUDE.md is curated by hand. `next.config.mjs` sets `agentRules: false` so `next dev` doesn't append its own agent-rules block here; keep it.
- `docs/superpowers/` is gitignored and local-only. Never treat it as required reading; anything load-bearing goes here or in `docs/`.

## Docs upkeep

The README is thin; `docs/` is the source of truth. After changing a default, Settings label, model ID, config key, or user-visible error or log string, grep `docs/` and `README.md` for the old value and fix every hit. Skip docs for internal refactors, hidden-behavior fixes, and tests. The doc-trigger table lists the mappings a grep won't find. Pages are under `docs/`, except in the skill's row:

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
| `lib/notebooklm/*` | `add-ons/podcast.md` |
| persistence hooks and routes, auth, `process.env.*`, `package.json` scripts | `reference/environment.md`, `reference/troubleshooting.md`, `getting-started/install.md` |
| prompt sections the skill quotes, feedback and proposal rules, `lib/briefing/v2/*`, `bin/aparture.mjs` | the skill: `.claude/skills/aparture/SKILL.md` and `references/*.md` |

Screenshots live in `docs/public/screenshots/`, captured at 1440×900 in the light theme; retake them when the UI changes materially.

## Phase 2

Phase 2 is the planned desktop packaging: an Electron app with state under `~/aparture/` (`reports/` through `APARTURE_REPORTS_DIR`, and `cache/` for the Playwright profile now in `temp/`), API keys in the OS keychain sent through the `apiKey` route path, a first-run wizard, a daily scheduler, NotebookLM ZIP and HTML export, and installers. Until then the code keeps three seams: `APARTURE_REPORTS_DIR`, dual `apiKey`/`password` auth, and the frozen `arxivAnalyzerState` key.
