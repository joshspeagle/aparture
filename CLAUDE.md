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

- `pages/` - Next.js pages and API routes
  - `pages/api/` - Backend API endpoints for LLM integrations
  - `pages/index.js` - Main application entry point
  - `pages/_app.js` - App shell; wraps routes with next/font CSS variables for the briefing typography
- `components/` - React components
  - `components/shell/` - Root shell: `App.jsx` (entry point — owns all hook calls, Zustand selectors, pipeline creation, and the sidebar + main-area layout), `Sidebar.jsx`, `SidebarBriefingList.jsx`, `MainArea.jsx`
  - `components/ui/` - Warm-palette primitive library: `Button.jsx` (primary/secondary/ghost), `Card.jsx`, `Input.jsx`, `TextArea.jsx`, `Select.jsx`, `Checkbox.jsx`. All use inline styles with `var(--aparture-*)` CSS variables
  - `components/run/` - `ProgressTimeline.jsx` — 6-stage vertical timeline for live pipeline progress display with filter-override and pre-briefing-review pause support
  - `components/welcome/` - `WelcomeView.jsx` — persistent getting-started reference page
  - `components/analyzer/` - `ControlPanel.jsx`
  - `components/briefing/` - Briefing reading view (BriefingView root + 10 leaf components) + `BriefingCard.jsx` + `GenerationDetails.jsx` (collapsible per-briefing provenance disclosure including hallucination audit)
  - `components/filter/` - `FilterResultsList.jsx` with inline FilterResultRow + cycle-verdict pill for filter overrides
  - `components/notebooklm/` - `NotebookLMCard.jsx` (rendered as disclosure below briefing)
  - `components/profile/` - Your Profile panel: YourProfile, MigrationNotice, HistoryDropdown, SuggestDialog, DiffPreview (StatusRow + PreviewPanel are unused legacy files)
  - `components/feedback/` - Feedback panel: FeedbackPanel, FeedbackHeader, FeedbackFilters, GeneralCommentInput, FeedbackTimeline, FeedbackItem, FeedbackEmptyState + `eventMeta.js`
  - `components/results/` - results-list cards (AnalysisResultsList, DownloadReportCard)
  - `components/settings/` - SettingsPanel with "Review & confirmation" section (`pauseAfterFilter` + `pauseBeforeBriefing` + briefing retry checkboxes)
- `lib/` - Backend and analyzer library code
  - `lib/analyzer/` - Extracted analyzer internals (see "Analyzer module split" below)
    - `pipeline.js` - `createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef})` builder. Reads state from Zustand store via `useAnalyzerStore.getState()`. Owns every analysis stage (fetchPapers, performQuickFilter, scoreAbstracts, postProcessScores, analyzePDFs, runBriefingGeneration) plus helpers (makeRobustAPICall, waitForResume, the arXiv query stack). Returns `{startProcessing, runDryRunTest, runMinimalTest, generateNotebookLM}`. Auto-generates briefing at end of `startProcessing` with optional `pauseBeforeBriefing` and `pauseAfterFilter` gates.
    - `mockApi.js` - `MockAPITester` class with a DI constructor taking `{abortControllerRef, pauseRef, waitForResume}`. No React imports.
    - `briefingClient.js` - `runBriefingGeneration()` orchestrates quick-summary fan-out → synthesize → hallucination check → retry → saveBriefing (with generationMetadata including hallucination verdict/justification/flaggedClaims) → last-run cache. Takes primitive config values (`briefingModel`, `pdfModel`, `briefingRetryOnYes`, `briefingRetryOnMaybe`) as explicit params.
    - `exportReport.js` - `buildReportMarkdown()` + `downloadBlob()` + `exportAnalysisReport()` glue.
  - `lib/llm/` - LLM provider abstraction (callModel, providers, hash, fixtures, tokenBudget, resolveApiKey). `callModel.js` logs every live-mode call to the terminal (`Sending request to <Provider>: {model, promptLength, structured, cacheable?, hasPdf?}`), plus a follow-up `[<provider> cache] read=N create=N` line when the response reports cache-hit tokens.
  - `lib/llm/structured/` - Per-provider structured-output shaping (anthropic/google/openai). Each adapter accepts optional `pdfBase64` for native PDF content blocks and `cacheable`/`cachePrefix` for Anthropic prompt caching.
  - `lib/synthesis/` - Briefing generation (schema, validator, repair, renderPrompt)
  - `lib/profile/` - Profile utilities (migrations, diff, feedbackCap, suggestPrompt)
  - `lib/briefing/` - Briefing utility code
    - `lib/briefing/filterBriefings.js` - Pure filter function for sidebar search (dateRange / starredOnly / query)
