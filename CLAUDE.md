# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aparture is a Next.js-based web application for multi-stage research paper discovery and analysis using LLMs to search and analyze arXiv papers.

## Documentation

📚 **Full user docs (VitePress):** [joshspeagle.github.io/aparture](https://joshspeagle.github.io/aparture/) — built from `docs/`. For features, configuration, or usage questions, check there first before the source.

## Commands

### Development

- `npm run dev` - Start development server on http://localhost:3000
- `npm install` - Install dependencies
- `npm run build` - Build production bundle
- `npm run start` - Start production server

### Testing

- `npm test` - Run the Vitest unit/integration/component test suite (fixture-based, no real LLM calls)
- `npm run test:watch` - Vitest in watch mode for TDD
- `npm run test:coverage` - Vitest with coverage report
- `npm run lint` - ESLint across the repo
- `npm run lint:fix` - ESLint with --fix
- `npm run format:fix` - Prettier --write across the repo

### Documentation

- `npm run docs:dev` - Start VitePress docs dev server on http://localhost:5173
- `npm run docs:build` - Build static documentation site
- `npm run docs:preview` - Preview built documentation

### CLI Automation

Complete browser automation for unattended analysis runs (Playwright-driven via `cli/`). Settings persist in browser localStorage between runs; Google auth cached after first podcast generation. Works on Windows, Linux, and WSL.

- `npm run setup` - Interactive configuration (first-time setup)
- `npm run analyze` - Full workflow: report + document + podcast
- `npm run analyze:report` - Report only (skip NotebookLM)
- `npm run analyze:document` - Report + NotebookLM document (skip podcast)
- `npm run analyze:podcast` - Podcast only (reuses existing analysis files)
- `npm run test:dryrun` - Mock API test (fast, no costs)
- `npm run test:minimal` - Real API test (5 papers, minimal cost)

### Deployment

- `vercel` - Deploy to Vercel
- `vercel --prod` - Deploy to production

## Architecture

### Tech Stack

- **Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with PostCSS (utilities layer present but narrowly used — see "Styling conventions" below)
- **Typography (briefing view)**: Source Serif 4 + Inter + JetBrains Mono via `next/font/google`
- **State management**: Zustand (`stores/analyzerStore.js`) — central store for pipeline + UI state; React hooks for profile, briefing, feedback
- **Design system**: `components/ui/` warm-palette primitives (Button, Card, Input, TextArea, Select, Checkbox) + `@radix-ui/react-dialog` + `@radix-ui/react-collapsible`
- **Icons**: Lucide React
- **Schema validation**: `zod` (briefing structured output)
- **Word-level diff**: `diff` (used by DiffPreview in the suggest-profile flow)
- **Token estimation**: `tiktoken` for OpenAI + char-based heuristic for Anthropic/Google
- **Browser Automation**: Playwright (for PDF downloads and testing)
- **Testing**: Vitest + @testing-library/react + jsdom (fixture-based, zero real LLM calls)
- **Documentation**: VitePress 1.6.4
- **Deployment**: Vercel-optimized

### File Structure

Top-level layout is conventional Next.js. The list below calls out directories that carry non-obvious responsibilities or cross-cutting conventions. For anything not listed, the filename is the description.

- `pages/api/` - Backend API endpoints for LLM integrations and pipeline stages
- `pages/_app.js` - App shell; wraps routes with next/font CSS variables for the briefing typography
- `components/shell/` - Root shell; `App.jsx` is the entry point — owns all hook calls, Zustand selectors, pipeline creation, and the sidebar + main-area layout
- `components/ui/` - Warm-palette primitives (Button, Card, Input, TextArea, Select, Checkbox). All use inline styles with `var(--aparture-*)` CSS variables
- `components/run/ProgressTimeline.jsx` - 6-stage vertical timeline with filter-override and pre-briefing-review pause support
- `components/welcome/WelcomeView.jsx` - Persistent getting-started reference page
- `components/briefing/` - Briefing reading view (BriefingView root + leaf components) including `GenerationDetails.jsx` (collapsible per-briefing provenance disclosure with hallucination audit)
- `components/filter/FilterResultsList.jsx` - Inline filter rows with click-cycle verdict pill for overrides
- `components/settings/SettingsPanel.jsx` - Settings including "Review & confirmation" section (`pauseAfterFilter` + `pauseBeforeBriefing` + briefing retry checkboxes)
- `lib/analyzer/` - Extracted analyzer internals (see "Analyzer module split" below)
  - `pipeline.js` - `createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef})` builder. Reads state from Zustand store via `useAnalyzerStore.getState()`. Owns every analysis stage plus helpers. Returns `{startProcessing, runDryRunTest, runMinimalTest, generateNotebookLM}`. Auto-generates briefing at end of `startProcessing` with optional pause gates.
  - `mockApi.js` - `MockAPITester` class with a DI constructor — no React imports
  - `briefingClient.js` - `runBriefingGeneration()` orchestrates quick-summary fan-out → synthesize → hallucination check → retry → saveBriefing → last-run cache. Takes primitive config values as explicit params.
  - `rateLimit.js` - Shared rate-limiting + worker-pool primitives (`ArxivDownloadThrottle`, `AnalysisWorkerPool`). Isomorphic — same code runs in browser and Next.js API routes.
  - `exportReport.js` - `buildReportMarkdown()` + `downloadBlob()` + `exportAnalysisReport()` glue
- `lib/llm/` - LLM provider abstraction (callModel, providers, hash, fixtures, tokenBudget, resolveApiKey). `callModel.js` logs every live-mode call to the terminal plus a follow-up `[<provider> cache] read=N create=N` line when the response reports cache-hit tokens.
- `lib/llm/structured/` - Per-provider structured-output shaping (anthropic/google/openai). Each adapter accepts optional `pdfBase64` for native PDF content blocks and `cacheable`/`cachePrefix` for Anthropic prompt caching.
- `lib/synthesis/` - Briefing generation (schema, validator, repair, renderPrompt)
- `lib/profile/` - Profile utilities (migrations, diff, feedbackCap, suggestPrompt)
- `lib/briefing/filterBriefings.js` - Pure filter function for sidebar search (dateRange / starredOnly / query)
- `prompts/` - Editable LLM prompt templates (changes take effect on next call — no rebuild needed): `synthesis.md`, `analyze-pdf-quick.md`, `suggest-profile.md`, `check-briefing.md`
- `hooks/` - React hooks with localStorage persistence
  - `useProfile.js` - Research profile hook (structured data model with versioned history). `profile.content` is read by every pipeline stage.
  - `useBriefing.js` - Briefing archive with 90-day rolling window. Entries keyed by unique ID + timestamp (multiple briefings per day). `generationMetadata` carries profile snapshot, model IDs, filter verdicts, hallucination check results.
  - `useFeedback.js` - Feedback event store persisting to `aparture-feedback` localStorage with latest-wins star/dismiss semantics. Five event types: `star`, `dismiss`, `paper-comment`, `general-comment`, `filter-override`. Comments are append-only.
  - `useAnalyzerPersistence.js` - Owns `DEFAULT_CONFIG`, `readInitialConfig` (lazy useState initializer), load-on-mount effect, and the debounced save effect for `arxivAnalyzerState`
  - `useTheme.js` - Light/dark/auto theme switching via `data-theme` on `<html>` + `aparture-theme` localStorage key
- `stores/analyzerStore.js` - Central Zustand store replacing ~28 useState calls. 9 slices (processing, results, filterResults, processingTiming, testState, notebookLM, briefingUI, auth, reactContext). Pipeline reads from `getState()` directly.
- `tests/` - Vitest suite, fully fixture-based (no real LLM calls)
  - `tests/fixtures/llm/` - Cached LLM responses keyed by input hash
  - `tests/fixtures/briefing/` - Sample structured briefing for BriefingView test
- `cli/` - Command-line browser automation **(scheduled for deletion in Phase 2)**
- `utils/models.js` - **Centralized model configuration** (source of truth for all model IDs, names, and capabilities)
- `docs/` - VitePress documentation site
- `styles/` - Global styles (see "Styling conventions" below for the layering model): `globals.css`, `tokens.css`, `shell.css`, `briefing.css`
- `reports/`, `temp/` - **Runtime state** (gitignored). See "Runtime state directories" below.

### Runtime state directories

`reports/` and `temp/` are **not source code** — they hold runtime state generated by CLI/API workflows. They are gitignored but must remain at the repo root because `cli/run-analysis.js`, `cli/notebooklm-automation.js`, and `pages/api/analyze-pdf.js` reference them via paths relative to `process.cwd()`.

**`reports/`** - Historical analysis outputs organized by date. Can grow large over time. Safe to manually prune old monthly subdirectories.

**`temp/`** - Three persistent Playwright browser profiles plus cached PDFs:

- `temp/playwright-profile/` - Chromium profile with arXiv cookies + reCAPTCHA bypass state. **Do NOT delete** — losing it forces re-solving reCAPTCHA on the next PDF run.
- `temp/notebooklm-profile/` - Google NotebookLM session cookies. **Do NOT delete** — losing it forces interactive Google re-login on the next podcast run.
- `temp/browser-profile/` - Aparture web-UI automation profile used by `cli/browser-automation.js`
- `temp/*.pdf`, `temp/individual/`, `temp/screenshots/` - Cached PDFs and automation artifacts. Safe to prune freely.

**Phase 2 migration:** both directories move to `~/aparture/{reports,cache}/` when the Electron wrapper ships, so the repo root becomes source-only.

### API Integration

API routes in `pages/api/` handle one pipeline stage each. Source of truth for models is `utils/models.js` — always update `MODEL_REGISTRY` (API model ID) and `AVAILABLE_MODELS` (user-facing metadata) together.

- `quick-filter.js` - Stage 2 YES/NO/MAYBE filtering with one-sentence summary + justification per paper
- `score-abstracts.js` - Stage 3 batch relevance scoring
- `rescore-abstracts.js` - Stage 3.5 comparative consistency pass
- `analyze-pdf.js` - Stage 4 deep PDF analysis
  - arXiv downloads serialized via module-level `ArxivDownloadThrottle` (~5s spacing, honors `Retry-After` on 429/503)
  - Automatic fallback: direct fetch first, Playwright with persistent browser profile if reCAPTCHA detected
- `analyze-pdf-quick.js` - Stage 5 per-paper compression (~300 words) using `quickSummaryModel`, called in parallel during briefing prep
- `synthesize.js` - Stage 5 cross-paper briefing. Loads `prompts/synthesis.md`, renders with profile/papers/history, validates via `lib/synthesis/validator.js`, runs two-pass repair via `lib/synthesis/repair.js` on validation failure.
- `check-briefing.js` - Hallucination audit. Returns YES/MAYBE/NO verdict + flagged claims. User-configurable retry checkboxes trigger a second synthesis pass with a retry hint.
- `suggest-profile.js` - Accepts current profile + accumulated feedback; returns a revised profile with per-change rationales or a `noChangeReason`. Used by `SuggestDialog`.
- `generate-notebooklm.js` - NotebookLM-optimized document generation. When a briefing exists, receives the briefing's `executiveSummary` + themes as an EDITORIAL CONTEXT block to shape narrative emphasis.

**Auth pattern:** All API routes accept EITHER a client-supplied `apiKey` (for future BYOK flows) OR a `password` field validated against `process.env.ACCESS_PASSWORD`. When `password` is provided, the route reads the env-var key for the requested provider (`CLAUDE_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENAI_API_KEY`). The existing web UI uses the password path; Phase 2's Electron app will use the client-supplied apiKey path from OS keychain.

**Model slot separation:** The config has distinct `briefingModel` and `pdfModel` fields. `briefingModel` drives `/api/synthesize` and `/api/suggest-profile`; `pdfModel` drives `/api/analyze-pdf`. Both default to the same model on first run but can be tuned independently.

### Security

- Password protection via `ACCESS_PASSWORD` environment variable
- API keys stored in `.env.local`
- All API calls routed through secure backend endpoints

## Development Notes

### Environment Variables

Required in `.env.local`:

- `ACCESS_PASSWORD` - Application access password
- At least one API key (all are optional):
  - `CLAUDE_API_KEY` - Anthropic API key
  - `OPENAI_API_KEY` - OpenAI API key
  - `GOOGLE_AI_API_KEY` - Google AI API key
- Optional:
  - `PORT` - Development server port (default: 3000)
  - `NODE_ENV` - Environment mode

### Analysis Workflow

Pipeline stages follow `docs/concepts/pipeline.md` numbering (Stage 1 fetch → Stage 5 briefing, with Stage 3.5 post-processing). What CLAUDE.md adds beyond that doc:

- **Stage 2 filter-override pill.** The UI click-cycles YES/MAYBE/NO verdicts; each override is recorded as a `filter-override` feedback event and flows into the suggest-profile prompt as a "profile may be too narrow/broad" signal.
- **Batch-stage parallelism.** Stages 2 (filter), 3 (scoring), 3.5 (rescoring), and 4 (PDF) each have a per-stage concurrency knob: `filterConcurrency` (default 3), `scoringConcurrency` (default 3), `postProcessingConcurrency` (default 3), `pdfAnalysisConcurrency` (default 3). All clamped 1–20, all routed through `AnalysisWorkerPool` in `lib/analyzer/rateLimit.js`. Anthropic model slots get a single-flight cache-warmup barrier so worker 0 primes the prompt-cache entry before siblings start. Dry-run always forces concurrency=1 for deterministic UI pacing. Stage 4 also serializes arXiv downloads server-side at ~5s spacing.
- **Feedback is open after Stage 4**, not gated on briefing generation. Star/dismiss/comment are available on every paper as soon as deep analysis completes.
- **Briefing auto-runs at the end** via `briefingClient.js`. If `pauseBeforeBriefing` is on (default), pipeline stops at `'pre-briefing-review'` for user review first. Flow: quick summaries (parallel, `quickSummaryConcurrency` default 5) → `/api/synthesize` → `/api/check-briefing` → optional one-shot retry → save via `useBriefing` → render `<BriefingView>`.
- **Main-area layout order after a run:** Results → Download Report → Briefing → NotebookLM.

### Styling conventions

The codebase uses three styling layers that serve distinct purposes. Follow the
rules below when adding or modifying component styles.

#### Four-layer model

| Layer                   | File                  | Used for                                                                                                         |
| ----------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Tokens**              | `styles/tokens.css`   | All palette colours, typography, spacing — consumed via `var(--aparture-*)`                                      |
| **Shell layout**        | `styles/shell.css`    | Top-level structural classes (`.shell`, `.shell-sidebar`, `.shell-main`, `.briefing-surface`, `.config-surface`) |
| **Briefing typography** | `styles/briefing.css` | Reading-surface rules scoped to `.briefing-prose`                                                                |
| **Inline styles**       | component files       | Component-local visual properties, variant switching, state-driven colours                                       |

#### Tokens-first rule

Always reference `var(--aparture-*)` CSS variables for colours, spacing, and
typography. Do not hardcode palette values. The token set covers:

- Colours: `--aparture-bg`, `--aparture-surface`, `--aparture-ink`,
  `--aparture-mute`, `--aparture-hairline`, `--aparture-accent`,
  `--aparture-sidebar-bg`, `--aparture-sidebar-active`, `--aparture-hover`,
  `--aparture-focus-ring`, `--aparture-debate`, `--aparture-longitudinal`,
  `--aparture-question`
- Typography: `--aparture-font-serif`, `--aparture-font-sans`, `--aparture-font-mono`
- Type scale: `--aparture-text-xs` through `--aparture-text-2xl`
- Spacing: `--aparture-space-1` through `--aparture-space-16`

Tokens respect light/dark theme switching via `data-theme` on `<html>` and the
`prefers-color-scheme` fallback.

#### Semantic status colours (hardcoded by design)

The following hardcoded hex values recur throughout the codebase with consistent
semantic meaning. They have no `--aparture-*` token because they are status
indicators rather than palette colours, and they intentionally stand out from
the warm palette:

| Value                 | Semantic meaning                      |
| --------------------- | ------------------------------------- |
| `#22c55e`             | done / success / added / YES verdict  |
| `#f59e0b` / `#eab308` | running / MAYBE / warning / test mode |
| `#ef4444`             | error / stop / NO verdict / removed   |
| `#f97316`             | filter-override feedback event        |
| `#3b82f6`             | informational / suggested source      |
| `rgba(0,0,0,0.5)`     | modal overlay scrim                   |

When you need a status colour, use the appropriate value from this table — don't
substitute a token-based palette colour. When you add a new status colour, document
it here rather than introducing a `--aparture-*` token.

#### When to use inline styles

Use `style={{...}}` for:

- **All visual properties in components outside `.briefing-prose`** — colours,
  borders, padding, typography, flex/grid properties.
- **Variant switching** — computing styles based on props or state
  (e.g., `background: isActive ? 'var(--aparture-sidebar-active)' : 'transparent'`).
- **Hover/focus state** — if a component has no CSS class, implement hover
  by setting `e.currentTarget.style.background` in `onMouseEnter`/`onMouseLeave`
  handlers, as done throughout `Sidebar.jsx` and `SuggestDialog.jsx`.
- **Structural one-offs** — layout props (e.g. `width: '55%'`) that are
  component-specific and would add noise to a global stylesheet.

The `components/ui/` primitives (Button, Card, Input, etc.) define their base
styles as object literals and accept an `overrideStyle` prop so callers can
extend them without a separate CSS class.

#### When to use className

Use `className` for:

- **Shell layout containers** — `"shell"`, `"shell-sidebar"`, `"shell-main"`,
  `"briefing-surface"`, `"config-surface"`. These classes live in `shell.css`
  and carry all structural rules (dimensions, sticky positioning, overflow).
- **Briefing typography** — components rendered inside the `.briefing-prose`
  reading surface use BEM-style class names (`paper-card`, `meta-line`,
  `italic-pitch`, `action-row`, etc.) whose rules live in `briefing.css`.
  The root container is `<article className="briefing-prose">` (rendered by
  `BriefingProse.jsx`).
- **Lucide React icon sizing** — all Lucide icons use `className="w-4 h-4"`,
  `"w-5 h-5"`, or `"w-3 h-3"` because the library sizes SVGs via those classes.
  `animate-spin` is also acceptable on loading spinners. These are the only
  Tailwind utilities that are intentionally used and retained.

A few class names (`theme-section`, `executive-summary`, `quick-summary-inline`)
appear in JSX with no matching CSS rule. They are semantic hooks for test
selectors and future extension — not style drivers.

#### Mixing inline styles and className

Mixing is acceptable and common. The standard pattern is:

```jsx
<div
  className="briefing-surface"          // structural layout from shell.css
  style={{ background: 'var(--aparture-surface)' }}  // visual override
>
```

or on Lucide icons:

```jsx
<FileText
  className="w-5 h-5" // Tailwind sizing (Lucide convention)
  style={{ color: 'var(--aparture-accent)' }} // token-backed colour
/>
```

If a component uses both approaches, `className` should carry only structural
or Lucide sizing/animation, and `style` should carry all visual properties.

#### Tailwind

**Avoid adding new Tailwind classes.** The utility layer is present in
`globals.css` (`@tailwind utilities`) but is not used for layout, colour, or
typography in any component. Existing Tailwind usage is limited to:

- Lucide icon sizing (`w-*`, `h-*`) and animation (`animate-spin`) — keep these.
- One responsive breakpoint (`md:grid-cols-3` in `SettingsPanel`) — legacy; do
  not add more responsive utilities.
- One redundant `border-dashed` in `FeedbackTimeline` — do not replicate this pattern.

New layout or styling work must use inline styles + tokens or shell/briefing
CSS classes, not Tailwind utilities.

### Profile + Briefing Pipeline

Aparture's "Your Profile" panel at the top of the app is the single source of research intent. Every pipeline stage (quick-filter, score-abstracts, rescore-abstracts, analyze-pdf, generate-notebooklm, synthesize) reads `profile.content` from `useProfile`. The profile can be refined manually or via the LLM-assisted suggest-improvements flow.

**Feedback model.** Four feedback types — stars, dismisses, per-paper comments, freeform general comments — plus a fifth `filter-override` type for quick-filter verdict overrides, all persisted to `aparture-feedback` localStorage via `useFeedback`. Star/dismiss are latest-wins per paper; comments are append-only.

**Suggest-improvements flow.** `/api/suggest-profile` accepts the current profile + accumulated feedback and returns a revised profile with per-change rationales, or a `noChangeReason` if the feedback doesn't point to a clear gap. `SuggestDialog` surfaces the diff and lets the user accept or reject. The Your Profile page shows a feedback breakdown (stars, dismisses, comments, overrides) as helper text. All stars/dismisses/overrides are always included in the prompt; comments are capped at most-recent N per type (default 30) with a transparent trimming notice.

**Backend synthesis data flow:**

1. `pages/api/synthesize.js` loads `prompts/synthesis.md` as a template
2. `lib/synthesis/renderPrompt.js` substitutes `{{profile}}`, `{{papers}}`, `{{history}}` placeholders
3. `lib/llm/callModel.js` dispatches to the chosen provider via `lib/llm/structured/<provider>.js`, using provider-native structured output (Anthropic `tool_use`, Google `responseSchema`, OpenAI `response_format` strict)
4. `lib/synthesis/validator.js` runs zod schema validation + citation validation (every `arxivId` must be in the input list)
5. `lib/synthesis/repair.js` asks the LLM to fix the briefing if validation fails (two-pass)
6. The API returns a structured briefing object

**Frontend briefing data flow:**

1. Pipeline's `startProcessing` in `lib/analyzer/pipeline.js` auto-calls `runBriefingGeneration` from `lib/analyzer/briefingClient.js` after PDF analysis completes (with optional `pauseBeforeBriefing` gate)
2. `briefingClient.js` calls `/api/analyze-pdf-quick` in parallel to generate per-paper quick summaries, then `/api/synthesize`, then `/api/check-briefing` for the hallucination audit, then optionally retries synthesis with a retry hint
3. Saves via `hooks/useBriefing.js` (localStorage, 90-day window, ID-keyed entries)
4. `App.jsx` navigates to the new briefing via `stableSaveBriefingAndSwitch`; renders via `components/briefing/BriefingView.jsx`. Flagged hallucination claims are surfaced in a disclosure (`GenerationDetails.jsx`) below the briefing.

**To tune synthesis quality:** edit `prompts/synthesis.md`. Changes take effect on the next `/api/synthesize` call — no rebuild needed. This prompt is the single most important quality knob.

**To tune suggest-improvements quality:** edit `prompts/suggest-profile.md`. Takes effect on the next suggest call.

**To add a new LLM provider:** add an entry to `lib/llm/providers.js`, create `lib/llm/structured/<provider>.js` with `build*Request` + `parse*Response` following the existing anthropic/google/openai templates (including optional `pdfBase64` + `cacheable`/`cachePrefix` handling if the provider supports them), add a branch in `lib/llm/callModel.js`, and add a unit test file under `tests/unit/llm/structured/`. ~150-200 lines of new code.

**To change briefing visual design:** edit `styles/briefing.css`. Palette tokens (`--aparture-*`) are referenced by class name in the React components, so color changes propagate without touching `.jsx`.

**To add a new feedback type:** extend the event type union in `hooks/useFeedback.js`, add a variant in `components/feedback/FeedbackItem.jsx`, and add a new section in `lib/profile/suggestPrompt.js`'s `renderFeedbackSection`.

**Testing LLM-backed code:** all tests are fixture-based. `lib/llm/hash.js` produces a deterministic input hash; cached responses live at `tests/fixtures/llm/<hash>.json`. To add a new fixture, run the helper at `tests/fixtures/synthesis/generate-sample.mjs` or use the `beforeAll` pattern in existing integration tests.

**Test escape hatches:**

- `APARTURE_TEST_PROMPT_OVERRIDE` env var — when set, routes substitute the variable portion of the prompt with the override value so fixture hashes become deterministic regardless of input content. Routes also disable caching when this is set (so `cachePrefix`/`cacheable` fields are absent from the hashed input object).
- `_testPdfBase64` body field on `pages/api/analyze-pdf.js` — active only when `NODE_ENV === 'test'`. Injects PDF bytes directly, bypassing the Playwright / reCAPTCHA download path. Minimal fixture PDF at `tests/fixtures/pdf/minimal.pdf`.
- Expect occasional vitest worker-pool timeout "errors" in WSL environments — they're infrastructure flakes, not test failures. The test count and pass/fail summary are authoritative.

### LLM Dispatcher + Prompt Caching

All LLM-calling API routes go through `lib/llm/callModel.js`. No route calls a provider API directly. When adding a new LLM call, always route it through `callModel`.

**Prompt caching (Anthropic only).** Each route splits its prompt into a stable `cachePrefix` (template text + user profile) and a variable `prompt` (per-batch/per-call content). When `cacheable: true` is passed to `callModel`, the Anthropic adapter emits a multi-block `content` array with `cache_control: {type: 'ephemeral'}` on the prefix block. The invariant `cachePrefix + prompt === fullRenderedPrompt` must hold byte-for-byte — test each route's split logic against a known-good rendering. OpenAI caches automatically when prompt prefixes repeat, no code changes needed. Google caching is not enabled.

**PDF content blocks.** All 3 adapters accept an optional `pdfBase64` input field. When present: Anthropic emits `{type: 'document', source: {type: 'base64', ...}}`, Google emits `{inlineData: {mimeType: 'application/pdf', ...}}` in `parts`, OpenAI switches to `/v1/responses` via `buildOpenAIResponsesRequest` (different shape from Chat Completions — parses `response.output[].content[].text`, not `output_text`).

**Cache-hit measurement.** `callModel` surfaces `cacheReadTok` / `cacheCreateTok` in its normalized return. The dispatcher logs them as `[anthropic cache] read=N create=N` so cache effectiveness is observable during a run.

**Route pattern (canonical example: `pages/api/synthesize.js`):**

- Accept `apiKey` (BYOK) OR `password` (env lookup per provider), validated before body checks
- Resolve `provider` (lowercased) from `MODEL_REGISTRY[model]?.provider` before auth
- Compute `const useCaching = provider === 'anthropic' && !isFixture && !promptOverride;` — all three conditions required
- Use conditional spread when calling: `...(useCaching ? { cachePrefix, cacheable: true } : {})` so the fields don't appear in the input object (and thus the fixture hash) when caching is off
- Accept `callModelMode` from `req.body` and pass as second arg to `callModel` (enables fixture-mode tests)

### Analyzer module split

The analysis pipeline lives in extracted modules under `lib/analyzer/` (see File Structure above), each unit-testable in isolation. `App.jsx` wires the pipeline by creating it once via `useMemo(() => createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef}), [])`. The pipeline reads all state from `useAnalyzerStore.getState()` — including the `reactContext` slice which holds React-hook-derived values (profile, config, saveBriefing, briefingHistory). `App.jsx` publishes these into the store's `reactContext` on every render. Pipeline stage handlers are destructured from the memoized pipeline object and passed down to `ControlPanel` as callbacks.

**To add a new pipeline stage:**

1. Add the stage function inside `createAnalysisPipeline` in `lib/analyzer/pipeline.js`, reading its deps from `store()` and `store().reactContext`.
2. If it calls sibling stages, declare it after its dependencies.
3. Wire it into `startProcessing`.
4. If it reads a new React-hook value, add the key to the `reactContext` publish in `App.jsx`.

**To unit-test a pipeline stage:** mock the Zustand store via `useAnalyzerStore.setState(...)` with the required state, then call `createAnalysisPipeline({...refs})` and invoke the returned handler. Internal stages aren't exported — test them via `startProcessing` with mocked API responses.

### ArXiv PDF Download Handling

`pages/api/analyze-pdf.js` tries a direct fetch first; if the response isn't a PDF (missing `%PDF-` magic bytes), it falls back to Playwright with a persistent browser profile at `temp/playwright-profile/` that caches arXiv session cookies + reCAPTCHA bypass state.

Concurrency control lives in `lib/analyzer/rateLimit.js`:

- **`ArxivDownloadThrottle`** — module-level singleton in the API route. Serializes arXiv fetches to ~5s spacing across concurrent POSTs, honors `Retry-After` on 429/503 responses (capped at 60s). Only the download step is throttled — the LLM call runs in parallel.
- **`AnalysisWorkerPool`** — client-side N-wide queue in `analyzePDFs`. Optional `cacheWarmup` barrier runs worker 0's first task alone so Anthropic's ephemeral prompt-cache entry is primed before siblings start; Google/OpenAI skip warmup (OpenAI auto-caches, Google has no caching).

Playwright fallback adds ~5-10 s per paper but reliably bypasses reCAPTCHA. If Playwright is unavailable (e.g. Vercel), the route returns HTTP 422 `PLAYWRIGHT_UNAVAILABLE_RECAPTCHA` and the pipeline aggregates skips into `skippedDueToRecaptcha` without halting the run.

### Documentation Development

The documentation is built with VitePress and includes:

- **Custom theme**: Extends VitePress DefaultTheme with custom branding
- **Custom CSS**: arXiv red color (#b31b1b) for "ar" highlights in title
- **Auto-deployment**: GitHub Actions deploys to GitHub Pages on every push to main

**Key files:**

- `docs/.vitepress/config.mjs` - VitePress configuration
- `docs/.vitepress/theme/index.js` - Custom theme setup
- `docs/.vitepress/theme/custom.css` - Custom styling
- `.github/workflows/deploy-docs.yml` - Auto-deployment workflow

**Working with docs:**

- Always verify information accuracy against source code (especially `utils/models.js`)
- Check external links and pricing information periodically
- Maintain consistency in model names and terminology across all pages
- Update CLAUDE.md when making significant documentation changes

### Refactor Context

Design specs and implementation plans for recent refactors live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (gitignored, local-only — check for existence before referencing). Phase 2 scope is in the v2 spec §11 (Electron wrapper, filesystem-first state, OS keychain, first-run wizard, memory loop, daily scheduler, full NotebookLM ZIP bundle, HTML export, cross-platform installers).

## Model Information

**Source of truth:** `utils/models.js` (`MODEL_REGISTRY` + `AVAILABLE_MODELS`). Read it for the current set of model IDs, API IDs, context windows, and pricing. Don't duplicate those tables here — they rot fast.

**Model slots:** `filterModel` (Stage 2 quick filter), `scoringModel` (Stage 3 abstract scoring), `pdfModel` (Stage 4 deep analysis), `briefingModel` (Stage 5 synthesis + suggest-profile), `quickSummaryModel` (Stage 5 per-paper compression), `notebookLMModel` (NotebookLM document).

**Anthropic adaptive thinking (non-obvious).** All Anthropic calls include `thinking: {type: "adaptive"}`. With thinking enabled, `tool_choice` must be `{type: "auto"}` — forced tool choice is incompatible. The model still reliably calls the provided tool. `parseAnthropicResponse` skips `thinking` content blocks. Default `maxTokens` is raised to 16000 to accommodate thinking overhead.

**Not in the registry:** OpenAI o-series (`o3`, `o4-mini`) and xAI Grok. Adding Grok would need a new `lib/llm/structured/xai.js` adapter — xAI's OpenAI-compatible endpoint may not honor `response_format: json_schema` strict mode the same way.

When verifying current model names/pricing against provider docs:
[Anthropic](https://platform.claude.com/docs/en/docs/about-claude/models) · [OpenAI](https://developers.openai.com/api/docs/models) · [Google](https://ai.google.dev/gemini-api/docs/models)

## UX architecture

The web UI is built around a sidebar + main-area layout with a warm unified palette (Source Serif 4 + Inter + arXiv red), light/dark theme toggle (via `hooks/useTheme.js` and `data-theme` on `<html>`), component primitives in `components/ui/`, and Zustand state management in `stores/analyzerStore.js`. Briefings are archived with a 90-day rolling window including search/filter/delete/archive (see `hooks/useBriefing.js` + `lib/briefing/filterBriefings.js`). Each briefing carries provenance via `GenerationDetails.jsx` (profile snapshot, model IDs, filter verdicts, hallucination audit). A persistent `WelcomeView.jsx` serves as the getting-started reference. Pipeline pause gates (`pauseAfterFilter`, `pauseBeforeBriefing`) are configurable in `SettingsPanel.jsx`.

**Out of scope / deferred to Phase 2:** Electron packaging, responsive/mobile layout, keyboard shortcuts, daily scheduler/automation, cloud sync.

## Documentation maintenance

Aparture has two user-facing doc surfaces: the README and the VitePress docs site at `docs/`. Keep them in sync with the code. Rules below trigger doc updates when specific code areas change.

### Split rule

- **README is thin.** One-paragraph pitch, hero screenshot, 5-line Quickstart, links into `docs/`. No feature lists, no walkthroughs, no deployment guides. If content is authoritative, it lives in `docs/`.
- **`docs/` is the source of truth** for everything else: install, API keys, briefing anatomy, pipeline, feedback loop, settings, troubleshooting, env vars, prompt files.
- Change something in one place → check the other.

### Trigger → impacted docs

| Code area / artifact                                          | Impacted docs                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `utils/models.js` (model registry, pricing)                   | `concepts/model-selection.md` · `getting-started/api-keys.md` (hub pricing)       |
| `lib/analyzer/pipeline.js` (stages, handlers)                 | `concepts/pipeline.md` · `using/review-gates.md` · `using/tuning-the-pipeline.md` |
| `prompts/synthesis.md`                                        | `concepts/briefing-anatomy.md` · `reference/prompts.md`                           |
| Any file in `prompts/`                                        | `reference/prompts.md`                                                            |
| `lib/synthesis/validator.js` (schema)                         | `concepts/briefing-anatomy.md`                                                    |
| `pages/api/*` (if env-var usage changes)                      | `reference/environment.md`                                                        |
| Any new `process.env.*` lookup                                | `reference/environment.md`                                                        |
| `components/briefing/*`                                       | `using/reading-a-briefing.md`                                                     |
| `components/feedback/*`                                       | `using/giving-feedback.md`                                                        |
| `components/profile/*`                                        | `using/writing-a-profile.md` · `using/refining-over-time.md`                      |
| `components/run/*` + review-gate UIs                          | `using/review-gates.md`                                                           |
| Settings panel                                                | `using/tuning-the-pipeline.md`                                                    |
| `lib/notebooklm/*`                                            | `add-ons/podcast.md`                                                              |
| `pages/api/analyze-pdf.js` (Playwright behavior)              | `getting-started/install.md` · `reference/troubleshooting.md`                     |
| `components/profile/DiffPreview.jsx` + `/api/suggest-profile` | `using/refining-over-time.md`                                                     |

### Screenshot policy

- One hero screenshot on `docs/index.md` (briefing view).
- No inline UI screenshots elsewhere except where UX is genuinely hard to describe in words (e.g., the filter-override pill's click-cycle).
- Stale screenshots get refreshed or removed — don't document pixels you could describe.

### Research notes

- Major doc work produces research notes in `docs/superpowers/research/` (gitignored, pattern-matches `specs/` and `plans/`).
- External info carries a "snapshot taken YYYY-MM-DD" footer.
- Notes are working artifacts, not canonical docs. They inform page writing; they don't ship.

### When NOT to update docs

- Internal refactors with no user-visible behavior change
- Bug fixes for behavior users weren't aware of
- Test additions or fixture changes
- `docs/superpowers/**` changes (all gitignored)
