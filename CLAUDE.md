# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aparture is a Next.js-based web application for multi-stage research paper discovery and analysis using LLMs to search and analyze arXiv papers.

## Documentation

📚 **Full documentation**: https://joshspeagle.github.io/aparture/

The `docs/` directory contains comprehensive VitePress documentation covering:

- **Getting Started**: Installation, setup, quick start
- **User Guide**: Web interface, CLI automation, testing, reports
- **Concepts**: Multi-stage analysis, arXiv categories, model selection, NotebookLM
- **API Reference**: Commands, configuration, environment variables

When questions arise about features, configuration, or usage, refer to the documentation first.

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

- `npm run setup` - Interactive configuration (first-time setup)
- `npm run analyze` - Full analysis workflow (report + document + podcast)
- `npm run analyze:report` - Report only (skip NotebookLM features)
- `npm run analyze:document` - Report + NotebookLM document (skip podcast)
- `npm run analyze:podcast` - Podcast only (skip analysis, use existing files)
- `npm run test:dryrun` - Mock API test (fast, no costs)
- `npm run test:minimal` - Real API test (3 papers, minimal cost)

### Deployment

- `vercel` - Deploy to Vercel
- `vercel --prod` - Deploy to production

## Architecture

### Tech Stack

- **Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with PostCSS
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

- `pages/` - Next.js pages and API routes
  - `pages/api/` - Backend API endpoints for LLM integrations
  - `pages/index.js` - Main application entry point
  - `pages/_app.js` - App shell; wraps routes with next/font CSS variables for the briefing typography
- `components/` - React components
  - `components/shell/` - **Phase B** root shell: `App.jsx` (replaces the deleted `ArxivAnalyzer.js`), `Sidebar.jsx`, `SidebarBriefingList.jsx`, `MainArea.jsx`. App.jsx is the entry point — owns all hook calls, Zustand selectors, pipeline creation, and the sidebar + main-area layout.
  - `components/ui/` - **Phase B** warm-palette primitive library: `Button.jsx` (primary/secondary/ghost), `Card.jsx`, `Input.jsx`, `TextArea.jsx`, `Select.jsx`, `Checkbox.jsx`. All use inline styles with `var(--aparture-*)` CSS variables; no Tailwind.
  - `components/run/` - **Phase B** `ProgressTimeline.jsx` — 6-stage vertical timeline for live pipeline progress display with filter-override and pre-briefing-review pause support.
  - `components/welcome/` - **Phase B** `WelcomeView.jsx` — persistent getting-started reference page.
  - `components/analyzer/` - `ControlPanel.jsx` (restyled to warm palette in Phase B)
  - `components/briefing/` - Briefing reading view (BriefingView root + 10 leaf components) + `BriefingCard.jsx` + **Phase B** `GenerationDetails.jsx` (collapsible per-briefing provenance disclosure)
  - `components/filter/` - `FilterResultsList.jsx` with inline FilterResultRow + cycle-verdict pill (restyled to warm palette)
  - `components/notebooklm/` - `NotebookLMCard.jsx` (restyled to warm palette, rendered as disclosure below briefing)
  - `components/profile/` - Your Profile panel (YourProfile, MigrationNotice, HistoryDropdown, SuggestDialog, DiffPreview; StatusRow + PreviewPanel are unused legacy files) — all restyled to warm palette with UI primitives
  - `components/feedback/` - Feedback panel (FeedbackPanel, FeedbackHeader, FeedbackFilters, GeneralCommentInput, FeedbackTimeline, FeedbackItem, FeedbackEmptyState) + `eventMeta.js` — all restyled to warm palette
  - `components/results/` - results-list cards (AnalysisResultsList, DownloadReportCard) — restyled to warm palette
  - `components/settings/` - SettingsPanel with "Review & confirmation" section (`pauseAfterFilter` + `pauseBeforeBriefing` + briefing retry checkboxes) — restyled to warm palette
