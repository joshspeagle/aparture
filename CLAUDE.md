# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aparture's job is to let a researcher stop skimming the arXiv without worrying about what they're missing. Every design decision serves one of three requirements that job imposes: the briefing must be worth reading (synthesis across papers, tuned by a profile the user wrote), it must be checkable (citations validated, claims audited, before display), and the user must stay in control (edits to the profile are proposed, never silent; expensive steps are gated; everything runs locally on their keys). The profile works like memory: it accumulates what the tool learns about the researcher over time, in a form the researcher can read, edit, and carry forward.

Mechanically, it is a Next.js web app running a multi-stage arXiv discovery + analysis pipeline over LLMs. Design principles with code pointers: `docs/concepts/design-principles.md`. Positioning, market landscape, and business case: `POSITIONING.md`.

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

- **State:** Zustand (`stores/analyzerStore.js`) — central store replacing ~28 useState calls; 11 slices incl. `reactContext`. Pipeline reads via `getState()`. React hooks (`useProfile`, `useBriefing`, `useFeedback`) wrap localStorage persistence.
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
- `lib/profile/` — profile utilities (migrations, diff, feedbackCap, suggestPrompt, starterTemplates). `starterTemplates.js` owns the four first-run templates AND `BLANK_PROFILE_TEMPLATE`, which is also `DEFAULT_CONFIG.scoringCriteria` — fresh installs ship the neutral bracketed template, never a personal profile.
- `hooks/` — React hooks, all localStorage-backed. `useProfile.content` is read by every pipeline stage; `useProfile` also owns named profiles (`aparture-profiles` map + `aparture-active-profile` pointer) — snapshots you `saveAs`/`switchTo`/`renameProfile`/`deleteProfile`, while the single working slot (`aparture-profile`) keeps its key and read path unchanged for pipeline/CLI compat. `useBriefing` has a 90-day rolling window, ID-keyed entries. `useFeedback` has 6 event types (`star`, `dismiss`, `paper-comment`, `general-comment`, `filter-override`, `scoped-feedback`); star/dismiss are latest-wins, comments append-only, `scoped-feedback` is latest-wins per scope-dedupe key (scope + briefingDate) with three scopes: `bucket`, `score-review`, `run`.
- `prompts/` — editable LLM prompt templates (changes live without rebuild). The four `rubric-*.md` files contain a `{{CACHE_BOUNDARY}}` marker that `lib/llm/loadRubricPrompt.js` uses to split each into a cache-stable prefix (rubric + profile) and a variable tail (per-batch papers) for Anthropic caching.
- `utils/models.js` — **single source of truth for model IDs/names/capabilities** (`MODEL_REGISTRY` + `AVAILABLE_MODELS` — always update together)
- `styles/` — `tokens.css`, `shell.css`, `briefing.css` (see "Styling conventions")
- `tests/fixtures/llm/` — cached LLM responses keyed by input hash
- `cli/` — CLI browser automation **(scheduled for deletion in Phase 2)**
- `reports/`, `temp/` — **runtime state** (gitignored; see below)

### Runtime state directories

`reports/` and `temp/` are gitignored but pinned to the repo root because API routes resolve them via `process.cwd()`. **Do NOT delete** `temp/playwright-profile/` (arXiv reCAPTCHA bypass state) or `temp/notebooklm-profile/` (Google session cookies) unless willing to re-auth. Phase 2 migrates both to `~/aparture/{reports,cache}/`.

### API Integration

Each file in `pages/api/` owns one pipeline stage — read the file for its purpose. Exception: `validate-setup.js` is a non-LLM probe route — free pre-flight validation of keys/model IDs/request syntax via provider count-tokens (Anthropic, Google) and model-GET (OpenAI) endpoints (`lib/llm/validateSetup.js`, deliberately not routed through `callModel`). Two cross-cutting patterns:

**Auth pattern.** All routes accept EITHER `apiKey` (for future BYOK flows) OR `password` validated against `process.env.ACCESS_PASSWORD`. When `password` is provided, the route reads the env-var key for the resolved provider (`CLAUDE_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENAI_API_KEY`). LLM routes share `lib/llm/resolveRouteAuth.js` — a two-phase helper (`checkRoutePassword` password gate, `resolveRouteAuth` full ladder incl. callMode + fixture-aware credential check) with per-route error-message overrides. Web UI uses the password path; Phase 2 Electron will use the apiKey path from OS keychain.

**Model slot separation.** Config has distinct `briefingModel` (drives `/api/synthesize` + `/api/suggest-profile`), `pdfModel` (drives `/api/analyze-pdf`), `filterModel`, `scoringModel`, `quickSummaryModel`, `notebookLMModel`. All default to the same model on first run; tunable independently.

## Development Notes

### Environment Variables

See `docs/reference/environment.md` (authoritative). Minimum: `ACCESS_PASSWORD` + one provider key (`CLAUDE_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`).

### Analysis Workflow

Pipeline stages follow `docs/concepts/pipeline.md` (Stage 1 fetch → Stage 5 briefing, with Stage 3.5 post-processing). Beyond that doc:

