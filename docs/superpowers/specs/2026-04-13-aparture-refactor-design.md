# Aparture v2 — Design Spec

**Date:** 2026-04-13
**Status:** Design draft. Pending user review before handoff to implementation planning.

---

## 1. Overview

**Aparture** _(aperture + arXiv)_ is a local-first research companion that brings the day's new papers into focus for working researchers. Each day, it opens the aperture wide across the user's areas of interest, narrows stage by stage through a multi-model pipeline, and ends with a substantive multimodal close-read of the papers that matter. It learns the user's interests over time — through votes, comments, and proactive check-ins — and every prompt, rule, and memory it keeps is a plain file on the user's machine. It never stores user data on anyone's servers, never charges, and works with the user's own API keys.

**Tagline:** _Bringing the arXiv into focus. A daily brief on the papers worth your two hours — and why._

**Positioning:** _"A daily research triage engine, not a feed. It tells you what's worth your two hours this week — and argues for why."_

---

## 2. Pain and user

### The user

Academic researchers, from graduate student to PI, across fields — with ML researchers as an extreme-cadence case because of the firehose pace. They have a research program. They would read 10+ papers a week carefully if they had time; they read 2 and feel under-informed. They are **not** AI-savvy power users who maintain their own model stack — they use Zotero and Python but not LLM infrastructure. They are willing to set up an API key once but will not tolerate ongoing configuration burden. They value transparency, data ownership, and being able to edit things in their own editor when they want to.

### The pain

The user is trying to keep up with their field's paper output but cannot. Existing options fail at the useful level:

- **arXiv email lists and keyword alerts:** too much noise, no triage, no synthesis
- **Semantic Scholar Research Feeds:** opaque embedding-based recommendations ("similar to what you saved"), no written-interests interface, no explanation of _why_ a paper was recommended, no cross-paper synthesis
- **Alphaxiv:** excellent per-paper blog and Deep Research, but not a daily triage layer — designed for the paper you already decided to read
- **Elicit / Consensus / Undermind:** question-answering or session-based literature review, not a daily triage loop
- **NotebookLM / ChatGPT pasted abstracts:** no persistent memory of what you care about, no feed, manual work
- **Claude Code / Cursor / custom scripts:** for the few who can build it themselves — not the target user

The gap in the market: **a daily, personalized, cross-paper triage and synthesis layer that the user owns, runs with their own LLM capability, and can edit the rules of.**

### What the user actually wants (operationally)

1. Every morning, know what happened in their areas of interest
2. Find the 3–10 papers worth deep reading this week
3. Get a substantive pre-reading summary for each so they can decide _whether_ and _how_ to engage before committing real reading time
4. Have the tool learn who they are and get better over time
5. Trust the tool — which means seeing what it's doing and why
6. Own their data

---

## 3. Positioning and differentiation

### Core positioning

**Aparture is the triage-and-synthesis layer, not the reading layer.** When you decide to actually read a paper, alphaxiv, arXiv, or your own PDF reader is where you go. Aparture's per-paper summaries serve _pre-reading decision support_ — they help you decide whether to read the paper at all — not replace reading it.

### Differentiators that actually survive contact with the market

None of these individually is a moat. The **conjunction** is:

1. **Written-interests interface, not seeds+thumbs.** Users describe what they care about in prose, and every LLM call is grounded in that prose. AI2's own SciNUP paper (Oct 2025) frames natural-language interest profiles as an _unsolved research direction_. Aparture ships it.
2. **Justified triage.** Every paper in the briefing has a per-paper "why this matters to you" statement grounded in the user's profile. Semantic Scholar gives you rankings without rationale; Aparture gives you an argument.
3. **Local-first architecture.** All data, prompts, memory, history, feedback live as plain files on the user's machine. No other LLM-era research tool in the competitive scan does this. Zotero is the closest cultural precedent — free, open source, local-first, nonprofit-run — and is the analog we should invoke explicitly.
4. **BYOK with no proxy.** Every commercial competitor bundles model spend into a subscription. Aparture users pay Google/Anthropic/OpenAI directly. The app never touches or sees the key after storage in the OS keychain.
5. **Editable prompts as first-class.** Every LLM prompt the tool uses is a plain file in `~/aparture/prompts/`. User edits take effect immediately. Novel in the research-tool category.
6. **Cross-paper synthesis in a single daily workflow.** The final output is not a list; it's a briefing with thematic sections, debates, and longitudinal connections to past runs. No competitor combines daily-cadence firehose triage with integrated cross-paper synthesis.
7. **Technical depth preserved.** The per-paper full technical reports are faithful compressed re-derivations of each paper's logic, not abstract paraphrases. This is the moat _in the actual output_, not just in the pitch. Progressive disclosure keeps the briefing readable while preserving full depth one click away.