- `lib/` - Backend and analyzer library code
  - `lib/analyzer/` - Extracted analyzer internals
    - `pipeline.js` - `createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef})` builder. Reads state from Zustand store via `useAnalyzerStore.getState()`. Returns `{startProcessing, runDryRunTest, runMinimalTest, generateNotebookLM}`. Owns fetchPapers, performQuickFilter, scoreAbstracts, postProcessScores, analyzePDFs, and the arXiv query stack. Auto-generates briefing at the end of `startProcessing` via `briefingClient.js`, with optional `pauseBeforeBriefing` gate (sets stage `'pre-briefing-review'` and waits for user to click Continue).
    - `mockApi.js` - MockAPITester class. DI constructor takes `{abortControllerRef, pauseRef, waitForResume}`.
    - `briefingClient.js` - `runBriefingGeneration()` orchestrates quick-summary fan-out → synthesize → hallucination check → retry → saveBriefing (with generationMetadata including hallucination verdict/justification/flaggedClaims) → last-run cache. Called automatically at the end of the pipeline's `startProcessing`.
    - `exportReport.js` - `buildReportMarkdown()` + `downloadBlob()` + `exportAnalysisReport()` glue.
  - `lib/llm/` - LLM provider abstraction (callModel, providers, hash, fixtures, tokenBudget, resolveApiKey). `callModel.js` logs every live-mode call to the terminal (`Sending request to <Provider>: {model, promptLength, structured}`).
  - `lib/llm/structured/` - Per-provider structured-output shaping (anthropic/google/openai)
  - `lib/synthesis/` - Briefing generation (schema, validator, repair, renderPrompt)
  - `lib/profile/` - **Phase 1.5** profile utilities (migrations, diff, feedbackCap, suggestPrompt)
- `prompts/` - **Phase 1** editable LLM prompt templates
  - `prompts/synthesis.md` - Synthesis prompt (the main quality knob — edit to tune briefings)
  - `prompts/analyze-pdf-quick.md` - Quick-summary compression prompt
  - `prompts/suggest-profile.md` - **Phase 1.5** prompt template for the suggest-improvements flow
  - `prompts/check-briefing.md` - **Phase 1.5.1** hallucination-audit prompt for the retry loop
- `hooks/` - React hooks with localStorage persistence
  - `hooks/useProfile.js` - Research profile hook (structured data model with versioned history)
  - `hooks/useBriefing.js` - Briefing archive with 90-day rolling window. Entries keyed by unique ID + timestamp (multiple briefings per day supported). `saveBriefing(date, briefing, metadata)` returns the new entry's ID. `deleteBriefing(id)`, `toggleArchive(id)` for managing history. `generationMetadata` carries profile snapshot, model IDs, filter verdicts, hallucination check results.
  - `hooks/useFeedback.js` - Feedback event store with latest-wins star/dismiss semantics (5 event types: star, dismiss, paper-comment, general-comment, filter-override)
  - `hooks/useAnalyzerPersistence.js` - Owns DEFAULT_CONFIG (includes `pauseAfterFilter: true`, `pauseBeforeBriefing: true`), readInitialConfig, load-on-mount effect, and the debounced save effect for `arxivAnalyzerState`
  - `hooks/useTheme.js` - **Phase B** light/dark/auto theme switching; reads/writes `aparture-theme` localStorage key, applies `data-theme` attribute to `<html>`
- `stores/` - **Phase B** Zustand state management
  - `stores/analyzerStore.js` - Central Zustand store replacing ~28 useState calls. 9 slices (processing, results, filterResults, processingTiming, testState, notebookLM, briefingUI, auth, reactContext). Pipeline reads from `useAnalyzerStore.getState()` directly.
- `tests/` - Vitest test suite (325 tests across 50 files, fully fixture-based)
  - `tests/unit/` - Pure-function tests (llm/_, synthesis/_, hooks/\*)
  - `tests/component/` - React component tests via @testing-library/react
  - `tests/integration/` - API route handler tests with fixture-mode callModel
  - `tests/fixtures/llm/` - Cached LLM responses keyed by input hash
  - `tests/fixtures/briefing/` - Sample structured briefing for BriefingView test