- `prompts/` - Editable LLM prompt templates (changes take effect on next call — no rebuild needed)
  - `prompts/synthesis.md` - Synthesis prompt (the main quality knob — edit to tune briefings)
  - `prompts/analyze-pdf-quick.md` - Quick-summary compression prompt
  - `prompts/suggest-profile.md` - Prompt template for the suggest-improvements flow
  - `prompts/check-briefing.md` - Hallucination-audit prompt for the retry loop
- `hooks/` - React hooks with localStorage persistence
  - `hooks/useProfile.js` - Research profile hook (structured data model with versioned history). `profile.content` is read by every pipeline stage.
  - `hooks/useBriefing.js` - Briefing archive with 90-day rolling window. Entries keyed by unique ID + timestamp (multiple briefings per day supported). `saveBriefing(date, briefing, metadata)` returns the new entry's ID. `deleteBriefing(id)`, `toggleArchive(id)` for managing history. `generationMetadata` carries profile snapshot, model IDs, filter verdicts, hallucination check results.
  - `hooks/useFeedback.js` - Feedback event store persisting to `aparture-feedback` localStorage with latest-wins star/dismiss semantics. Five event types: `star`, `dismiss`, `paper-comment`, `general-comment`, `filter-override`. Star/dismiss are latest-wins per paper; comments are append-only.
  - `hooks/useAnalyzerPersistence.js` - Owns `DEFAULT_CONFIG` (includes `pauseAfterFilter: true`, `pauseBeforeBriefing: true`), `readInitialConfig` (used as lazy useState initializer), load-on-mount effect, and the debounced save effect for `arxivAnalyzerState`
  - `hooks/useTheme.js` - Light/dark/auto theme switching; reads/writes `aparture-theme` localStorage key, applies `data-theme` attribute to `<html>`
- `stores/` - Zustand state management
  - `stores/analyzerStore.js` - Central Zustand store replacing ~28 useState calls. 9 slices (processing, results, filterResults, processingTiming, testState, notebookLM, briefingUI, auth, reactContext). Pipeline reads from `useAnalyzerStore.getState()` directly.
- `tests/` - Vitest test suite (394 tests across 62 files, fully fixture-based)
  - `tests/unit/` - Pure-function tests (llm/_, synthesis/_, hooks/\*)
  - `tests/component/` - React component tests via @testing-library/react
  - `tests/integration/` - API route handler tests with fixture-mode callModel
  - `tests/fixtures/llm/` - Cached LLM responses keyed by input hash
  - `tests/fixtures/briefing/` - Sample structured briefing for BriefingView test
- `cli/` - Command-line interface tools and browser automation **(scheduled for deletion in Phase 2)**
  - `cli/server-manager.js` - Next.js development server lifecycle management
  - `cli/browser-automation.js` - Playwright-based browser automation wrapper
  - `cli/notebooklm-automation.js` - Google NotebookLM automation wrapper
  - `cli/config-manager.js` - Configuration persistence
  - `cli/setup.js` - Interactive configuration UI
  - `cli/run-analysis.js` - Full production analysis automation
  - `cli/tests/` - Automated test scripts for various workflows
- `utils/` - Utility functions
  - `utils/models.js` - **Centralized model configuration** (source of truth for all model IDs, names, and capabilities)
- `docs/` - VitePress documentation site
- `styles/` - Global styles (see "Styling conventions" below for the layering model)
  - `styles/globals.css` - Tailwind directives + base resets + token/shell/briefing imports
  - `styles/tokens.css` - Global design tokens (warm palette colors, typography, spacing, app-chrome tokens) in both light and `[data-theme=dark]` variants
  - `styles/shell.css` - Sidebar + main-area flexbox layout (`.shell`, `.shell-sidebar`, `.shell-main`, `.briefing-surface`, `.config-surface`)
  - `styles/briefing.css` - `.briefing-prose`-scoped typography rules (consumes tokens from tokens.css)
- `vitest.config.mjs` - Vitest configuration (jsdom env, React plugin, 68ch measure)
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

- `quick-filter.js` - Fast YES/NO/MAYBE filtering of papers with one-sentence summary + justification per paper (Stage 1)
- `score-abstracts.js` - Batch processing of paper abstracts for relevance scoring (Stage 2)
- `rescore-abstracts.js` - Post-processing for score consistency across papers
- `analyze-pdf.js` - Deep PDF analysis with summarization (Stage 3)
  - Implements automatic fallback: tries direct fetch first, uses Playwright if reCAPTCHA detected
  - Rate-limited PDF downloads (2-second delay between papers)