- **Filter-override pill (Stage 2).** UI click-cycles YES/MAYBE/NO; each override becomes a `filter-override` feedback event that flows into the suggest-profile prompt as a "too narrow/broad" signal.
- **Batch parallelism.** Stages 2/3/3.5/4 each have a concurrency knob (`filterConcurrency`, `scoringConcurrency`, `postProcessingConcurrency`, `pdfAnalysisConcurrency`, default 3, clamped 1–20), all routed through `AnalysisWorkerPool` in `lib/analyzer/rateLimit.js`. Anthropic model slots get a single-flight cache-warmup barrier (worker 0 primes the ephemeral cache entry before siblings start). Dry-run forces concurrency=1. Stage 4 also serializes arXiv downloads server-side at ~5s spacing.
- **Score-review gate (Gate 2).** `pauseBeforeDeepAnalysis: true` (default) fires after Stage 3.5 and before Stage 4. Shows scored papers in three groups (top-N, borderline, low score); ★ guarantees PDF analysis regardless of rank, X (dismiss) excludes from PDF set. Final PDF set = `(top-N) ∪ {starred} − {excluded}`. Free-text "feedback on this scoring round" field flows into suggest-profile as a `scoped-feedback` `score-review`-scope note. A "Skip remaining gates this run" link appears on all three gates; it bypasses subsequent default-on gates for this run only without modifying settings.
- **Review-gate placement.** All three gates render the shared `<ReviewGateBanner>` (`components/run/`) — one-line summary + Continue button + "Skip remaining gates this run" link — at the _head of their associated section_: filter → `FilterResultsList`, score → `ScoreReviewSurface`, pre-briefing → `PreBriefingGate` (`components/shell/`, mounted by `MainArea` only at stage `'pre-briefing-review'`). `ProgressTimeline` is pure status display and hosts **no** gate controls. The banner also carries a muted "docs ↗" link to the review-gates docs page. While the stage ends in `-review`, `hooks/useGateTitle.js` (called once in `App.jsx`) flips `document.title` to a waiting message and restores it on resume/stop/end.
- **Feedback opens after Stage 4**, not gated on briefing.
- **Briefing auto-runs at end** via `lib/analyzer/briefingClient.js`. If `pauseBeforeBriefing` is on (default), pipeline stops at `'pre-briefing-review'` first. Flow: quick summaries (parallel, `quickSummaryConcurrency` default 5) → `/api/synthesize` → `/api/check-briefing` → optional one-shot retry → save via `useBriefing` → render `<BriefingView>`.
- **Main-area layout order after a run:** Results → Download Report → Briefing → NotebookLM.

### Styling conventions

Four layers, each with a distinct job:

| Layer            | File                | Used for                                                             |
| ---------------- | ------------------- | -------------------------------------------------------------------- |
| **Tokens**       | `styles/tokens.css` | Palette, typography, spacing — consumed via `var(--aparture-*)`      |
| **Shell layout** | `styles/shell.css`  | Structural classes (`.shell`, `.shell-sidebar`, `.briefing-surface`) |

**Responsive breakpoint (768px).** Under 768px `styles/shell.css` turns the sidebar into an off-canvas drawer (`.shell-topbar` hamburger + `.shell-scrim` + `.shell-sidebar--open`; open/close state lives in `App.jsx`, `MobileTopBar.jsx` is the top bar). The same media block provides `.touch-target` (≥40px tap size for gate Continue buttons and verdict/action pills) and `.settings-field-row` (two-up wrap for multi-column settings rows). Desktop ≥768px is untouched by all of these — mobile rules live only inside the media query.
| **Briefing typography** | `styles/briefing.css` | Reading-surface rules scoped to `.briefing-prose` |
| **Inline styles** | component files | Component-local visual properties, variant/state switching |

**Rules:** always reference `var(--aparture-*)` for colors/typography/spacing (never hardcode palette); use `className` for shell layout, briefing-prose BEM, and Lucide icon sizing (`w-*`, `h-*`, `animate-spin`); use inline `style={{...}}` for everything else. **Avoid adding new Tailwind classes** — utility layer is present in `globals.css` but only Lucide sizing + one legacy `md:grid-cols-3` remain.

#### Semantic status colors (hardcoded by design)

These recur with consistent meaning across components and have no `--aparture-*` token because they are status indicators, not palette:

| Value             | Meaning                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `#22c55e`         | done / success / added / YES                                                               |
| `#f59e0b`         | running / MAYBE / warning / test mode                                                      |
| `#ef4444`         | error / stop / NO / removed                                                                |
| `#f97316`         | filter-override feedback event; negative score adjustment (paired with `#22c55e` positive) |
| `#6366f1`         | scoped-feedback event (bucket / score-review / run)                                        |
| `#a855f7`         | paper-comment feedback event / score badge accent                                          |
| `#64748b`         | dismissed / muted negative                                                                 |
| `#3b82f6`         | informational / suggested source                                                           |
| `rgba(0,0,0,0.5)` | modal overlay scrim                                                                        |

When adding a new status color, document it here rather than introducing a token.

### Profile + Briefing Pipeline

"Your Profile" is the single source of research intent. Every pipeline stage reads `profile.content` from `useProfile`. The profile is refined manually or via the LLM-assisted `SuggestDialog` flow.