- `cli/` - Command-line interface tools and browser automation **(scheduled for deletion in Phase 2)**
  - `cli/server-manager.js` - Next.js development server lifecycle management
  - `cli/browser-automation.js` - Playwright-based browser automation wrapper
  - `cli/notebooklm-automation.js` - Google NotebookLM automation wrapper
  - `cli/notebooklm-prompts.js` - Prompt parsing utilities
  - `cli/config-manager.js` - Configuration persistence
  - `cli/setup.js` - Interactive configuration UI
  - `cli/run-analysis.js` - Full production analysis automation
  - `cli/tests/` - Automated test scripts for various workflows
- `utils/` - Utility functions
  - `utils/models.js` - **Centralized model configuration** (source of truth for all model IDs, names, and capabilities)
- `docs/` - VitePress documentation site
- `lib/briefing/` - **Phase B** briefing utility code
  - `lib/briefing/filterBriefings.js` - Pure filter function for sidebar search (dateRange / starredOnly / query)
- `styles/` - Global styles
  - `styles/globals.css` - Tailwind directives + base resets + token/shell/briefing imports
  - `styles/tokens.css` - **Phase B** global design tokens (warm palette colors, typography, spacing, app-chrome tokens) in both light and `[data-theme=dark]` variants
  - `styles/shell.css` - **Phase B** sidebar + main-area flexbox layout (`.shell`, `.shell-sidebar`, `.shell-main`, `.briefing-surface`, `.config-surface`)
  - `styles/briefing.css` - `.briefing-prose`-scoped typography rules (consumes tokens from tokens.css)
- `vitest.config.mjs` - **Phase 1** Vitest configuration (jsdom env, React plugin, 68ch measure)
- `reports/` - **Runtime state** (gitignored): generated analysis reports, NotebookLM documents, and podcasts. Historical outputs accumulate here across runs. See "Runtime state directories" below.
- `temp/` - **Runtime state** (gitignored): Playwright browser profiles + cached PDF downloads. See "Runtime state directories" below.

### Runtime state directories

`reports/` and `temp/` are **not source code** — they hold runtime state generated by CLI/API workflows. They are gitignored but must remain at the repo root because `cli/run-analysis.js`, `cli/notebooklm-automation.js`, and `pages/api/analyze-pdf.js` reference them via paths relative to `process.cwd()`.

**`reports/`** - Historical analysis outputs organized by date. Each run writes a markdown report, optional NotebookLM document, and optional podcast audio. Can grow large over time (current: ~730 MB). Safe to manually prune old monthly subdirectories or individual report folders you no longer need.

**`temp/`** - Three persistent Playwright browser profiles plus cached PDFs:

- `temp/playwright-profile/` - Chromium profile holding arXiv cookies + reCAPTCHA bypass state. **Do NOT delete** — losing it forces re-solving reCAPTCHA on the next PDF download run.
- `temp/browser-profile/` - Aparture web-UI automation profile used by `cli/browser-automation.js`.
- `temp/notebooklm-profile/` - Google NotebookLM session cookies (largest by far). **Do NOT delete** — losing it forces an interactive Google re-login on the next podcast run.
- `temp/*.pdf`, `temp/individual/`, `temp/screenshots/`, `temp/test-screenshots/` - Cached PDFs and automation artifacts. Safe to prune freely.

**Phase 2 migration:** per the design spec §5, both directories move to `~/aparture/{reports,cache}/` when Electron is introduced, so the repo root becomes source-only. Until then, treat them as local scratch space that happens to live inside the repo.

### API Integration

The application integrates with multiple LLM APIs:

- **Anthropic**: Claude models (Opus 4.6, Sonnet 4.5, Haiku 4.5)
- **OpenAI**: GPT-5 models (GPT-5.2, Mini, Nano)
- **Google**: Gemini models (3 Pro, 3 Flash, 2.5 Pro, 2.5 Flash, 2.5 Flash-Lite)

**IMPORTANT**: All model names, IDs, and configurations are defined in `utils/models.js`. When adding or updating models:

1. Update `MODEL_REGISTRY` with the correct API model ID
2. Update `AVAILABLE_MODELS` with user-facing metadata
3. Ensure consistency between web interface and CLI automation
4. Refer to official provider documentation for accurate model names and pricing

API routes in `pages/api/` handle:

- `quick-filter.js` - Fast YES/NO/MAYBE filtering of papers (Stage 1)
- `score-abstracts.js` - Batch processing of paper abstracts for relevance scoring (Stage 2)
- `rescore-abstracts.js` - Post-processing for score consistency across papers
- `analyze-pdf.js` - Deep PDF analysis with summarization (Stage 3)
  - Implements automatic fallback: tries direct fetch first, uses Playwright if reCAPTCHA detected
  - Rate-limited PDF downloads (2-second delay between papers)
- `generate-notebooklm.js` - Generate NotebookLM-optimized documents for podcast creation
- `synthesize.js` - **Phase 1** Cross-paper synthesis into a structured briefing. Loads `prompts/synthesis.md`, renders with profile/papers/history, calls the chosen LLM with provider-native structured output, validates via `lib/synthesis/validator.js`, runs a two-pass repair via `lib/synthesis/repair.js` if validation fails. Returns a typed briefing object for `components/briefing/BriefingView.jsx` to render.
- `analyze-pdf-quick.js` - **Phase 1** Compresses an existing per-paper full technical report into a ~300-word pre-reading summary using a smaller/cheaper model. Used by the Generate Briefing flow to populate the inline-expansion quick summaries.
- `suggest-profile.js` - **Phase 1.5** Accepts `{currentProfile, feedback, briefingModel, provider, apiKey|password}`, loads `prompts/suggest-profile.md`, calls the LLM via `lib/llm/callModel.js` with a zod schema for structured output, runs two-pass repair on validation failure, returns `{revisedProfile, changes, noChangeReason?}`. Used by the SuggestDialog in the manual memory loop.

**Auth pattern:** All API routes (including the new Phase 1 ones) accept EITHER a client-supplied `apiKey` (for future BYOK flows) OR a `password` field validated against `process.env.ACCESS_PASSWORD`. When `password` is provided, the route reads the env-var key for the requested provider (`CLAUDE_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENAI_API_KEY`). The existing web UI uses the password path; Phase 2's Electron app will use the client-supplied apiKey path from OS keychain.

**Phase 1.5 note:** The config now has a separate `briefingModel` field distinct from `pdfModel`. `briefingModel` drives `/api/synthesize` and `/api/suggest-profile`, while `pdfModel` continues to drive Stage 3 `/api/analyze-pdf`. Both default to the same model on first run, but can be tuned independently.

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

1. **Quick Filter** (Optional Stage 1): Fast YES/NO/MAYBE filtering to reduce paper volume
2. **Abstract Scoring** (Stage 2): Detailed relevance scoring (0-10 scale) with justifications
3. **Post-Processing** (Optional): Re-score papers for consistency using comparative analysis
4. **PDF Analysis** (Stage 3): Deep analysis of top papers with full PDF content
5. **Report Generation**: Export comprehensive markdown report (existing, unchanged)
6. **NotebookLM Integration**: Generate structured documents optimized for podcast creation (existing, unchanged)
7. **Briefing Generation (auto, with optional pause)**: After PDF analysis, the pipeline auto-generates a briefing via `briefingClient.js`. If `pauseBeforeBriefing` is on (default), the pipeline pauses at `'pre-briefing-review'` to let the user review results and add stars/dismissals before generating. Quick summaries are generated in parallel (5-at-a-time), then `/api/synthesize` produces a structured briefing, `/api/check-briefing` audits for hallucinations (results persisted in `generationMetadata`), and the briefing is saved and rendered via `<BriefingView>`.

### CLI Automation

The `cli/` directory provides complete browser automation for unattended analysis runs.

**Core Components:**

- `server-manager.js` - Manages Next.js dev server lifecycle (start/stop/cleanup)
- `browser-automation.js` - Playwright wrapper for Aparture UI automation
- `notebooklm-automation.js` - Playwright wrapper for Google NotebookLM automation
- `notebooklm-prompts.js` - Prompt parsing utilities for NOTEBOOKLM_PROMPTS.md
- `config-manager.js` - Configuration persistence and management
- `setup.js` - Interactive configuration UI for first-time setup
- `run-analysis.js` - Full production analysis automation with podcast generation

**Production Usage:**