- `generate-notebooklm.js` - Generate NotebookLM-optimized documents for podcast creation. When a briefing exists, receives the briefing's `executiveSummary` + themes as an EDITORIAL CONTEXT block in the prompt, shaping narrative emphasis without being treated as a source.
- `synthesize.js` - Cross-paper synthesis into a structured briefing. Loads `prompts/synthesis.md`, renders with profile/papers/history, calls the chosen LLM with provider-native structured output, validates via `lib/synthesis/validator.js`, runs a two-pass repair via `lib/synthesis/repair.js` if validation fails. Returns a typed briefing object for `components/briefing/BriefingView.jsx` to render.
- `analyze-pdf-quick.js` - Compresses an existing per-paper full technical report into a ~300-word pre-reading summary using a smaller/cheaper model. Used by the Generate Briefing flow to populate the inline-expansion quick summaries.
- `suggest-profile.js` - Accepts `{currentProfile, feedback, briefingModel, provider, apiKey|password}`, loads `prompts/suggest-profile.md`, calls the LLM via `lib/llm/callModel.js` with a zod schema for structured output, runs two-pass repair on validation failure, returns `{revisedProfile, changes, noChangeReason?}`. Used by the SuggestDialog in the manual memory loop.
- `check-briefing.js` - Audits a briefing against the source corpus and returns a YES/MAYBE/NO hallucination verdict with justification + flagged claims. User-configurable retry criteria (checkboxes in Settings) trigger a second synthesis pass with a retry hint when the check fails.

**Auth pattern:** All API routes accept EITHER a client-supplied `apiKey` (for future BYOK flows) OR a `password` field validated against `process.env.ACCESS_PASSWORD`. When `password` is provided, the route reads the env-var key for the requested provider (`CLAUDE_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENAI_API_KEY`). The existing web UI uses the password path; Phase 2's Electron app will use the client-supplied apiKey path from OS keychain.

**Model slot separation:** The config has distinct `briefingModel` and `pdfModel` fields. `briefingModel` drives `/api/synthesize` and `/api/suggest-profile`, while `pdfModel` drives Stage 3 `/api/analyze-pdf`. Both default to the same model on first run, but can be tuned independently.

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

1. **Quick Filter** (Optional Stage 1): Fast YES/NO/MAYBE filtering to reduce paper volume. Returns a one-sentence summary + justification per paper. The UI displays both and adds a click-cycle pill for users to override the verdict; overrides are recorded as a `filter-override` feedback event, which flows into the suggest-profile prompt as a "profile may be too narrow/broad" signal.
2. **Abstract Scoring** (Stage 2): Detailed relevance scoring (0-10 scale) with justifications
3. **Post-Processing** (Optional): Re-score papers for consistency using comparative analysis
4. **PDF Analysis** (Stage 3): Deep analysis of top papers with full PDF content. Star/dismiss/+comment feedback is available on every paper in the Analysis Results list as soon as deep analysis completes (not gated on briefing generation).
5. **Report Generation**: Export comprehensive markdown report (no auto-download — user triggers via Download Report card)
6. **Briefing Generation (auto, with optional pause)**: After PDF analysis, the pipeline auto-generates a briefing via `briefingClient.js`. If `pauseBeforeBriefing` is on (default), the pipeline pauses at `'pre-briefing-review'` to let the user review results and add stars/dismissals before generating. Quick summaries are generated in parallel (5-at-a-time), then `/api/synthesize` produces a structured briefing, `/api/check-briefing` audits for hallucinations (results persisted in `generationMetadata`), and the briefing is saved and rendered via `<BriefingView>`.
7. **NotebookLM Integration**: Generate structured documents optimized for podcast creation (only visible after briefing exists).

Layout order in the main area after a run: Results → Download Report → Briefing → NotebookLM.

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
2. `briefingClient.js` calls `/api/analyze-pdf-quick` in parallel (5-at-a-time) to generate per-paper quick summaries, then `/api/synthesize` with the profile + papers + recent history, then `/api/check-briefing` to audit for hallucinations (results persisted in `generationMetadata`), then optionally retries synthesis with a retry hint
3. Saves via `hooks/useBriefing.js` (localStorage, 90-day window, ID-keyed entries supporting multiple briefings per day)
4. `App.jsx` navigates to the new briefing via `stableSaveBriefingAndSwitch`; renders via `components/briefing/BriefingView.jsx`. Flagged hallucination claims are surfaced in a disclosure (`GenerationDetails.jsx`) below the briefing.