**First-run templates + named profiles (2026-07).** `components/profile/StarterTemplatePicker.jsx` renders at the top of the profile view only while `isUneditedProfile(profile)` (content === `BLANK_PROFILE_TEMPLATE`, no revisions) and the `aparture-template-picker-dismissed` flag is unset; choosing a template sets profile content AND `config.selectedCategories`, then dismisses permanently. `components/profile/ProfileSwitcher.jsx` (inside `YourProfile`) manages named-profile snapshots via the `useProfile` API; it is disabled while the draft is dirty so switches can't act on stale committed content. Switching between named profiles always snapshots the outgoing content back into its own entry and archives a revision — nothing is silently lost.

**Suggest-improvements flow.** `/api/suggest-profile` accepts current profile + accumulated feedback and returns a revised profile with per-change rationales, or a `noChangeReason` if feedback doesn't point to a gap. All stars/dismisses/overrides are always included in the prompt uncapped; comments are capped at most-recent N per type (default 30) with a transparent trimming notice. `scoped-feedback` and `filter-override` events are also passed through uncapped — both are latest-wins or have no natural numeric accumulation, so capping would silently discard the current state.

**Backend synthesis.** `/api/synthesize` loads `prompts/synthesis.md`, renders placeholders via `lib/synthesis/renderPrompt.js`, dispatches via `lib/llm/callModel.js`, runs zod + citation validation via `lib/synthesis/validator.js`, and falls back to two-pass LLM repair via `lib/synthesis/repair.js`. Every `arxivId` in the output must be in the input list.

**Tuning knobs:**

- **Briefing quality:** edit `prompts/synthesis.md` (highest-impact single knob)
- **Suggest quality:** edit `prompts/suggest-profile.md`
- **Briefing visuals:** edit `styles/briefing.css` (palette tokens propagate automatically)
- **New feedback type:** extend event union in `hooks/useFeedback.js`, add variant in `components/feedback/FeedbackItem.jsx`, add section in `lib/profile/suggestPrompt.js`'s `renderFeedbackSection`
- **New LLM provider:** add entry to `lib/llm/providers.js`, create `lib/llm/structured/<provider>.js` following anthropic/google/openai templates (incl. optional `pdfBase64` + `cacheable`/`cachePrefix`), add a branch in `lib/llm/callModel.js`, add a unit test file under `tests/unit/llm/structured/`. ~150–200 lines.

**Prompt-harmony rules** (when editing any `prompts/*.md`):

1. **Label the user-written profile as "Research profile:"** in every rubric. Don't drift into "Research Interests", "SCORING CRITERIA", etc. — the term is canonical and signals to the model that this is the user's voice, not a constraint document.
2. **Quality strictness must be profile-aware.** rubric-scoring/rubric-pdf both contain a "Calibrate Quality strictness to the profile" paragraph. If you tighten quality language, keep the breadth-vs-selectivity escape hatch — otherwise users with breadth profiles get silently downgraded.
3. **Editorial framing is the briefing's job, not a hallucination.** check-briefing.md treats cross-paper synthesis in `executiveSummary` and `themes.argument` as legitimate (NO-verdict). Per-paper claims (numbers, methodology, author opinions) are still strict. Don't flatten the distinction.
4. **Filter is permissive by design.** rubric-scoring.md tells the model not to assume filter validated alignment — a paper that survived MAYBE should score 3-5 on Alignment, not 6-7. Preserve this when editing.
5. **Avoided-words list is global.** `synthesis.md` and `analyze-pdf-quick.md` both ban "novel"/"breakthrough"/"paradigm-shift". If you add a word to one, add it to the other.
6. **Podcast pruning respects briefing editorial choices.** notebooklm-discussion-guide.md preserves papers the briefing puts at the top of a theme even if their score is below the cutoff. Stars/comments flow into the briefing → the briefing flows into the podcast.

**Testing LLM-backed code:** all tests are fixture-based. `lib/llm/hash.js` produces a deterministic input hash; cached responses live at `tests/fixtures/llm/<hash>.json`. To add a fixture, run `tests/fixtures/synthesis/generate-sample.mjs` or use the `beforeAll` pattern in existing integration tests.

**Test escape hatches:**

- `APARTURE_TEST_PROMPT_OVERRIDE` env var — routes substitute the variable portion of the prompt so fixture hashes are deterministic. Also disables caching (so `cachePrefix`/`cacheable` are absent from the hashed input).
- `_testPdfBase64` body field on `pages/api/analyze-pdf.js` (active only when `NODE_ENV === 'test'`) — injects PDF bytes directly, bypassing Playwright. Minimal fixture at `tests/fixtures/pdf/minimal.pdf`.
- Occasional vitest worker-pool timeouts in WSL are infrastructure flakes — the test count + pass/fail summary are authoritative.

### LLM Dispatcher + Prompt Caching

All LLM-calling routes go through `lib/llm/callModel.js` — never call a provider API directly. Per-provider shaping is in `lib/llm/structured/{anthropic,google,openai}.js`; read those files when adding a route or provider.

**Prompt caching (Anthropic only).** Each route splits its prompt into a stable `cachePrefix` (template + profile) and variable `prompt` (per-batch content); when `cacheable: true`, the adapter emits multi-block `content` with `cache_control: {type: 'ephemeral'}` on the prefix. **Invariant:** `cachePrefix + prompt === fullRenderedPrompt` byte-for-byte. OpenAI auto-caches on repeated prefixes; Google caching is not enabled. Hit metrics surface as `cacheReadTok`/`cacheCreateTok`; dispatcher logs `[anthropic cache] read=N create=N`.