```bash
# First time: Configure settings interactively
npm run setup

# Run analysis (uses saved configuration)
npm run analyze            # Full workflow: report + document + podcast
npm run analyze:report     # Report only (skip NotebookLM features)
npm run analyze:document   # Report + NotebookLM document (skip podcast)
npm run analyze:podcast    # Podcast only (skip analysis, use existing files)

# Testing
npm run test:dryrun        # Mock API test
npm run test:minimal       # Real API test (3 papers)
```

**Features:**

- **Persistent Configuration**: Settings saved in browser localStorage between runs
- **Unattended Execution**: Fully automated from start to completion
- **Multi-Stage Monitoring**: Tracks fetching → filtering → scoring → post-processing → pdf-analysis stages
- **NotebookLM Integration**: Optional podcast-optimized document generation
- **Podcast Automation**: Uploads files to NotebookLM and generates audio overview with custom prompts
- **Google Authentication**: Interactive login on first podcast generation, cached thereafter
- **Progress Screenshots**: Captures state at key milestones
- **Report Verification**: Validates downloaded reports for completeness
- **Cross-Platform**: Works on Windows, Linux, and WSL

### Testing Features

- **Mock Dry Run**: Complete workflow testing with simulated API responses
- **Minimal API Test**: Small-scale testing with real API calls (3 papers)
- **Visual Indicators**: Clear "TEST MODE" badges when using mock data
- **Comprehensive Mock API**: Tests error handling, retries, and edge cases

### Profile + Briefing Pipeline (Phase 1 + 1.5)

Phase 1 added a cross-paper synthesis stage and a magazine-quality briefing UI, all additive to the existing pipeline:

**Backend data flow:**

1. `pages/api/synthesize.js` loads `prompts/synthesis.md` as a template
2. `lib/synthesis/renderPrompt.js` substitutes `{{profile}}`, `{{papers}}`, `{{history}}` placeholders
3. `lib/llm/callModel.js` dispatches to the chosen provider via `lib/llm/structured/<provider>.js`, using provider-native structured output (Anthropic `tool_use`, Google `responseSchema`, OpenAI `response_format` strict)
4. `lib/synthesis/validator.js` runs zod schema validation + citation validation (every `arxivId` must be in the input list)
5. `lib/synthesis/repair.js` asks the LLM to fix the briefing if validation fails (two-pass)
6. The API returns a structured briefing object

**Frontend data flow:**

1. Pipeline's `startProcessing` in `lib/analyzer/pipeline.js` auto-calls `runBriefingGeneration` from `lib/analyzer/briefingClient.js` after PDF analysis completes (with optional `pauseBeforeBriefing` gate)
2. `briefingClient.js` calls `/api/analyze-pdf-quick` in parallel (5-at-a-time) to generate per-paper quick summaries, then `/api/synthesize` with the profile + papers + recent history, then `/api/check-briefing` to audit for hallucinations (results persisted in `generationMetadata`), then optionally retries synthesis with a retry hint
3. Saves via `hooks/useBriefing.js` (localStorage, 90-day window, ID-keyed entries supporting multiple briefings per day)
4. `App.jsx` navigates to the new briefing via `stableSaveBriefingAndSwitch`; renders via `components/briefing/BriefingView.jsx`

**To tune synthesis quality:** edit `prompts/synthesis.md`. Changes take effect on the next `/api/synthesize` call — no rebuild needed. The 150-line prompt is the single most important quality knob for Phase 1.

**To add a new LLM provider:** add an entry to `lib/llm/providers.js`, create `lib/llm/structured/<provider>.js` following the existing anthropic/google/openai template, and add a branch in `lib/llm/callModel.js`. ~100 lines of new code.

**To change briefing visual design:** edit `styles/briefing.css`. Palette tokens (`--aparture-*`) are referenced by class name in the React components, so color changes propagate without touching `.jsx`.

**Testing LLM-backed code:** all tests are fixture-based. `lib/llm/hash.js` produces a deterministic input hash; cached responses live at `tests/fixtures/llm/<hash>.json`. To add a new fixture, run the helper at `tests/fixtures/synthesis/generate-sample.mjs` or use the `beforeAll` pattern in existing integration tests. The entire suite runs in ~30s and costs $0 because no real LLM calls are made.

### Phase 1.5 Additions