### The Shark question

> _"Semantic Scholar is free, nonprofit, and already does daily personalized feeds with summaries. Why does Aparture exist?"_

**Defensible answer:** Semantic Scholar shows you papers a black-box embedding model thinks are similar to ones you already saved. Aparture lets you describe what you actually care about in plain English and gives you a justified, multi-stage close-read of the top hits, synthesized across papers and grounded in a memory of your taste. Aparture isn't competing on "what's new in your area"; it's competing on "what's worth your two hours this week, and here's the argument for why."

---

## 4. Core principles (non-negotiable)

1. **Your data never leaves your machine.** Except for the LLM calls the user explicitly configures — and those go directly from the user's machine to the provider the user chose, never through Aparture's infrastructure (because there is no Aparture infrastructure).
2. **BYOK.** No proxy, no subscription, no central billing.
3. **Everything is a file.** Profile, memory, prompts, feedback, history, reports — all plain text on disk, readable and editable in any text editor.
4. **Open source.** Permissive license (Apache 2.0 or MIT, decided at spec approval).
5. **Technical depth is preserved.** The per-paper full reports keep the current tool's biggest strength — dense, faithful, compressed re-derivations of each paper's actual logic.
6. **No accounts.** No sign-in, no email, no analytics, no telemetry.

---

## 5. Runtime and architecture

### Shape

Aparture v2 is a **Tauri desktop application** that ships as a single binary per platform (macOS, Windows, Linux). The frontend is a web UI (React, reusing components from the current Next.js app where possible) wrapped in a Tauri shell. The Tauri layer handles filesystem access, OS keychain integration, and — critically — local HTTP calls that bypass browser CORS restrictions.

**Why Tauri, not a static web app:**