**To tune synthesis quality:** edit `prompts/synthesis.md`. Changes take effect on the next `/api/synthesize` call — no rebuild needed. The 150-line prompt is the single most important quality knob.

**To tune suggest-improvements quality:** edit `prompts/suggest-profile.md`. Takes effect on the next suggest call.

**To add a new LLM provider:** add an entry to `lib/llm/providers.js`, create `lib/llm/structured/<provider>.js` with `build*Request` + `parse*Response` following the existing anthropic/google/openai templates (including optional `pdfBase64` + `cacheable`/`cachePrefix` handling if the provider supports them), add a branch in `lib/llm/callModel.js`, and add a unit test file under `tests/unit/llm/structured/`. ~150-200 lines of new code.

**To change briefing visual design:** edit `styles/briefing.css`. Palette tokens (`--aparture-*`) are referenced by class name in the React components, so color changes propagate without touching `.jsx`.

**To add a new feedback type:** extend the event type union in `hooks/useFeedback.js`, add a variant in `components/feedback/FeedbackItem.jsx`, and add a new section in `lib/profile/suggestPrompt.js`'s `renderFeedbackSection`.

**Testing LLM-backed code:** all tests are fixture-based. `lib/llm/hash.js` produces a deterministic input hash; cached responses live at `tests/fixtures/llm/<hash>.json`. To add a new fixture, run the helper at `tests/fixtures/synthesis/generate-sample.mjs` or use the `beforeAll` pattern in existing integration tests. The entire suite runs in ~30s and costs $0 because no real LLM calls are made.

**Test escape hatches:**

- `APARTURE_TEST_PROMPT_OVERRIDE` env var — when set, routes substitute the variable portion of the prompt with the override value so fixture hashes become deterministic regardless of input content. Routes also disable caching when this is set (so `cachePrefix`/`cacheable` fields are absent from the hashed input object).
- `_testPdfBase64` body field on `pages/api/analyze-pdf.js` — active only when `NODE_ENV === 'test'`. Injects PDF bytes directly, bypassing the Playwright / reCAPTCHA download path. Minimal fixture PDF at `tests/fixtures/pdf/minimal.pdf`.
- Expect occasional vitest worker-pool timeout "errors" in WSL environments — they're infrastructure flakes, not test failures. The test count and pass/fail summary are authoritative.

### LLM Dispatcher + Prompt Caching

All 9 LLM-calling API routes go through `lib/llm/callModel.js`. No route calls a provider API directly — the legacy inline `callClaude` / `callOpenAI` / `callGemini` helpers are gone. When adding a new LLM call, always route it through `callModel`.

**Prompt caching (Anthropic only).** Each route splits its prompt into a stable `cachePrefix` (template text + user profile) and a variable `prompt` (per-batch/per-call content). When `cacheable: true` is passed to `callModel`, the Anthropic adapter (`lib/llm/structured/anthropic.js`) emits a multi-block `content` array with `cache_control: {type: 'ephemeral'}` on the prefix block. The invariant `cachePrefix + prompt === fullRenderedPrompt` must hold byte-for-byte — test each route's split logic against a known-good rendering. OpenAI caches automatically when prompt prefixes repeat, no code changes needed. Google caching is not enabled.

**PDF content blocks.** All 3 adapters accept an optional `pdfBase64` input field. When present: Anthropic emits `{type: 'document', source: {type: 'base64', ...}}`, Google emits `{inlineData: {mimeType: 'application/pdf', ...}}` in `parts`, OpenAI switches to `/v1/responses` via `buildOpenAIResponsesRequest` (different shape from Chat Completions — parses `response.output[].content[].text`, not `output_text`).

**Cache-hit measurement.** `callModel` surfaces `cacheReadTok` / `cacheCreateTok` in its normalized return (Anthropic from `usage.cache_read_input_tokens` + `cache_creation_input_tokens`; OpenAI from `usage.prompt_tokens_details.cached_tokens`). The dispatcher logs them as `[anthropic cache] read=N create=N` so cache effectiveness is observable during a run.

**Route pattern (canonical example: `pages/api/synthesize.js`):**

- Accept `apiKey` (BYOK) OR `password` (env lookup per provider), validated before body checks
- Resolve `provider` (lowercased) from `MODEL_REGISTRY[model]?.provider` before auth
- Compute `const useCaching = provider === 'anthropic' && !isFixture && !promptOverride;` — all three conditions required
- Use conditional spread when calling: `...(useCaching ? { cachePrefix, cacheable: true } : {})` so the fields don't appear in the input object (and thus the fixture hash) when caching is off
- Accept `callModelMode` from `req.body` and pass as second arg to `callModel` (enables fixture-mode tests)