**PDF content blocks.** All 3 adapters accept `pdfBase64`. Anthropic emits a `document` block; Google emits `inlineData` in `parts`; OpenAI switches to `/v1/responses` (`buildOpenAIResponsesRequest`) — different shape from Chat Completions, response parsed at `output[].content[].text`, structured output via `text.format.json_schema` not `response_format`.

**Structured-output portability rules.** The three providers disagree on JSON Schema field support; keep schemas in the portable subset and enforce count/range/length in the server-side validator. Concrete rules for new routes:

1. Every object MUST include `additionalProperties: false` (Anthropic+OpenAI strict require it; `sanitizeSchemaForGoogle` strips it cleanly).
2. Every property MUST appear in `required`. For optional fields use `["T","null"]` so OpenAI strict accepts them; the Google sanitizer auto-converts to `{type: T, nullable: true}`.
3. Top-level schema MUST be `type: 'object'`. Wrap arrays as `{items: [...]}`.
4. Do NOT use `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `multipleOf`, or `oneOf`/`allOf`/`anyOf` — enforce in the validator.

Anthropic adapter additionally emits tools with `strict: true` for grammar-constrained sampling, and gates adaptive thinking via the registry: `supportsAdaptiveThinking` on each Anthropic `MODEL_REGISTRY` entry (looked up through `supportsAdaptiveThinkingByApiId`), with a family+version regex fallback ONLY for apiIds not in the registry (Opus/Sonnet 4.6+ and 5.x on; Haiku and pre-4.6 legacy IDs off — live 400 if forced). When thinking is on, `tool_choice` must be `{type: 'auto'}`; when off, the adapter forces the tool call via `{type: 'tool', name: <schema.name>}`.

**Route-pattern note.** Routes using the rubric template loader (`loadRubricPrompt`) pass `cachePrefix`/`cacheable` as explicit keys (empty `''`/`false` when off); briefing-style routes use the conditional-spread idiom `...(useCaching ? { cachePrefix, cacheable: true } : {})`. Don't mix — fixtures aren't transferable across modes. Compute `useCaching = provider === 'anthropic' && !isFixture && !promptOverride;`. The fixture-mode 401-skip and the `resolveCallModelMode(callModelMode)` resolution are both handled inside `lib/llm/resolveRouteAuth.js` now — routes call `resolveRouteAuth` rather than re-implementing either. The underlying rule is unchanged: client-supplied fixture mode is honored only under `NODE_ENV === 'test'` and forced back to live in production (`lib/llm/resolveCallModelMode.js`).

### Analyzer module split

`App.jsx` creates the pipeline once via `useMemo(() => createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef}), [])`. The pipeline reads all state from `useAnalyzerStore.getState()` — including the `reactContext` slice, which holds hook-derived values (profile, config, saveBriefing, briefingHistory) that `App.jsx` republishes on every render.

Stage bodies live in `lib/analyzer/stages/*.js`, one module per stage (`fetchPapers`, `quickFilter`, `scoreAbstracts`, `postProcessScores`, `analyzePDFs`, plus the `startProcessing` orchestrator). Each exports a `create<Stage>(deps)` factory; `createAnalysisPipeline` in `lib/analyzer/pipeline.js` is the composition point — it creates the per-run refs (`runBriefingDateRef`, `skipRemainingGatesRef`) and the shared core helpers (`stages/core.js`: `recordUsage`, `waitForResume`, `makeRobustAPICall`, `makeMockRobustAPICall`) ONCE, then passes the same `deps` object to every factory so abort/pause/skip-gates state stays single-instance. `stages/support.js` holds the module-level pure helpers (`providerKeyForModel`, `warnIfFreeTierLikelyToThrottle`). Stages must keep reading `store()`/`store().reactContext` at call time — never capture state at creation.

**To add a new pipeline stage:**

1. Create a new module in `lib/analyzer/stages/` exporting `create<Stage>(deps)`; read runtime state from `store()` and `store().reactContext` inside the returned function, never from the factory closure.
2. Instantiate it in `createAnalysisPipeline` (`lib/analyzer/pipeline.js`) with the shared `deps` object, before `createStartProcessing`.
3. Wire it into the orchestrator: add it to the deps passed to `createStartProcessing` and call it from `lib/analyzer/stages/startProcessing.js`.
4. If it reads a new React-hook value, add the key to the `reactContext` publish in `App.jsx`.

**Sync in-memory passes** (as opposed to async stages): if your new logic is purely transformational on the paper list — no I/O, no progress UI — model it as a pure helper called inside an existing stage rather than a new stage function. `lib/analyzer/applyDedupe.js`, called from `fetchPapers`, is the reference example. This keeps the stage diagram free of pseudo-stages.

**To unit-test a stage:** mock the store via `useAnalyzerStore.setState(...)`, then call `createAnalysisPipeline({...refs})` and invoke the returned handler. Internal stages aren't exported — test via `startProcessing` with mocked API responses.

### ArXiv Ingestion

User-facing model + tuning live in `docs/concepts/arxiv-ingestion.md` and `docs/using/tuning-the-pipeline.md`. Implementation lives entirely under `lib/arxiv/`; the `fetchPapers` stage (`lib/analyzer/stages/fetchPapers.js`) is a thin wrapper around `ingest.harvest`. Live-network probe: `scripts/probe-arxiv.mjs` (manual; never CI). Non-obvious bits:

- **Two paths, one orchestrator.** OAI-PMH (`pages/api/harvest-arxiv.js`) is primary; the legacy Atom (`pages/api/fetch-arxiv.js`) is fallback. They're in **separate rate-limit buckets** at arXiv (verified live 2026-04-29). `config.arxivIngestion: 'auto'|'oai-only'|'atom-only'` (default `'auto'`); auto trips a per-run circuit breaker on the first hard OAI failure and switches the rest of the run to Atom. `result.modeUsed` is surfaced in the run-summary status line.
- **OAI metadata format = `arXivRaw`.** We do NOT use the `arXiv` format: its `<created>` field is the latest-announcement date, not v1 submission, so re-announced old papers leak into `submitted-only` windows undetectably. `arXivRaw` exposes per-version `<version version="vN"><date>` and `parseOaiRecord` anchors `published` on v1.
- **`config.arxivWindowSemantics: 'submitted-only'|'submitted-or-updated'`** (default `'submitted-only'`). For `submitted-only`, `ingest.harvest` filters by v1 date in the target window (anchor-derived; see next bullet). For `submitted-or-updated`, all papers in the OAI window pass through untouched.
- **`config.daysBack: N` is "N days of content", not "N calendar days".** arXiv's announcement schedule means papers submitted on day N typically appear in OAI on day N+1, more on weekends. For `submitted-only`, the `fetchPapers` stage widens the OAI fetch window backward by `ANNOUNCE_LAG_BUFFER_DAYS` (= 7) past the user's target. `ingest.harvest` then anchors on the most recent v1 day with content across the selected subcategories and slices the v1 target to `[anchor − (N−1), anchor]`. For `submitted-or-updated`, no widening or anchor — OAI window equals the user's target.
- **Fill-up steps mirror this.** Each step's `from`/`until` are v1 target dates anchored to the broad-fetch anchor, not announcement dates. In `submitted-only` mode the fill-up's OAI fetch is widened forward by the lag buffer and post-filtered to v1 in the step's target window; in `submitted-or-updated` it uses the OAI window as-is.
- **Fill-ups** (`config.minPapersPerSubcategory`, default 5; `config.lookbackExtensions`, default `[3, 7, 14]`) fire narrow per-subcategory requests when a sub is under-served, going through whichever driver the broad fetch is using. Each step fetches only the new outer slice.
- **Cache** (`config.arxivCacheTtlMinutes`, default 60) is localStorage-backed under `aparture-arxiv-cache`, keyed by `(set, from, until, mode)`. Evicts oldest 50% on `QuotaExceededError`. `0` disables.
- **Set hierarchy** is hand-mapped in `lib/arxiv/sets.js` (almost `<group>:<archive>:<CATEGORY>` but physics is 3-level). Drives off the same catalog as `utils/arxivCategories.js`.
- **Atom hygiene rules** (don't regress): no `sortBy`/`sortOrder` in the URL (sort client-side after merge); inter-request spacing is **jittered** 3000–5000 ms via `arxivSpacingMs()` (deterministic 3 s trips arXiv's sliding-window heuristics more often); the proxy rewrites upstream 5xx to a 429 shape so the client retry ladder handles both identically.
- **Jittered spacing lives in `lib/arxiv/spacing.js`** (`arxivSpacingMs()` = `3000 + Math.floor(Math.random()*2000)`, `arxivSleep`). Applied BETWEEN consecutive requests (never before the first) in `ingest.harvest`'s OAI-prefix loop and both Atom subcategory loops, and on `harvestOai`'s resumption-page sleep. Both `harvest` (`spacingMsImpl`/`sleepImpl` deps) and `harvestOai` (`spacingMsImpl` arg) accept injectable overrides so unit tests don't actually sleep 3–5 s — multi-request tests pass a no-op `sleepImpl`.
- **Optional `ARXIV_CONTACT_EMAIL`**: when set, sent as HTTP `From` header on proxied requests. Goodwill signal only.
- **Bulk backfill (out of scope here):** use arXiv's Kaggle dump (`Cornell-University/arxiv`). OAI-PMH is for incremental harvesting only.

### Persistence (tiered: hot localStorage + cold filesystem)

Both briefings and analyzer sessions use the same hot/cold pattern (introduced 2026-04-21 / 2026-05-07 to escape browser localStorage quota). `safeSetItem` in `lib/persistence/safeStorage.js` is shared between them.

- **Briefings.** Hot: `aparture-briefing-current` (full current entry) + `aparture-briefing-index` (newest-first search-capable index — keeps `filterBriefings` synchronous). Cold: `reports/briefings/<id>.json` via `POST/GET/PATCH/DELETE /api/briefings[/:id]`, lazy-loaded by `useBriefing.loadBriefing(id)`. Migration from legacy `aparture-briefing-history` happens once on mount.
- **Sessions.** Hot: `arxivAnalyzerState` (key unchanged for CLI compat) — `config`, `sessionId`, `results.finalRanking` (top 30 + `deepAnalysis`), reduced `filterResults`, `processingTiming`, `testState`, `notebookLM`, `password`; ≤ 600 KB. Cold: `reports/sessions/<sessionId>.json` via `POST/GET/DELETE /api/sessions[/:id]` carries full `allPapers`, `scoredPapers`, `filterResults.{yes,maybe,no}`. Old single-key blobs read as-is on next save.
- **Phase 2 seam:** `BRIEFINGS_DIR` / `SESSIONS_DIR` resolve via `getBriefingsDir()` / equivalent — flip the constants to `~/aparture/{briefings,sessions}/` for the desktop build.
- **Extending mutable fields:** `pages/api/briefings/[id].js` whitelists in `MUTABLE_FIELDS` (currently `['archived']`); add there rather than merging arbitrary bodies. To make a field strippable under quota pressure, add it to `HEAVY_FIELDS` in `hooks/useBriefing.js`; to also drop it from the search index, extend `buildIndexEntry` in `lib/briefing/buildIndexEntry.js`.
- **CLI compat:** `cli/run-analysis.js` and `cli/setup.js` still read `localStorage.getItem('arxivAnalyzerState')` and access `.config` and `.results.finalRanking` — both are preserved in the hot tier.
- **Dedupe-index feed:** `useSeenPapers.recordRun` is called from the `saveBriefingAndSwitch` wrapper in `App.jsx` AFTER `saveBriefing` resolves, with the paper-id union extracted via `lib/seenPapers/papersFromBriefing.js` (briefed papers + `pipelineArchive.filterResults.{yes,maybe,no}`). Anchoring dedupe to briefing-save (not session-save) is what prevents aborted Stage 1 runs from poisoning the index. `useAnalyzerPersistence` still emits `onColdSessionSaved(allPapers, timestamp)` for any future consumer, but nothing in the dedupe path subscribes to it.

### Paper duplicate detection

Cross-run paper memory: stops the LLM pipeline from re-reading work it's already seen. Always-on detection, default-on removal. Introduced 2026-05-16; the full spec is local-only (`docs/superpowers/specs/2026-05-16-paper-dedupe-design.md`, gitignored — absent from fresh clones). The load-bearing decisions are inlined below.

- **Hot index:** `aparture-seen-papers-index` in localStorage — `{ arxivId → ISO date (YYYY-MM-DD) }` with `_migratedAt` (millis) and `_dedupeVersion` (int) sentinels. Owned by `hooks/useSeenPapers.js`. Earliest-date-wins (first-seen) merge, pruned to a 90-day rolling window on every write via `safeSetItem`. Keys starting with `_` are reserved metadata and skipped by both prune and dedupe lookups.
- **Cold seed (v3, briefing-anchored, auth-aware):** migration scans `reports/briefings/*.json` via the existing `/api/briefings` endpoints (concurrency cap 4 in `migrateFromBriefings`). Each briefing's paper-id union is extracted via `lib/seenPapers/papersFromBriefing.js` — briefed papers plus `pipelineArchive.filterResults.{yes,maybe,no}` so cost-anchoring is preserved without leaking on aborted runs. The effect depends on `[password]` and uses a `migrationSuccessRef` guard so failed attempts (401, fetch threw, signal aborted) leave sentinels unset and let the next password change retry — v2's "fire-once-on-mount with empty password" pattern marked migrations complete with empty indexes when the store hadn't hydrated yet, permanently stuck. Existing v1/v2 indexes trigger a one-time rebuild: `isVersionUpgrade` resets in-memory state to `{}` and clears localStorage inside the migration effect so the pipeline can't dedupe against poisoned data during the rebuild window. Bump `CURRENT_DEDUPE_VERSION` when migration semantics change again. Phase 2's filesystem-first migration will pick this index up automatically.
- **Pipeline placement:** single synchronous `applyDedupe` pass in the `fetchPapers` stage (`lib/analyzer/stages/fetchPapers.js`), AFTER `harvest()` returns (after any fill-up steps inside it) and BEFORE the LLM filter. Reads the index from `store().reactContext.seenPapersIndex`; reads `seenPapersReady` to distinguish "empty index" from "migration in flight". See `lib/analyzer/applyDedupe.js` for the pure-helper contract.
- **Setting:** `config.removeDuplicates` (Settings panel label: "Remove duplicate papers"; default `true`, seeded by the v6→v7 config migration in `useAnalyzerPersistence.js`). When `true`, matched papers are dropped before any LLM call. When `false`, they're kept with `paper.isDuplicate = true` and `paper.firstSeenDate = "YYYY-MM-DD"` decorations.
- **Decoration carry-through:** `paper.isDuplicate` rides along through Stage 2 filter, Stage 3 scoring, Stage 3.5 post-processing, and Stage 4 PDF analysis because each of these stages spreads `...batch[paperIdx]` (or passes the same paper refs) when building their outputs. No additional plumbing required for the analyzer-side card UIs.
- **Briefing-side caveat:** briefing PaperCards do NOT get the decoration that way — briefing papers come from LLM synthesis output, not from the original paper objects. `components/briefing/PaperCard.jsx` reads `seenPapersIndex` from the store at render time and derives the flag from `arxivId` presence. Keep this in mind if you ever add another UI surface downstream of synthesis.
- **UI:** `<DuplicateBadge>` (in `components/ui/`) renders next to the paper title on three sites — filter (`FilterResultsList.FilterResultRow`), scoring/top-30 (`components/results/RankedPaperCard.jsx`), briefing (`components/briefing/PaperCard.jsx`). Muted styling: `var(--aparture-mute)` text on a hairline border, with the Lucide `History` icon. This is informational, NOT a status indicator — the semantic colors (`#22c55e/#f59e0b/#ef4444/#f97316/#3b82f6`) are reserved for verdicts and feedback events.
- **Status line:** the existing run-summary line in `fetchPapers` is extended with `removed N duplicates` (Remove mode) or `flagged N duplicates` (Flag mode). When `seenPapersReady === false` AND `matched === 0`, the line appends `seen-papers index still loading` so the absence of dedupes is explained on the first run after the feature ships.
- **Known limitations (v1):** (1) Profile drift + Remove mode means a paper filtered NO under an old profile won't re-surface within the 90-day window; the rolloff is the escape hatch. (2) Fill-up requests are not dedupe-aware: if a subcategory hits `minPapersPerSubcategory` organically with mostly-duplicate papers, no extra fill-up fires. Making fill-up dedupe-aware requires restructuring `lib/arxiv/ingest.js` and is out of scope.
- **Extending the index data:** the body of the index is intentionally minimal (just dates). If you want to surface prior-verdict click-through or any other per-paper history in the badge, add a separate cold-tier read path against the sessions on disk — do NOT bloat the hot index, which is sized to stay under ~1.25 MB at steady state (50k entries × 25 bytes).

### LLM rate-limit handling

All LLM-backed routes propagate HTTP status + `Retry-After` end-to-end. `callModel.js` throws a typed `ProviderError` on non-2xx; `lib/llm/retryAfter.js` parses headers (Anthropic, OpenAI) and Google body-form `RetryInfo.retryDelay`. Routes forward via `sendProviderErrorResponse(res, err)`; `parseRouteError` (`lib/analyzer/RateLimitError.js`, called by the stage modules) translates 429/503 into `RateLimitError` so `makeRobustAPICall` honors `Retry-After` (cap 60 s) instead of the default exponential ladder (cap 30 s). The per-provider `LLMRateLimitBarrier` in `lib/analyzer/rateLimit.js` (`getLLMBarrier(provider)`) is wired into `AnalysisWorkerPool` via `barrierFor`: when any worker hits 429, every concurrent worker for that provider pauses on `barrier.acquire()` before its next call. Default `config.maxRetries: 4` (5 attempts). Pre-flight warning fires when free-tier Gemini Flash-Lite × concurrency × est. RPM > 60.

### ArXiv PDF Download Handling

`pages/api/analyze-pdf.js` tries direct fetch first; if the response lacks `%PDF-` magic bytes, it falls back to Playwright with a persistent profile at `temp/playwright-profile/` that caches arXiv cookies + reCAPTCHA bypass state. Fallback adds ~5–10s/paper.

Concurrency in `lib/analyzer/rateLimit.js`:

- **`ArxivDownloadThrottle`** — module-level singleton in the API route; serializes arXiv fetches to ~5s spacing across concurrent POSTs, honors `Retry-After` on 429/503 (cap 60s). Only the download step is throttled; the LLM call runs in parallel.
- **`AnalysisWorkerPool`** — client-side N-wide queue. Optional `cacheWarmup` barrier runs worker 0's first task alone so Anthropic's ephemeral cache is primed before siblings start. Google/OpenAI skip warmup (OpenAI auto-caches; Google has no caching).

If Playwright is unavailable (e.g. Vercel), route returns HTTP 422 `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA` and the pipeline aggregates skips into `skippedDueToRecaptcha` without halting.

### Refactor Context

Specs + plans for recent refactors live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (gitignored, local-only — they do NOT exist in fresh clones; never treat them as required reading). Anything load-bearing from a spec must be inlined here or in `docs/` — the dedupe and feedback-mechanisms sections above already carry their own decisions.

**Phase 2 (committed definition).** Phase 2 is the planned desktop packaging: an Electron app with filesystem-first state (`~/aparture/{reports,cache}/` replacing repo-local dirs), API keys in the OS keychain (using the existing `apiKey` auth path instead of `ACCESS_PASSWORD`), a first-run wizard, a daily scheduler, full NotebookLM ZIP export, HTML export, and installers. `cli/` is deleted once its dry-run/minimal-test entry points move into the app. Until then the code keeps explicit seams for it: the `BRIEFINGS_DIR`/`SESSIONS_DIR` indirection, the dual `apiKey`/`password` route auth, and the frozen `arxivAnalyzerState` localStorage key.

## Model Information

**Source of truth:** `utils/models.js` (`MODEL_REGISTRY` + `AVAILABLE_MODELS`). Don't duplicate IDs/pricing here — they rot fast.

**Anthropic adaptive thinking + strict tool use (non-obvious).** Tool definitions are emitted with `strict: true` for grammar-constrained sampling. Adaptive thinking (`thinking: {type: "adaptive"}`) is registry-driven: every Anthropic `MODEL_REGISTRY` entry carries a `supportsAdaptiveThinking` flag (true for Opus/Sonnet 4.6+ including the 5.x line; false for Haiku, which 400s on adaptive), consulted by the adapter via `supportsAdaptiveThinkingByApiId(apiId)`. A family+version regex fallback applies only to apiIds absent from the registry (smoke-script overrides, unregistered IDs); pre-4.6 Opus/Sonnet IDs fall through to off there (they require the older `{type: "enabled", budget_tokens}` shape). When thinking is on, `tool_choice` must be `{type: "auto"}` (forced `tool`/`any` are rejected); when off, the adapter forces the tool call via `{type: "tool", name: <schema.name>}`. `parseAnthropicResponse` skips `thinking` content blocks. Default `maxTokens` is raised to 16000 to accommodate thinking overhead.

**Not in the registry:** OpenAI o-series (`o3`, `o4-mini`) and xAI Grok. Adding Grok would need a new `lib/llm/structured/xai.js` adapter — xAI's OpenAI-compatible endpoint may not honor `response_format: json_schema` strict mode the same way.

Provider docs: [Anthropic](https://platform.claude.com/docs/en/docs/about-claude/models) · [OpenAI](https://developers.openai.com/api/docs/models) · [Google](https://ai.google.dev/gemini-api/docs/models)

## Documentation maintenance

Two user-facing doc surfaces: README + VitePress docs at `docs/`.

**Split rule.** README is thin (one-paragraph pitch, screenshot, 5-line Quickstart, links into `docs/`). `docs/` is source of truth for everything else. Change one → check the other.

**Trigger → impacted docs:**

| Code area                                                                                                     | Impacted docs                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/models.js`                                                                                             | `concepts/model-selection.md`, `getting-started/api-keys.md`                                                                                      |
| `lib/analyzer/pipeline.js`, `lib/analyzer/stages/*`                                                           | `concepts/pipeline.md`, `using/review-gates.md`, `using/tuning-the-pipeline.md`                                                                   |
| `lib/arxiv/*`                                                                                                 | `concepts/pipeline.md`, `concepts/arxiv-ingestion.md`, `using/tuning-the-pipeline.md`, `reference/troubleshooting.md`, `reference/environment.md` |
| `hooks/useSeenPapers.js`, `lib/analyzer/applyDedupe.js`, `lib/analyzer/stages/fetchPapers.js` dedupe block    | `using/tuning-the-pipeline.md`, `concepts/pipeline.md`                                                                                            |
| `prompts/synthesis.md`                                                                                        | `concepts/briefing-anatomy.md`, `reference/prompts.md`                                                                                            |
| Any `prompts/*.md`                                                                                            | `reference/prompts.md`                                                                                                                            |
| `lib/synthesis/validator.js`                                                                                  | `concepts/briefing-anatomy.md`                                                                                                                    |
| `pages/api/*` env usage, any new `process.env.*`                                                              | `reference/environment.md`                                                                                                                        |
| `components/briefing/*`                                                                                       | `using/reading-a-briefing.md`                                                                                                                     |
| `components/feedback/*`                                                                                       | `using/giving-feedback.md`                                                                                                                        |
| `components/profile/*`, `DiffPreview.jsx`, `/api/suggest-profile`                                             | `using/writing-a-profile.md`, `using/refining-over-time.md`                                                                                       |
| `components/run/*` + review-gate UIs, `components/score-review/*`                                             | `using/review-gates.md`                                                                                                                           |
| Settings panel                                                                                                | `using/tuning-the-pipeline.md`                                                                                                                    |
| `lib/notebooklm/*`                                                                                            | `add-ons/podcast.md`                                                                                                                              |
| `pages/api/analyze-pdf.js` Playwright changes                                                                 | `getting-started/install.md`, `reference/troubleshooting.md`                                                                                      |
| `pages/api/fetch-arxiv.js` query-shape or retry changes                                                       | `getting-started/install.md` (§4 contact email), `reference/troubleshooting.md` (arXiv rate limits)                                               |
| `hooks/useBriefing.js`, `pages/api/briefings/*`                                                               | `reference/environment.md` (`APARTURE_REPORTS_DIR`), `reference/troubleshooting.md` (briefing disk-write failures)                                |
| `hooks/useAnalyzerPersistence.js`, `pages/api/sessions/*`                                                     | `reference/environment.md` (`APARTURE_REPORTS_DIR`), `reference/troubleshooting.md` (session disk-write failures, browser localStorage quota)     |
| `lib/llm/callModel.js`, `lib/llm/ProviderError.js`, `lib/llm/retryAfter.js`, `lib/analyzer/RateLimitError.js` | `reference/troubleshooting.md` (provider rate limits), `using/tuning-the-pipeline.md` (`maxRetries`, rate-limit barrier)                          |

**Skip docs for:** internal refactors, bug fixes for hidden behavior, test additions, `docs/superpowers/**` changes (gitignored).

**Screenshots:** user-doc screenshots live in `docs/public/screenshots/` (embedded as `/screenshots/<name>.png`), captured at 1440×900 in light theme; retake when the UI changes materially.