- Filesystem is the source of truth; browsers cannot persistently access a user-chosen directory without reprompting on every session on most browsers
- OS keychain integration is only available to native apps
- Install friction is real but manageable — modern Tauri apps are ~15–30 MB and install like any desktop app
- Future-proofing for local-model integration (Ollama is deferred from v1 but v1.1+ requires unproxied HTTP calls the browser can't reliably make)

**Why not Electron:** Tauri binaries are ~10× smaller and use the OS-native webview, not a bundled Chromium.

### Directory layout

The app picks a working directory on first run (default `~/aparture/`, user can change it). Everything lives there as plain files:

```
~/aparture/
├── config.json                       # app settings: models, categories, paths, budgets
├── profile.md                        # user's research interests (prose)
├── prompts/                          # editable LLM prompt templates
│   ├── filter.md
│   ├── score-abstract.md
│   ├── rescore.md
│   ├── analyze-pdf-full.md
│   ├── analyze-pdf-quick.md
│   ├── synthesis.md
│   └── notebooklm-guide.md
├── memory/                           # model-maintained, user-approved
│   ├── interests.md
│   ├── exclusions.md
│   └── patterns.md
├── feedback/                         # per-paper user feedback
│   └── YYYY-MM/<arxiv-id>.md
├── history/                          # full audit trail per run
│   └── YYYY-MM-DD/
│       ├── fetched.jsonl
│       ├── filter.jsonl
│       ├── scoring.jsonl
│       ├── rescore.jsonl
│       ├── pdf-analysis.jsonl
│       └── synthesis.jsonl
├── reports/                          # user-facing outputs
│   └── YYYY-MM-DD/
│       ├── briefing.md
│       ├── briefing.html
│       ├── papers/
│       │   ├── <arxiv-id>-quick.md
│       │   └── <arxiv-id>-full.md
│       ├── figures/
│       │   └── <arxiv-id>/fig-N.png
│       └── bundle/                   # optional, on-demand exports
│           └── notebooklm/
├── history.jsonl                     # append-only top-level log
└── .aparture/                        # internal state (cache, version marker)
```

### Credentials

API keys are stored in the **OS keychain** (macOS Keychain, Windows Credential Vault, Linux Secret Service via libsecret). They are _not_ in `config.json` or any file in `~/aparture/`, which makes the directory safe to commit to git or back up to Dropbox without leaking credentials. The app displays an explicit indicator showing that keys are stored in the OS keychain and gives the user a way to view/replace/delete them.

### First-run onboarding wizard

The first-run experience is the most important UX in the app. The wizard walks the user through:

1. **Welcome and principles.** Short, honest: "Aparture runs on your machine, uses your own LLM provider, stores everything locally. Let's set it up."
2. **Pick a working directory.** Default `~/aparture/`, user can change. The wizard shows what will be created.
3. **Add an API key.** Deep links to each provider's key-creation page (Anthropic Console, Google AI Studio, OpenAI Platform). Inline screenshots and step-by-step instructions for each. A pre-flight "test this key" button that makes a cheap test call to verify the key works before the user commits. Key stored in OS keychain.
4. **Choose your field.** A small decision tree (ML, astro, CS theory, biology, physics, economics, humanities, cross-field, custom) that pre-populates arXiv category selections with sensible defaults. User can add/remove categories at this step.
5. **Describe your interests.** A prose textarea with a template scaffold ("I work on X. I'm interested in Y. I'm trying to keep up with Z."). This is saved as `profile.md`. The wizard offers an optional "polish this for me with an LLM" button that proposes a cleaned-up version the user can accept or reject.
6. **Pick your models.** Shows the model slots (filter, scoring, rescore, PDF, synthesis) with sensible defaults for the chosen provider. Explains in one sentence what each does. Advanced users can tune; others accept defaults.
7. **Run a first analysis.** Offered at the end — "want to run today's analysis right now to see what this looks like?" with a projected token cost estimate.

---

## 6. Pipeline

The core pipeline preserves the current architecture's shape (fetch → filter → score → PDF-analyze → output) and adds a new synthesis stage. Each stage is now **auditable**: every decision is logged to `history/YYYY-MM-DD/<stage>.jsonl` and visible in the UI.

### Stage 0 — Fetch

Query the arXiv API for papers in the user's selected categories, within the user's date range. Output: list of paper metadata (ID, title, authors, abstract, submission date, categories). Stored in `history/YYYY-MM-DD/fetched.jsonl`.

### Stage 1 — Quick filter

Batched LLM calls (default batch size 3) using `prompts/filter.md` as the prompt template. Each paper gets a `YES`/`NO`/`MAYBE` verdict **with justification**. Papers marked `NO` are excluded from subsequent stages but **their verdicts and justifications are preserved in `history/` and visible in the UI**. Users can override a `NO` verdict and push a paper back into the pipeline. Dropped: the silent rejection behavior from the current tool.

### Stage 2 — Abstract scoring

Batched LLM calls using `prompts/score-abstract.md`. Each surviving paper gets a 0–10 score on two dimensions (research alignment, paper quality), blended 50/50 by default (weights configurable). The scoring prompt receives not just `scoringCriteria` from `profile.md`, but also relevant sections of `memory/*.md` so the model has an evolving picture of the user's taste, not just a static prose blob. Justifications are captured and displayed per paper.

### Stage 3 — Optional rescore

An optional second pass using `prompts/rescore.md` that takes the top N scored papers and adjusts scores for consistency against each other. Visible in the UI: users can see which papers moved and why. In the current tool, this happens silently; in v2 it's explicit.

### Stage 4 — PDF deep analysis (full + quick)

For each paper that survives into the "deep analysis" budget (default: top 25–30 by score), the pipeline downloads the PDF (using the current tool's Playwright fallback for reCAPTCHA bypass — preserved unchanged) and runs **two analyses**:

- **Full technical report** using `prompts/analyze-pdf-full.md` on the frontier multimodal model (default: PDF slot, e.g., `gemini-3-pro`). Output: ~800–1500 words of dense, faithful re-derivation. Saved to `reports/YYYY-MM-DD/papers/<arxiv-id>-full.md`. This is the moat, preserved at full depth.
- **Quick summary** generated as a **compression of the full report** (not a second PDF read) using `prompts/analyze-pdf-quick.md` on a smaller/cheaper model (default: the scoring model, e.g., `gemini-2.5-flash`). Output: ~300 words. Saved to `reports/YYYY-MM-DD/papers/<arxiv-id>-quick.md`.

The full report is generated first; the quick summary is a derivative. No PDF is read twice.

During PDF analysis, the multimodal model is prompted to **identify figures** and return their captions, a short description, and approximate page/location. Figure extraction (pulling the actual image bytes from the PDF) is a v1 goal with progressive implementation — see §8.

### Stage 5 — Synthesis pass (new)

A single LLM call using `prompts/synthesis.md` that reads all of the contextual outputs:

- All per-paper full technical reports
- All per-paper quick summaries
- All per-paper metadata (title, score, justifications)
- `profile.md`
- Relevant `memory/*.md`
- Recent `history.jsonl` excerpts (last 7–14 days, for longitudinal connections)

The synthesis call uses **structured output** (provider-native tool-calling / function-calling / structured output, all three major providers support this). It returns a typed object — not a markdown blob — containing:

- `ExecutiveSummary` — a paragraph
- `ThemeSection[]` — each with a title, an argument, and a list of contained `PaperCard`s
- `PaperCard[]` — per-paper entries with title, arxiv link, score, one-line pitch, "why this matters to you" paragraph, figures array, links to quick/full reports
- `DebateBlock[]` — "these papers are in tension / build on each other / propose a compromise"
- `LongitudinalConnection[]` — "this is a follow-up to [paper] from [date]"
- `ProactiveQuestion[]` — 1–2 questions the model wants the user to answer to update its memory

The app validates the structured output against a schema, handles LLM quirks (missing fields, malformed blocks) by normalization or re-asking, then renders the structure into the briefing layout (see §7).

#### Token budget pre-flight

Before the synthesis call fires, the app estimates input token count using the provider's tokenizer or a local approximation. Behavior:

- `< 150k tokens` — proceed silently
- `150k – 500k tokens` — proceed with a non-blocking UI notice showing estimated cost
- `> 500k tokens` — block and offer graceful degradation: reduce final paper count, drop full reports from context (synthesize on quick summaries only), or proceed anyway (power-user override)

Thresholds are configurable in `config.json`.

---

## 7. Briefing design

The briefing is the **primary artifact** a user sees every day. It replaces both the current `arxiv_analysis_XXmin.md` and `notebooklm_YYmin.md` files with one coherent document, rendered in the app's reading view and exportable as HTML.

### Visual treatment

**Alphaxiv-blog-inspired.** Magazine-quality typography (careful serif for body text, sans-serif for UI chrome), generous margins, clear visual hierarchy, figures embedded inline with captions, subtle callouts, section headers with visible anchors. The goal is something a researcher would _want_ to read over morning coffee, not a data dump to skim and close.

Implementation: **shadcn/ui + Radix primitives + Tailwind**, plus a custom reading component library built on top of those. We do not build a design system from scratch. We spend the design effort on typography, information hierarchy, and the structured-output schema that drives what gets rendered.

### Progressive disclosure

The briefing is **readable in ~15 minutes** at the top level. Technical depth is **one click away**, not gone:

1. **Top level (briefing.md / briefing.html):** executive summary, theme sections with per-paper cards, debate blocks, longitudinal connections, proactive questions. Each paper card is ~150 words: title, score, one-line pitch, "why this matters to you" paragraph, figure thumbnails, links to quick and full.
2. **Click "quick summary" on a paper card:** the ~300-word quick summary opens inline or in a side panel. Still inside the app, still fast.
3. **Click "full technical report":** the ~800–1500-word compressed re-derivation opens. This is the deepest level Aparture provides — after this, the user clicks through to arXiv or alphaxiv to actually read the paper.

Reading-time indicators are shown per section and per expanded summary, computed as word-count / 250 wpm.

### Figure extraction (v1 goal, progressive implementation)

Three fallback layers:

1. **arXiv HTML version (preferred):** for papers that have an HTML preprint, we extract figure images directly from the HTML (arXiv's HTML versions use clean `<figure>` tags with actual image URLs). This is the cleanest path and should work for most modern ML papers.
2. **pdf.js region rendering:** when HTML isn't available, we use `pdf.js` to render the page region containing the figure (the multimodal model in Stage 4 returns approximate page/bbox during PDF analysis). The result is a raster image of the figure as it appears in the paper.
3. **Caption + description only:** when neither works, the figure card shows just the model's extracted caption and short description, with a link to open the PDF to the relevant page.

v1 ships all three tiers. Tiers 1 and 2 produce real inline images; tier 3 is a graceful fallback.

### Cross-paper synthesis sections

The `ThemeSection` and `DebateBlock` typed outputs from the synthesis pass become rich UI sections with their own typographic treatment — not just lists of papers. A debate block has a clearly labeled "Tension:" headline, a paragraph explaining the disagreement, and inline references to the involved papers.

### Longitudinal connections

The synthesis pass pulls relevant context from `history.jsonl` and produces `LongitudinalConnection` outputs when it detects a relationship. These are rendered as their own briefing section: _"Building on last week:"_, _"Follow-up to papers you starred:"_, _"Conflicts with the October 14 paper you engaged with."_ This makes the memory loop visible and visceral.

### Proactive questions

At the bottom of every briefing, 1–2 questions the model wants to ask. These are _not_ generic thinking prompts — they are specific memory-update requests:

- _"You've engaged with 3 papers on normalizing flows this week. Should I weight flow-based methods higher in scoring, or is this a temporary interest?"_
- _"This paper conflicts with your stated preference for empirical over theoretical work. Was I wrong about that, or is this a specific exception?"_

The user can answer in a textarea, dismiss, or skip. Answers are processed by a small follow-up LLM call that generates a proposed diff to `profile.md` or `memory/*.md`. **The diff is always presented for user approval before it's applied** — no silent memory updates.

---

## 8. Memory, feedback, and the learning loop

### Ship rung 2, target rung 4

**Rung 2 (v1 ship target):** The tool has a living `profile.md` and `memory/*.md` that are read into every LLM call as context. The user edits them directly or lets the model propose edits (always user-approved). The loop updates every day.

**Rung 4 (roadmap target, not v1):** The tool maintains a proactive conversational loop — it hypothesizes new topics to explore, proposes new categories to watch, flags emerging themes. This requires the memory loop to be reliable at rung 2 first, and it requires a trusted body of feedback history to draw from.

### What lives in `profile.md`

The user's written research interests in prose, in their own voice. The source document. Edited by the user (directly in a file, or via an editor panel in the app). Distilled by an LLM on request from recent feedback (with user-approved diffs).

### What lives in `memory/`

Model-maintained files that represent what the tool has _learned_ about the user beyond the static profile:

- `interests.md` — inferred specific sub-interests (e.g., _"Pays attention to papers that combine normalizing flows with astrophysical inverse problems"_)
- `exclusions.md` — things the user has consistently downvoted or ignored
- `patterns.md` — behavioral patterns (e.g., _"Engages most with papers that include ablation studies"_)

These files are updated through model-proposed diffs that the user reviews. They are never updated silently. They are plain markdown — the user can edit them at any time, and manual edits are respected.

### Feedback capture

The briefing UI includes lightweight per-paper feedback affordances:

- **Star (★)** — this is worth my time, or I'm glad you showed it to me
- **Dismiss (✕)** — not relevant, didn't need to see this
- **Note** — a free-text field for anything the user wants to record about their engagement with the paper

Feedback is stored as `feedback/YYYY-MM/<arxiv-id>.md` with a short frontmatter header and the user's notes. The feedback is append-only — editing a previously stored piece of feedback creates a new record, it doesn't overwrite history.

### History

`history.jsonl` is a top-level append-only log of every run, with pointers into `history/YYYY-MM-DD/` for stage-by-stage detail. This serves two purposes:

- **Audit trail:** the user can always trace why a paper ended up where it did
- **Context for future runs:** the synthesis pass reads recent history to generate longitudinal connections

---

## 9. Transparency

Transparency is structural in v2 — it is not a "feature" that can be toggled.

- **Every prompt is a file** in `~/aparture/prompts/`. The app ships with default prompts; users can override by editing the files. Edits take effect on the next run.
- **Every stage's decisions are logged** in `history/YYYY-MM-DD/<stage>.jsonl`. The user can open a "how did this paper end up here?" panel from any paper in the briefing and see the full trail: filter verdict, score, score adjustment, PDF analysis output, synthesis role.
- **Every LLM call is auditable.** The model name, token counts, and cost estimate per call are captured and summarized on the briefing's "run details" page.
- **Memory updates are always user-approved.** No silent learning.

---

## 10. Export and NotebookLM bundle

Aparture v2 does not automate NotebookLM. Instead, it offers a clean **manual export path** that replaces the current Playwright automation.

### NotebookLM bundle export

A button in the briefing view: "Export to NotebookLM." Produces a `.zip` file containing:

- `briefing.md` — the day's briefing
- `papers/` — all per-paper full technical reports
- `pdfs/` — the original downloaded PDFs (already present from Stage 4)
- `notebooklm-guide.md` — a pre-written user-facing document explaining how to create a NotebookLM notebook with these materials, including a suggested prompt and podcast style

The user downloads the ZIP, creates a NotebookLM notebook themselves, uploads the files, and runs the podcast generation. No Playwright, no browser profile, no UI automation fragility. The user explicitly understands that the upload goes to Google's servers (the guide document names this).

### HTML export

A button: "Export as HTML." Produces a **self-contained HTML file** (`briefing.html`) of the day's briefing that can be shared as a file attachment. Useful for emailing an advisor or sharing with a lab group. Entirely local — no hosting, no links to Aparture's infrastructure (because there isn't any).

### Stretch: podcast via TTS pipeline (post-v1)

A direct podcast feature using a TTS pipeline (ElevenLabs multi-voice dialogue, or Google Chirp 3 if accessible) is **explicitly a post-v1 stretch goal**. v2 does not ship with integrated audio generation. The manual NotebookLM export path is the v1 answer for users who want audio.

---

## 11. Scope: v1 vs v1.1 vs stretch

### v1 (ship target)

- Tauri desktop app (macOS, Windows, Linux)
- Filesystem-first architecture with `~/aparture/` directory layout
- OS keychain credential storage
- First-run onboarding wizard
- Full pipeline: fetch → filter → score → optional rescore → PDF full+quick analysis → synthesis pass with token budget pre-flight
- Structured-output briefing with rendered alphaxiv-style UI
- Figure extraction (arXiv HTML → pdf.js region render → caption-only fallback)
- Per-paper full and quick reports
- `profile.md` + `memory/*` + `history.jsonl` (rung 2 memory loop)
- Feedback capture (star/dismiss/note)
- Proactive questions with user-approved diff workflow
- Full transparency (prompts as files, stage history, audit trail)
- NotebookLM manual ZIP export
- HTML export
- Category, model, and budget configuration via UI with plain-file mirror

### v1.1 (first post-v1 priority)

- Cross-paper synthesis depth improvements (learned from early v1 usage)
- Longitudinal connections that reach further back than 14 days
- Profile distillation improvements — the "distill my interests from recent feedback" flow gets more sophisticated
- Richer figure extraction (second-pass OCR, equation rendering)
- Better reading-time estimates based on user's actual reading history

### Stretch (post-v1.1)

- TTS dialogue podcast pipeline (ElevenLabs or Chirp 3)
- Rung 3+ personalization: active learning, model asks clarifying questions at moments of low confidence during a run, not just after
- Multi-machine sync (still local-first — some kind of opt-in folder sync via iCloud/Dropbox/Syncthing, not a central server)
- Ollama integration for local-model runs — deferred from v1 because BYOK with frontier models is the priority per user decision

### Explicitly out of scope

- Central hosting, accounts, or user database
- Subscription or revenue model
- Automated NotebookLM integration (Playwright path is deleted)
- Team / collaborative features
- Mobile app

---

## 12. Migration from current codebase

The v1 refactor is **mostly a reshaping** of the current code, not a rewrite from scratch. Concrete plan:

### What to reuse largely unchanged

- **LLM integration logic** in `pages/api/*.js` — the actual Anthropic/OpenAI/Google SDK calls, retry logic, error handling, and correction prompts. These migrate into the Tauri app's internal service layer.
- **arXiv fetching logic** — the XML parser and category handling.
- **PDF download with Playwright fallback** — preserved unchanged, since it solves a real reCAPTCHA problem. In the Tauri app, Playwright becomes an optional background service the app invokes for PDF downloads only (not for NotebookLM automation, which is deleted).
- **The existing prompt templates** currently hardcoded in API routes (`quick-filter.js`, `score-abstracts.js`, `rescore-abstracts.js`, `analyze-pdf.js`) — extracted into `~/aparture/prompts/` as defaults for `filter.md`, `score-abstract.md`, `rescore.md`, and `analyze-pdf-full.md` respectively.
- **The NotebookLM document generation prompt** (`generate-notebooklm.js`) — adapted into `synthesis.md` as the starting point for the new synthesis pass, since it already produces thematic analysis and comparative insights. This is a meaningful head start on the hardest new prompt.
- **arXiv taxonomy** from `ArxivAnalyzer.js` lines 33–247 — extracted into a data file.

### What to rewrite

- **`ArxivAnalyzer.js`** (4,370 LOC monolith) — split into the Tauri app's UI component library. Not a line-by-line rewrite, but a deliberate refactor into cleanly bounded components.
- **State management** — from localStorage/component state to filesystem-backed store with in-memory view state.
- **Configuration UI** — form-based with plain-file mirror (editing in the UI writes the file; editing the file and reloading re-reads it).
- **Results display** — new structured-output rendering engine for the briefing.

### What to delete

- **`cli/notebooklm-automation.js`** (826 LOC)
- **Playwright browser profile management for NotebookLM** (not for PDF downloads, which stay)
- **`cli/run-analysis.js`** and the CLI orchestration layer — the Tauri app _is_ the orchestration now. The CLI's one remaining job (running unattended) can be supported via a small native scheduler in the Tauri app, not a separate Node process.
- **Password gate** — replaced by "you're running it on your own machine, you authenticate by being logged in."
- **Server-side API routes as an HTTP layer** — in the Tauri app, these become internal service calls. No web server runs locally unless the user wants it (for the v1.1 "share as HTML via local web server" stretch).

### Migration ordering

A rough implementation ordering (the real plan belongs in the implementation spec, not here):

1. Scaffold the Tauri shell + filesystem layout + config loading
2. Port the LLM service layer (API routes → internal services)
3. Build the new onboarding wizard + key management via keychain
4. Port the fetch + filter + score + PDF stages with new per-paper output format
5. Build the structured-output schema and synthesis stage prompt
6. Build the briefing UI with structured-output rendering
7. Implement figure extraction (tier 1 → tier 2 → tier 3)
8. Implement memory loop, feedback capture, proactive questions
9. Implement NotebookLM bundle export
10. Polish: wizard content, error states, token budget UI, audit panels
11. Cross-platform packaging + signing

---

## 13. Open questions and risks

### Open questions

- **Figure extraction tier 1 (arXiv HTML)**: coverage in practice is unknown — not every arXiv paper has a clean HTML version, and the HTML structure varies. We should measure coverage on a real week of ML papers before committing to this path as the default.
- **Synthesis pass prompt engineering**: the hardest new prompt in the refactor. We should prototype it early against real papers (not waiting for the rest of v1) to discover rough edges and adjust the structured-output schema.
- **Tauri cross-platform signing**: macOS notarization and Windows code signing are both friction points for shipping. Signing certificates cost money and have ongoing administrative overhead. Plan to address at packaging time but flag as a known cost.
- **Ollama deferred from v1** — the local-model story is a differentiator we chose to defer. If ML users complain that BYOK is expensive for daily use, Ollama becomes a v1.1 priority.
- **Longitudinal connections**: the tool's ability to say "this is a follow-up to last week's paper" depends on the memory loop being functional and on the history file being rich enough. This is a feature that gets better over time, not something v1 can ship at full quality.

### Risks

- **Scope is large.** The refactor touches almost every part of the current codebase. Strict v1 discipline is required; anything labeled "v1.1" or "stretch" must not slip into v1 without an explicit decision.
- **Synthesis pass quality is unknown.** The rest of the pipeline has working prior art (current tool); synthesis is genuinely new and its quality depends on prompt engineering we haven't done yet.
- **Onboarding wizard quality is load-bearing.** For non-AI-savvy researchers, the wizard is the make-or-break UX. If the wizard is clunky or confusing, v1 fails regardless of how good the rest is.
- **Alphaxiv moving fast.** They raised $7M in November 2025 and are building on arXiv. If they ship a daily personalized digest with Deep Research and a good mobile app before Aparture v1, the addressable audience shrinks. Mitigation: the local-first / BYOK / open-source conjunction is a moat alphaxiv cannot cross without contradicting their business model — but we shouldn't be complacent.

---

## 14. What makes this spec done

This spec is considered approved when:

1. The user has read it and confirmed the scope, principles, and v1 cut list
2. The open questions above have either been answered or explicitly parked as "decide during implementation"
3. The handoff to the `writing-plans` skill has been authorized

At that point, a separate implementation plan is drafted that translates this design into concrete engineering tasks in dependency order.