### Analyzer module split

The analysis pipeline lives in extracted modules under `lib/analyzer/` (see File Structure above for per-file summaries), each unit-testable in isolation. `App.jsx` wires the pipeline by creating it once via `useMemo(() => createAnalysisPipeline({abortControllerRef, pauseRef, mockAPITesterRef}), [])`. The pipeline reads all state from `useAnalyzerStore.getState()` — including the `reactContext` slice which holds React-hook-derived values (profile, config, saveBriefing, briefingHistory). `App.jsx` publishes these into the store's `reactContext` on every render. Pipeline stage handlers (`startProcessing`, `runDryRunTest`, `runMinimalTest`, `generateNotebookLM`) are destructured from the memoized pipeline object and passed down to `ControlPanel` as callbacks.

**To add a new pipeline stage:**

1. Add the stage function inside `createAnalysisPipeline` in `lib/analyzer/pipeline.js`, reading its deps from `store()` and `store().reactContext`.
2. If it calls sibling stages, declare it after its dependencies.
3. Wire it into `startProcessing`.
4. If it reads a new React-hook value, add the key to the `reactContext` publish in `App.jsx`.

**To unit-test a pipeline stage:** mock the Zustand store via `useAnalyzerStore.setState(...)` with the required state, then call `createAnalysisPipeline({...refs})` and invoke the returned handler. Internal stages aren't exported — test them via `startProcessing` with mocked API responses.

### CLI Automation

The `cli/` directory provides complete browser automation for unattended analysis runs.

**Core Components:**

- `server-manager.js` - Manages Next.js dev server lifecycle (start/stop/cleanup)
- `browser-automation.js` - Playwright wrapper for Aparture UI automation
- `notebooklm-automation.js` - Playwright wrapper for Google NotebookLM automation
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

### Refactor Context

Design specs and implementation plans for recent refactors live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (gitignored, local-only — check for existence before referencing). Most relevant:

- `docs/superpowers/specs/2026-04-13-aparture-refactor-design.md` - v2 design doc (positioning, architecture, scope, v1/v2/v2.1/stretch, migration plan)
- `docs/superpowers/specs/2026-04-15-phase-b-web-ux-redesign-design.md` - UX redesign (sidebar + main-area layout, warm palette, briefing archive)
- `docs/superpowers/specs/2026-04-16-notebooklm-podcast-redesign-design.md` - NotebookLM podcast redesign
- `docs/superpowers/specs/2026-04-17-llm-dispatcher-migration-caching-design.md` - LLM dispatcher + prompt caching migration
- `docs/superpowers/specs/2026-04-17-analyze-pdf-dispatcher-migration-design.md` - analyze-pdf dispatcher migration + native PDF blocks

**Phase 2 is planned but not scoped in detail yet** — see the v2 spec §11 for the list: Electron wrapper, filesystem-first state (`~/aparture/`), OS keychain via `keytar`, first-run wizard, memory loop, daily scheduler, full NotebookLM ZIP bundle, HTML export, cross-platform installers. Phase 2 will need its own detailed implementation plan written before execution begins.

## Model Information (Source of Truth)

**Always refer to `utils/models.js` for accurate model information.**

**Model slots:** `filterModel` (Stage 1 quick filter), `scoringModel` (Stage 2 abstract scoring), `pdfModel` (Stage 3 deep analysis), `briefingModel` (synthesis + suggest-profile), `notebookLMModel` (NotebookLM document generation).

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

## UX architecture

The web UI is built around a sidebar + main-area layout with a warm unified palette (Source Serif 4 + Inter + arXiv red), light/dark theme toggle (via `hooks/useTheme.js` and `data-theme` on `<html>`), component primitives in `components/ui/`, and Zustand state management in `stores/analyzerStore.js`. Briefings are archived with a 90-day rolling window including search/filter/delete/archive (see `hooks/useBriefing.js` + `lib/briefing/filterBriefings.js`). Each briefing carries provenance via `GenerationDetails.jsx` (profile snapshot, model IDs, filter verdicts, hallucination audit). A persistent `WelcomeView.jsx` serves as the getting-started reference. Pipeline pause gates (`pauseAfterFilter`, `pauseBeforeBriefing`) are configurable in `SettingsPanel.jsx`.

**Out of scope / deferred to Phase 2:** Electron packaging, responsive/mobile layout, keyboard shortcuts, daily scheduler/automation, cloud sync.