- **Unified profile field.** The old "Research Profile" (Phase 1) and "Scoring Criteria" (pre-Phase 1) textareas are replaced by a single "Your Profile" panel at the top of the app. Every pipeline stage (quick-filter, score-abstracts, rescore-abstracts, analyze-pdf, generate-notebooklm, synthesize) reads `profile.content` from `useProfile`.
- **Four feedback types.** Stars, dismisses, per-paper comments, and freeform general comments — all persisted in `aparture-feedback` localStorage via `useFeedback`. Star/dismiss are latest-wins per paper; comments are append-only.
- **Suggest-improvements flow.** `/api/suggest-profile` accepts the current profile + accumulated feedback and returns a revised profile with per-change rationales, or a `noChangeReason` if the feedback doesn't point to a clear gap. SuggestDialog surfaces the diff and lets the user accept or reject. The Your Profile page shows a feedback breakdown (stars, dismisses, comments, overrides) as helper text.
- **Smart feedback cap.** All stars/dismisses are always included in the suggest-profile prompt; comments are capped at most-recent N per type (default 30). Transparent notice in the dialog when trimming fires.
- **`briefingModel` config slot.** Separate from `pdfModel`. Drives synthesize + suggest-profile. Defaults to pdfModel on first run.
- **ProactiveQuestionPanel deleted.** The Phase 1 stub for LLM-initiated questions is removed; Phase 1.5 uses a manual Suggest improvements button instead.

**To tune suggest-improvements quality:** edit `prompts/suggest-profile.md`. Takes effect on the next suggest call — no rebuild needed.

**To add a new feedback type:** extend the event type union in `hooks/useFeedback.js`, add a variant in `components/feedback/FeedbackItem.jsx`, and add a new section in `lib/profile/suggestPrompt.js`'s `renderFeedbackSection`.

### Phase 1.5.1 Additions

- **Filter visibility + override.** The quick-filter prompt now returns a one-sentence summary + justification per paper (previously just YES/MAYBE/NO). The UI displays both and adds a click-cycle pill that lets users override the verdict; overrides are recorded as a fifth `filter-override` feedback event type, which flows into the suggest-profile prompt as a "profile may be too narrow/broad" signal.
- **Feedback on results list.** The star/dismiss/+comment affordance is no longer gated on generating a briefing first — it's now available on every paper in the Analysis Results list as soon as deep analysis completes.
- **Briefing hallucination check + retry.** After synthesis, `/api/check-briefing` audits the briefing against the source corpus and returns a YES/MAYBE/NO verdict. User-configurable retry criteria (checkboxes in Settings) trigger a second synthesis pass with a retry hint when the check fails. Flagged claims are surfaced in a disclosure below the briefing button.
- **NotebookLM uses briefing as editorial context.** When a briefing exists, `/api/generate-notebooklm` receives the briefing's executiveSummary + themes as an EDITORIAL CONTEXT block in the prompt, shaping narrative emphasis without being treated as a source.
- **Layout reshuffle.** Results → Download Report → Briefing → NotebookLM (NotebookLM only visible after briefing exists). Report no longer auto-downloads on completion.
- **Analyzer module split (F-pass).** `components/ArxivAnalyzer.js` dropped from ~5200 → ~925 lines (−82%). See "Analyzer module split" below for the architecture.

### Analyzer module split

The analysis pipeline lives in extracted modules, each unit-testable in isolation:

- **Pipeline (`lib/analyzer/pipeline.js`):** a builder function `createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef})` that returns `{startProcessing, runDryRunTest, runMinimalTest, generateNotebookLM}`. Reads state from Zustand store via `useAnalyzerStore.getState()`. Owns every analysis stage (fetchPapers, performQuickFilter, scoreAbstracts, postProcessScores, analyzePDFs, runBriefingGeneration) and their helpers (makeRobustAPICall, waitForResume, the arXiv query stack). Auto-generates briefing at the end of `startProcessing` with optional `pauseBeforeBriefing` and `pauseAfterFilter` gates.
- **Mock API (`lib/analyzer/mockApi.js`):** `MockAPITester` class with a DI constructor taking `{abortControllerRef, pauseRef, waitForResume}`. No React imports.
- **Briefing client (`lib/analyzer/briefingClient.js`):** `runBriefingGeneration()` orchestrates the full briefing flow. Takes primitive config values (`briefingModel`, `pdfModel`, `briefingRetryOnYes`, `briefingRetryOnMaybe`) as explicit params. Merges hallucination check results into `generationMetadata` before saving.
- **Report export (`lib/analyzer/exportReport.js`):** `buildReportMarkdown()`, `downloadBlob()`, `exportAnalysisReport()`.
- **Persistence (`hooks/useAnalyzerPersistence.js`):** load-on-mount effect + debounced save effect + `DEFAULT_CONFIG` (includes `pauseAfterFilter: true`, `pauseBeforeBriefing: true`) + `readInitialConfig` (used as lazy useState initializer).

**How App.jsx wires the pipeline:** creates the pipeline once via `useMemo(() => createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef}), [])`. The pipeline reads all state from `useAnalyzerStore.getState()` (including the `reactContext` slice which holds React-hook-derived values like profile, config, saveBriefing, briefingHistory). `App.jsx` publishes these into the Zustand store's `reactContext` on every render. Pipeline stage handlers (`startProcessing`, `runDryRunTest`, etc.) are destructured from the memoized pipeline object and passed down to `ControlPanel` as callbacks.

**To add a new pipeline stage:**

1. Add the stage function inside `createAnalysisPipeline` in `lib/analyzer/pipeline.js`, reading its deps from `store()` and `store().reactContext`.
2. If it calls sibling stages, declare it after its dependencies.
3. Wire it into `startProcessing`.
4. If it reads a new React-hook value, add the key to the `reactContext` publish in `App.jsx`.

**To unit-test a pipeline stage:** mock the Zustand store via `useAnalyzerStore.setState(...)` with the required state, then call `createAnalysisPipeline({...refs})` and invoke the returned handler. Internal stages aren't exported — test them via `startProcessing` with mocked API responses.

### Refactor Context (design spec + implementation plan)

The design spec, implementation plan, and per-batch execution reports for the Phase 1 refactor live at:

- `docs/superpowers/specs/2026-04-13-aparture-refactor-design.md` - Full design doc (positioning, architecture, scope, v1/v2/v2.1/stretch, migration plan)
- `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md` - 32-task TDD implementation plan for Phase 1
- `docs/superpowers/plans/2026-04-13-aparture-phase-1-acceptance-checklist.md` - 2-week user acceptance gate criteria
- `docs/superpowers/execution-logs/` - Per-batch reports documenting how Phase 1 was built

**Phase 2 is planned but not scoped in detail yet** — see spec §11 for the high-level list: Electron wrapper, filesystem-first state (`~/aparture/`), OS keychain via `keytar`, first-run wizard, memory loop, daily scheduler, full NotebookLM ZIP bundle, HTML export, cross-platform installers. Phase 2 will need its own detailed implementation plan written before execution begins.

These `docs/superpowers/` files may be moved out of version control as part of an ongoing cleanup — check for their existence before referencing them.

### ArXiv PDF Download Handling

The application includes robust PDF download handling to work around arXiv's bot protection:

**Automatic Fallback System:**

1. **Direct Fetch** (Primary): Attempts standard HTTP fetch with User-Agent header
2. **reCAPTCHA Detection**: Checks response for PDF magic bytes (`%PDF-`)
3. **Playwright Fallback** (Automatic): If HTML/reCAPTCHA detected, uses Playwright with persistent browser context
   - Launches headless Chromium with saved cookies/session
   - Navigates to abstract page, then fetches PDF with browser context
   - Bypasses reCAPTCHA using legitimate browser session

**Implementation Details:**

- Rate limiting: 2-second delay between PDF downloads
- Persistent browser profile stored in `temp/playwright-profile/`
- Automatic retry on failure
- Detailed logging for debugging

**Known Issues:**

- arXiv may trigger reCAPTCHA after multiple rapid PDF downloads
- Playwright fallback adds ~5-10 seconds per PDF but reliably bypasses blocks
- First Playwright download may be slower while setting up browser profile

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

## Model Information (Source of Truth)

**Always refer to `utils/models.js` for accurate model information.**

**Model slots:** `filterModel` (Stage 1 quick filter), `scoringModel` (Stage 2 abstract scoring), `pdfModel` (Stage 3 deep analysis), `briefingModel` (Phase 1.5 — synthesis + suggest-profile), `notebookLMModel` (NotebookLM document generation).

Current models (as of April 2026). The user-facing ID (left) is what goes into `MODEL_REGISTRY` and the UI; the API ID (right) is what gets sent to the provider.

**Anthropic — current:**

- Claude Opus 4.7: `claude-opus-4.7` → `claude-opus-4-7` (1M context, $5/$25 per MTok, adaptive thinking)
- Claude Opus 4.6: `claude-opus-4.6` → `claude-opus-4-6` (1M context, $5/$25 per MTok)
- Claude Sonnet 4.6: `claude-sonnet-4.6` → `claude-sonnet-4-6` (1M context, $3/$15 per MTok)
- Claude Haiku 4.5: `claude-haiku-4.5` → `claude-haiku-4-5` (200k context, $1/$5 per MTok)

**Anthropic — legacy (still available):**

- Claude Opus 4.5: `claude-opus-4.5` → `claude-opus-4-5`
- Claude Opus 4.1: `claude-opus-4.1` → `claude-opus-4-1`
- Claude Sonnet 4.5: `claude-sonnet-4.5` → `claude-sonnet-4-5`
- Claude Haiku 3.5: `claude-haiku-3.5` → `claude-3-5-haiku-20241022`

**Anthropic adaptive thinking:** All Anthropic API calls now include `thinking: {type: "adaptive"}`. With thinking enabled, `tool_choice` must be `{type: "auto"}` (forced tool choice is incompatible with thinking). The model still calls the provided tool reliably. `parseAnthropicResponse` skips `thinking` content blocks. Default `maxTokens` raised to 16000 to accommodate thinking overhead.

**OpenAI (GPT-5.4 family):**

- GPT-5.4: `gpt-5.4` (1M context)
- GPT-5.4 Mini: `gpt-5.4-mini` (400k context)
- GPT-5.4 Nano: `gpt-5.4-nano` (400k context)

**Google — Gemini 3.x previews:**

- Gemini 3.1 Pro (Preview): `gemini-3.1-pro` → `gemini-3.1-pro-preview`
- Gemini 3 Flash (Preview): `gemini-3-flash` → `gemini-3-flash-preview`
- Gemini 3.1 Flash-Lite (Preview): `gemini-3.1-flash-lite` → `gemini-3.1-flash-lite-preview`

**Google — Gemini 2.5 stable:**

- Gemini 2.5 Pro: `gemini-2.5-pro`
- Gemini 2.5 Flash: `gemini-2.5-flash`
- Gemini 2.5 Flash-Lite: `gemini-2.5-flash-lite`

**Not currently in the registry:** OpenAI o-series (`o3`, `o4-mini`, etc.) and xAI Grok. Adding Grok would require a new `lib/llm/structured/xai.js` adapter because xAI's OpenAI-compatible endpoint may not honor `response_format: json_schema` strict mode the same way.

When updating documentation or code, verify current model names and pricing via:

- Anthropic: https://platform.claude.com/docs/en/docs/about-claude/models
- OpenAI: https://developers.openai.com/api/docs/models
- Google: https://ai.google.dev/gemini-api/docs/models

## Phase B — Web UX Redesign (SHIPPED)

Phase B shipped the sidebar + main-area layout, warm unified palette (Source Serif 4 + Inter + arXiv red), light/dark theme toggle, component primitives, Zustand state management, 90-day briefing archive with search/filter/delete/archive, per-briefing provenance (GenerationDetails with hallucination audit), Welcome page, and pipeline pause gates (`pauseAfterFilter`, `pauseBeforeBriefing`).

**Design docs:** `docs/superpowers/specs/2026-04-15-phase-b-web-ux-redesign-design.md`
**Implementation plans:** `docs/superpowers/plans/2026-04-15-phase-b-core-1.md`, `docs/superpowers/plans/2026-04-15-phase-b-core-2.md`

**Out of scope / deferred to Phase 2:** Electron packaging, responsive/mobile, keyboard shortcuts, daily scheduler/automation, cloud sync.
