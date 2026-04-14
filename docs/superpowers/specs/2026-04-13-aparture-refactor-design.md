# Aparture v2 — Design Spec

**Date:** 2026-04-13
**Status:** Revised after critical review. Pending user re-approval before handoff to implementation planning.
**Revision notes:** Two-phase restructuring; Electron over Tauri; positioning rewritten to lead with synthesis + longitudinal memory + faithful technical depth; arxiv-sanity-lite acknowledged as the topical precedent; briefing design section expanded with concrete direction; distribution and testing sections added; migration section restructured into port / rewrite / net-new buckets; missing v1 line items (scheduler, test harness, credential abstraction, tokenizers, structured-output retry/repair) made explicit; figure extraction tier 2 moved to v2.1; rung 2/rung 3 conflation resolved; license committed to Apache 2.0; audience language tightened.

---

## 1. Overview

**Aparture** _(aperture + arXiv)_ is a local-first research companion that brings the day's new papers into focus for working researchers. Each day, it opens the aperture wide across the user's areas of interest, narrows stage by stage through a multi-model pipeline, and ends with a substantive multimodal close-read of the papers that matter. It learns the user's interests over time — through votes, comments, and proactive check-ins — and every prompt, rule, and memory it keeps is a plain file on the user's machine. It never stores user data on anyone's servers, never charges, and works with the user's own API keys.

**Tagline:** _Bringing the arXiv into focus. A daily brief on the papers worth your two hours — and why._

**What Aparture is:** a daily research triage engine. It takes today's arXiv output in the user's fields, runs a multi-stage focusing pipeline against the user's written interests, produces a cross-paper briefing grounded in the user's history, and tells the user what's worth their attention — with an argued per-paper justification for every pick.

---

## 2. Pain and user

### The user

Academic researchers, from graduate student to PI, across fields — with ML researchers as an extreme-cadence case because of the firehose pace. They have a research program. They would read 10+ papers a week carefully if they had time; they read 2 and feel under-informed. They use Zotero, Python, and a text editor — they are comfortable installing software and configuring tools. They are _not_ LLM power users: they don't maintain their own model stack, don't follow Claude Code developments, and aren't looking for another tool to configure.

See §3.5 for the honest audience scope.

### The pain

The user is trying to keep up with their field's paper output but cannot. Existing options fail at the useful level:

- **arXiv email lists and keyword alerts:** too much noise, no triage, no synthesis
- **Semantic Scholar Research Feeds:** opaque embedding-based recommendations ("similar to what you saved"), no written-interests interface, no explanation of _why_ a paper was recommended, no cross-paper synthesis
- **alphaXiv:** excellent per-paper blog and Deep Research, but not a daily triage layer — designed for the paper you already decided to read
- **Elicit / Consensus / Undermind:** question-answering or session-based literature review, not a daily triage loop
- **NotebookLM / ChatGPT pasted abstracts:** no persistent memory of what you care about, no feed, manual work
- **arxiv-sanity-lite:** the right shape (local, free, open source, daily arXiv triage), but ships a pre-LLM TF-IDF recommender — no actual reading, no synthesis, no memory
- **Claude Code / Cursor / custom scripts:** for the few who can build it themselves — not the target user

The gap in the market: **a daily, personalized, cross-paper triage and synthesis layer that the user owns, runs with their own LLM capability, uses frontier LLMs to actually _read_ the papers, and can edit the rules of.**

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

Aparture is the **spiritual successor to arxiv-sanity-lite** — local, free, open source, daily arXiv triage — now with frontier LLMs doing the actual reading, synthesizing across papers, and learning what the user cares about. Karpathy's tool was right about the shape (runs on your box, reads arXiv daily, you own the state). Aparture keeps that shape and upgrades the cognition.

Aparture is the **triage and synthesis layer**, not the reading layer. When the user decides to actually read a paper, alphaxiv, arXiv, or their own PDF reader is where they go. Aparture's per-paper summaries serve _pre-reading decision support_ — they help the user decide whether to read the paper at all — not replace reading it.

### The moat, in priority order

None of these individually is a moat. The **conjunction** is. Priority order matters — this is how we lead, not how we decorate:

1. **Cross-paper synthesis with longitudinal memory.** Every day, Aparture produces a briefing with thematic groupings, debate blocks, and connections back to papers the user engaged with in prior weeks. No LLM-era research tool in the competitive scan does this in a single daily workflow. **This is the moat. Lead with it.**
2. **Justified triage.** Every paper in the briefing has a per-paper "why this matters to you" statement grounded in the user's prose-written profile and accumulated memory. Semantic Scholar gives rankings without rationale; Aparture gives an argument for each pick.
3. **Faithful technical depth.** The per-paper full technical reports are compressed, faithful re-derivations of each paper's actual logic — not abstract paraphrases. Progressive disclosure keeps the briefing readable while preserving full depth one click away. This is the current tool's single biggest strength, and the refactor preserves it.
4. **Natural-language interest interface.** Users describe what they care about in prose. Every LLM call is grounded in that prose. AI2's own SciNUP paper (October 2025) frames this as an open research direction. Aparture ships it.
5. **Editable prompts as plain files.** Every prompt is a file in `~/aparture/prompts/`. User edits take effect immediately. Novel in the research-tool category.

### Credibility anchors

These matter for the researchers who care about privacy and ownership, but they are not the primary pitch — they are the credentials under the headline:

- **Local-first.** All data, prompts, memory, history, feedback live as plain files on the user's machine. Zotero is the cultural precedent; arxiv-sanity-lite is the topical precedent.
- **BYOK.** Every commercial competitor bundles model spend into a subscription. Aparture users pay Google/Anthropic/OpenAI directly. The app never touches the key after storage in the OS keychain.
- **Open source** under Apache 2.0.
- **No accounts, no data hosting, no telemetry.**

### The Shark question

> _"Semantic Scholar is free, nonprofit, and already does daily personalized feeds with summaries. Why does Aparture exist?"_

**Defensible answer:** Semantic Scholar gives you papers a black-box embedding model thinks are similar to ones you've already saved. Aparture reads each new paper, writes you an argued per-paper briefing grounded in your actual research interests, synthesizes across papers to flag debates and trends, and connects today's papers to what you engaged with last week. You see every prompt it used, every rule it applied, and every update it proposes to its own memory. It runs on your laptop. You pay the providers directly. It is the research companion arxiv-sanity-lite couldn't have been before frontier LLMs existed.

---

## 3.5 Audience honesty

The target audience is **technically comfortable academic researchers**. Concretely: they use a text editor, install apps from GitHub releases, configure `.env` files for their research code, are comfortable pasting a string into a settings field, and will spend ~20 minutes on a guided one-time setup. They are _not_ LLM power users, and they are not non-technical.

What Aparture is _not_ for, at least in v1/v2:

- **Researchers who will not install software.** Semantic Scholar is better for them — free, web-hosted, works immediately. We should be honest that Aparture is not a substitute for Semantic Scholar for this audience.
- **Researchers with zero budget for LLM API calls.** The tool is useful at roughly $5–30/month of BYOK spending for daily use on Claude/Gemini. We do not promise "free forever" for heavy use. Phase 1 should include a cost-estimate panel so users know what they're spending.
- **Non-academic knowledge workers.** The arXiv focus won't serve them.

Being honest about the audience keeps us from making design decisions that serve a fictional user. The "non-AI-savvy researcher" framing in earlier drafts of this spec was aspirational; it described a v2.x audience we might reach after v2 ships and proves itself, not the v1 audience. **The real user of Phase 1 is the spec's author and ~20 technically comfortable academic colleagues.** The real user of Phase 2 is the Show HN / arxiv-sanity audience — academics who will install software from GitHub Releases and spend 20 minutes on first-run setup.

---

## 4. Core principles (non-negotiable)

1. **Your data never leaves your machine.** Except for the LLM calls the user explicitly configures — and those go directly from the user's machine to the provider the user chose, never through Aparture's infrastructure (because there is no Aparture infrastructure).
2. **BYOK.** No proxy, no subscription, no central billing.
3. **Everything is a file.** Profile, memory, prompts, feedback, history, reports — all plain text on disk, readable and editable in any text editor (Phase 2; Phase 1 uses localStorage as a transitional compromise).
4. **Open source under Apache 2.0.**
5. **Technical depth is preserved.** The per-paper full reports keep the current tool's biggest strength — dense, faithful, compressed re-derivations of each paper's actual logic.
6. **No accounts.** No sign-in, no email, no analytics, no telemetry.

---

## 5. Runtime and architecture

### Shape

**Phase 1** runs on the existing Next.js codebase. `npm install && npm run dev` starts a local server; the user opens `http://localhost:3000`. This is the current tool's shape, preserved. All new work in Phase 1 — synthesis stage, briefing renderer, structured-output validator, LLM test harness, two-level per-paper reports — happens inside the existing Next.js app. No new platform, no new framework, no porting.

**Phase 2** wraps the same Next.js app in an **Electron shell**, distributed as native installers (`.dmg`, `.exe`, AppImage) via GitHub Releases. The same codebase continues to support `npm run start` for the self-host path, so power users can always run from source.

### Why Electron (and not Tauri, pure-static, or a Node binary)

- **Tauri was the original recommendation and was wrong.** Critical review showed that Tauri's lack of Node runtime breaks Playwright (needed for PDF downloads with reCAPTCHA fallback), requires porting the LLM service layer across a Rust/JS boundary, and puts the keychain/filesystem/SDK ecosystem one step away. The ~20 MB Tauri binary advantage is a vanity number that doesn't compensate for 4–6 extra months of platform port work.
- **Electron has a full Node runtime.** Playwright, raw-fetch HTTP calls, `keytar`, filesystem access — everything "just works." The refactor is about Aparture, not about learning a new platform.
- **Electron's size (~150 MB installers, ~200–300 MB RAM)** is fine for a desktop research tool. The "Electron has a bad reputation" tax is essentially absent in the target audience, who use VS Code, Slack, Discord, Obsidian, Notion, Figma Desktop, and Zotero's new version — all Electron. They think of them as "desktop apps."
- **`electron-builder` is battle-tested** for cross-platform signing and notarization. Thousands of apps have shipped this flow; docs and reference configurations are extensive.
- **The self-host path stays first-class.** The repo _is_ the app; the Electron shell is just a different way of running it. Users who want to `git clone` can, without feeling like second-class citizens.

### Directory layout (Phase 2)

The Phase 2 app picks a working directory on first run (default `~/aparture/`, user can change it). Everything lives there as plain files:

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

### Credentials (Phase 2)

API keys stored in the **OS keychain** via `keytar`:

- macOS Keychain
- Windows Credential Vault
- Linux Secret Service (via libsecret)

Keys are _not_ in `config.json` or any file in `~/aparture/`, which makes the directory safe to commit to git or back up to Dropbox without leaking credentials. The app displays an explicit indicator showing that keys are stored in the OS keychain and gives the user a way to view/replace/delete them.

**Phase 1** uses a simpler approach: API keys entered in a settings textarea, persisted to localStorage. This is a deliberate compromise — Phase 1 is not distributed publicly; only the builder and a small number of trusted testers run it. Phase 2 replaces this with the keychain path before public distribution.

### First-run onboarding wizard (Phase 2)

The first-run experience is the most important UX in the public-launch app. The wizard walks the user through:

1. **Welcome and principles.** Short, honest: "Aparture runs on your machine, uses your own LLM provider, stores everything locally. Let's set it up."
2. **Pick a working directory.** Default `~/aparture/`, user can change. The wizard shows what will be created.
3. **Add an API key.** Deep links to each provider's key-creation page (Anthropic Console, Google AI Studio, OpenAI Platform). Inline screenshots and step-by-step instructions for each. A pre-flight "test this key" button that makes a cheap test call to verify the key works before the user commits. Key stored in OS keychain.
4. **Choose your field.** A small decision tree (ML, astro, CS theory, biology, physics, economics, humanities, cross-field, custom) that pre-populates arXiv category selections with sensible defaults. User can add/remove categories at this step.
5. **Describe your interests.** A prose textarea with a template scaffold ("I work on X. I'm interested in Y. I'm trying to keep up with Z."). This is saved as `profile.md`. The wizard offers an optional "polish this for me with an LLM" button that proposes a cleaned-up version the user can accept or reject.
6. **Pick your models.** Shows the model slots (filter, scoring, rescore, PDF full, PDF quick, synthesis) with sensible defaults for the chosen provider. Explains in one sentence what each does. Advanced users can tune; others accept defaults.
7. **Run a first analysis.** Offered at the end — "want to run today's analysis right now to see what this looks like?" with a projected token cost estimate.

The wizard supports **Back** at every step, **Cancel** at any point (which cleans up any partially-written files), and a **Skip to end** option for experienced users. All wizard state is held in memory until the user commits on the final step; no files are written until the user presses "Create my Aparture directory."

---

## 6. Pipeline

The core pipeline preserves the current architecture's shape (fetch → filter → score → PDF-analyze → output) and adds a new synthesis stage. Each stage is now **auditable**: every decision is logged to `history/YYYY-MM-DD/<stage>.jsonl` (Phase 2) or equivalent in-memory state + localStorage (Phase 1) and visible in the UI.

### Stage 0 — Fetch

Query the arXiv API for papers in the user's selected categories, within the user's date range. Output: list of paper metadata (ID, title, authors, abstract, submission date, categories). Stored in `history/YYYY-MM-DD/fetched.jsonl`.

### Stage 1 — Quick filter

Batched LLM calls (default batch size 3) using `prompts/filter.md` as the prompt template. Each paper gets a `YES`/`NO`/`MAYBE` verdict **with justification**. Papers marked `NO` are excluded from subsequent stages but **their verdicts and justifications are preserved in `history/` and visible in the UI**. Users can override a `NO` verdict and push a paper back into the pipeline. Dropped from the current tool: silent rejection.

### Stage 2 — Abstract scoring

Batched LLM calls using `prompts/score-abstract.md`. Each surviving paper gets a 0–10 score on two dimensions (research alignment, paper quality), blended 50/50 by default (weights configurable). The scoring prompt receives not just `scoringCriteria` from `profile.md`, but also relevant sections of `memory/*.md` so the model has an evolving picture of the user's taste. Justifications are captured and displayed per paper.

### Stage 3 — Optional rescore

An optional second pass using `prompts/rescore.md` that takes the top N scored papers and adjusts scores for consistency against each other. Visible in the UI: users can see which papers moved and why. In the current tool this happens silently; in v2 it is explicit.

### Stage 4 — PDF deep analysis (full + quick)

For each paper that survives into the "deep analysis" budget (default: top 25–30 by score), the pipeline downloads the PDF (using the current tool's Playwright fallback for reCAPTCHA bypass — preserved unchanged, since Electron has a Node runtime) and runs **two analyses**:

- **Full technical report** using `prompts/analyze-pdf-full.md` on the frontier multimodal model (default: PDF full slot, e.g., `gemini-3-pro`). Output: ~800–1500 words of dense, faithful re-derivation. Saved to `reports/YYYY-MM-DD/papers/<arxiv-id>-full.md`. This is the moat, preserved at full depth.
- **Quick summary** generated as a **compression of the full report** (not a second PDF read) using `prompts/analyze-pdf-quick.md` on a smaller/cheaper model (default: the scoring model, e.g., `gemini-2.5-flash`). The quick-summary prompt receives the full report + the paper's abstract + the scoring justification for grounding. Output: ~300 words. Saved to `reports/YYYY-MM-DD/papers/<arxiv-id>-quick.md`.

The full report is generated first; the quick summary is a derivative. No PDF is read twice.

During PDF analysis, the multimodal model is prompted to **identify figures** and return their captions and short descriptions. Actual figure image extraction happens after this stage (see §7 figure extraction pipeline).

### Stage 5 — Synthesis pass (net-new, the moat)

A single LLM call using `prompts/synthesis.md` that reads all of the contextual outputs for the day's run:

- All per-paper full technical reports
- All per-paper quick summaries
- All per-paper metadata (title, score, justifications)
- `profile.md`
- Relevant `memory/*.md`
- Recent `history.jsonl` excerpts (last 7–14 days, for longitudinal connections)

The synthesis call uses **provider-native structured output** — Anthropic tool_use, Google `responseSchema`, OpenAI `response_format` with strict JSON schema — none of which the current codebase uses today. This is **net-new infrastructure**, not a reshape of the existing free-text-JSON-and-shallow-validator pattern. See §12 bucket C.

The call returns a typed object containing:

- `ExecutiveSummary` — a paragraph
- `ThemeSection[]` — each with a title, an argument, and a list of contained `PaperCard`s
- `PaperCard[]` — per-paper entries with title, arxiv link, score, one-line pitch, "why this matters to you" paragraph, figures array, links to quick/full reports
- `DebateBlock[]` — "these papers are in tension / build on each other / propose a compromise"
- `LongitudinalConnection[]` — "this is a follow-up to [paper] from [date]"
- `ProactiveQuestion[]` — 1–2 questions the model wants the user to answer to update its memory

The app validates the structured output against a schema (`zod` or similar), handles LLM quirks (missing fields, malformed nested structures) by normalization or two-pass repair prompting, runs a **citation validation pass** (every `PaperCard.arxivId` must exist in the input list; every reference in a `DebateBlock` or `LongitudinalConnection` must be verified), then renders the structure into the briefing layout (see §7).

#### Token budget pre-flight

Before the synthesis call fires, the app estimates input token count using the provider's tokenizer or a local approximation (`tiktoken` for OpenAI; char-count heuristics with calibration factors for Anthropic and Google, which lack first-party JS tokenizers). Behavior:

- `< 150k tokens` — proceed silently
- `150k – 500k tokens` — proceed with a non-blocking UI notice showing estimated cost
- `> 500k tokens` — block and offer graceful degradation: reduce final paper count, drop full reports from context (synthesize on quick summaries only), or proceed anyway (power-user override)

Thresholds are configurable in `config.json`.

---

## 7. Briefing design

The briefing is the **primary artifact** a user sees every day. It replaces both the current `arxiv_analysis_XXmin.md` and `notebooklm_YYmin.md` files with one coherent document, rendered in the app's reading view and exportable as HTML.

### Visual direction — research-tool chrome, academic-print content

Aparture uses a **hybrid visual register**: research-tool chrome (sidebar, run status, settings) in a **Linear/Notion register** — sober, sans-serif, dense, grayscale-dominant with one accent — wrapping a **print-register reading surface** (the briefing itself) that looks like Stratechery or a well-typeset monograph. The UI chrome signals "this is software"; the briefing signals "you are reading, not operating." The shift between them as the user enters the briefing is a deliberate design moment — it tells the user _you are now reading, not operating_.

**Reference apps to study during implementation:**

- **Stratechery** (https://stratechery.com) — the reading register. Serif body, narrow measure, restraint with color, pull-quote style.
- **Linear** (https://linear.app) — the chrome register. Sidebar discipline, density without noise, gray-scale dominance with one accent.
- **Readwise Reader** (https://readwise.io/read) — how to make a reading surface inside an app with sidebars.
- **Are.na** (https://are.na) — academic-serious web typography without blog-era feel.
- **NYT Opinion long-form** — theme section breaks and pull-out callouts in a serious editorial register.

### Typography

- **Body** in **Source Serif 4** (17–18px, 1.65 line-height). Open, screen-tuned, strong italics, free, and has the academic weight without being Times.
- **UI chrome + card titles** in **Inter** (14px chrome, 18px titles, 1.45 line-height).
- **Monospace** in **JetBrains Mono** (13px) for arXiv IDs, model names, and debug strings.

The shift between serif body and sans titles is deliberate: card titles are **metadata**, not prose, so they read in sans. Body content is prose, so it reads in serif.

Modular-ish type scale: 13 / 14 / 15 / 17 / 20 / 24 / 32. Measure in the briefing capped at **68 characters** — single column, long scroll. **No multi-column newspaper layout.**

### Color

Near-monochromatic warm-gray palette:

- Light: bg `#fafaf7`, surface `#f4f1ea`, ink `#1a1a1a`, mute `#6b6862`, hairline `#d8d4ca`, accent `#b31b1b` (arXiv red), debate `#ede6d5`, longitudinal `#e4e8ec`, question `#efe8d8`
- Dark (opinionated parallel palette, not auto-invert): bg `#141211`, surface `#1f1c1a`, ink `#e8e4dc`, mute `#8a857c`, hairline `#2e2a26`, accent `#d94545`, plus warm/cool stones pulled toward the palette

**arXiv red is the single accent**, used only for:

- The "ar" ligature in the Aparture wordmark
- The focus ring on the active paper card
- Score badges at 9+ scores
- Nowhere else

Semantic tokens (debate, longitudinal, question) get warm or cool stone backgrounds, not color.

**No gradients. No drop shadows. No glassmorphism.** Elevation is a lie the briefing doesn't need.

### Spacing, border, motion

- Base unit 4px. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Card padding 24. Section gap 48.
- Radius 4px everywhere. Hairline borders only (1px). No rounded-2xl cards.
- Motion: 150ms ease-out for inline expansions, 220ms for side panels. No bounces.

### Component library

`shadcn/ui` + Radix primitives + Tailwind. The chrome uses shadcn's defaults; the reading surface has a hand-styled `<BriefingProse>` wrapper that sets serif type, measure, and rhythm inside which everything in the briefing renders. Tailwind's layer system keeps the print-style reading surface insulated from the shadcn chrome.

### The aperture metaphor — four placements, refused everywhere else

1. **The wordmark.** "Ap**ar**ture" with "ar" in arXiv red. The "A" glyph has subtle aperture-blade geometry in the counter, visible only at large sizes.
2. **The run-in-progress view.** When a pipeline run is executing, the screen shows a six-bladed aperture SVG that **narrows** as stages progress: fully open during fetch (e.g. 287 papers) → closing through filter (94) → score (31) → rescore (24) → near-closed at PDF analysis (5). Numbers update live beside the aperture. This is the metaphor's single biggest functional payoff: the user literally watches the arXiv come into focus.
3. **Depth-of-field on the focused card.** The currently-viewport-centered paper card gets crisp contrast; cards above and below are subtly desaturated (not blurred — blurring hurts readability). Almost subliminal. Cut if it tests as distracting.
4. **The tagline** lives only on the onboarding splash and in tiny type under the date header of each briefing: `DAILY BRIEFING · April 13 · Bringing the arXiv into focus`. Nowhere else.

**Refused:** aperture iconography on every section header, lens flares, animated apertures on hover, shutter sound effects, the word "focus" in every piece of copy.

### Information architecture — sidebar, no tabs

Left sidebar (~220px, collapsible), top-to-bottom:

1. **Today** — the current briefing (primary view, default on open)
2. **Running…** — only visible when a run is in progress
3. **History** — past briefings, grouped by month
4. **Starred** — papers starred across all briefings
5. **Audit** — "why did this paper end up here" debug view
6. **Settings** — one destination with an internal left-rail (Interests, Categories, Models, Memory, Credentials, Budgets, Prompts)

Bottom of sidebar: the Aparture wordmark, provider status dots (green/yellow/red per provider), and a single gear linking into Settings.

**No top tabs.** A command bar (`⌘K`) exists but is secondary, not load-bearing — for "jump to past briefing on March 14" and "open profile.md," not for hiding primary actions.

### The briefing reading view — top to bottom

Single-column, serif, centered, measure capped at 68ch. The sidebar remains visible but the content area has generous left/right whitespace. **The briefing is not a dashboard.**

- **Header**: date, tagline in small caps beneath, a thin hairline divider, then a single stats line `5 papers in focus · 287 screened · ~14 min`.
- **Executive summary**: plain serif paragraph, first sentence at 1.1× body size with a touch of extra weight (not a drop cap). It's a paragraph; respect the reader.
- **Theme sections**: separated by a simple horizontal rule with `── THEME N ──` small-caps label above the theme headline. The theme headline is the largest type in the body (~1.5× body) and sits above a short argument paragraph in italic. **Typographic hierarchy alone carries the separation** — no background tints, no colored blocks.
- **Paper cards**: hairline border, warm stone background (`#f4f1ea`), 24px internal padding. Score badge top-left (large numeral, arXiv red only at 9+). Title in Inter semibold at 18px (deliberate shift out of serif: the title reads as metadata, not prose). Authors and arXiv ID in JetBrains Mono at 13px. Hairline divider. **One-line pitch** in italic serif. **"Why this matters to you"** paragraph in regular serif body. Figure thumbnails below (max 2, 160×120, click to enlarge). Action row at bottom: `→ quick summary  → full report  ☆ star  ⊘ dismiss` — all **text links with arrow glyphs, not buttons**. Buttons in the reading surface would be visual noise.
- **Debate blocks**: same hairline border structure as paper cards, warm stone fill (`#ede6d5`), small `⚡` glyph prefix on the label `── DEBATE ──`. Sits between paper cards or between themes, wherever the tension actually lives. Not visually louder than paper cards — a _different kind_ of block, not a _more important_ block.
- **Longitudinal blocks**: same structure, cool stone fill (`#e4e8ec`), label `── LONGITUDINAL ──`. These show up inline inside a single paper card (when the connection is about that paper) or as a standalone cross-briefing observation.
- **Proactive question panel**: at the very end of the briefing, faintly warm tint (`#efe8d8`), label `── A QUESTION FROM APARTURE ──`. Question written in italic serif like a voice. Textarea for reply. Two buttons: `Preview changes to profile.md` and `Skip`. The preview button opens a real diff view of the user's actual memory file with proposed additions highlighted in green and removals in yellow/red. User can accept, edit, or cancel.

**Critical UX rule: the proactive question is not a chatbot. It is a file editor with a voice.** The user always sees the real `profile.md` diff before approving.

### Drill-down: inline for small, side-panel for large

- `→ quick summary` **expands the card inline** with a smooth height animation (~150ms). Still in the scroll stream, still reading.
- `→ full report` **opens a right-side panel** (~55% width, push-not-overlay), not a modal. Modals break reading flow and can't be left open while scrolling; a new page loses context. The side panel has a close button and dismisses with Escape.
- **No modals anywhere in the reading surface.**

### Feedback is silent

`☆ star` and `⊘ dismiss` are single clicks, no confirmation, no toast. Star fills; a tiny "Starred" label appears for 1.5s in the card footer. Dismiss collapses the card to a single dimmed line `Dismissed: [title]` with an undo link. **Zero friction.**

### Figure extraction pipeline

Three fallback layers, producing whatever figures the UI has available for each paper:

1. **arXiv HTML version (preferred).** For papers with an HTML preprint, we extract figure images directly from the HTML's `<figure>` tags and their image URLs. Cleanest path. Phase 2 v1.
2. **Caption + description only (fallback).** When HTML is unavailable, the figure card shows just the model's extracted caption and short description, with a link to open the PDF to the relevant page. Phase 2 v1.
3. **pdf.js region rendering (deferred to v2.1).** When HTML isn't available and a richer figure is desired, we use `pdf.js` to render the page region containing the figure using bbox hints from the multimodal model. Deferred from Phase 2 because multimodal bbox reliability is unproven; requires a validation pass against real arXiv papers before committing.

Phase 2 ships tiers 1 and 3; v2.1 adds tier 2 (the middle tier numerically, not by implementation order).

### The single biggest design risk

**The briefing could feel generated.** Everything the user reads — exec summary, theme arguments, "why this matters," debate callouts, proactive questions — is LLM output. If the typography, voice, and structure don't carry real editorial weight, the first briefing looks like "ChatGPT in a nice frame" and the product dies in week two.

The mitigation is not more features. It is **ruthless commitment to the reading register**: serif body, narrow measure, italic pitches, real diff views instead of chat, no emoji, no sparkle icons, no "AI-generated" disclaimers, no chat bubbles, no loading shimmers on the briefing (it's pre-rendered overnight; it should appear instantly). Every pixel that says "modern AI app" subtracts from this. Every pixel that says "serious daily read" adds to it.

### What NOT to do

- No gradients, glassmorphism, or neon accents
- No emoji icons (Lucide only; the one `⚡` on debate blocks is body type, not a UI icon)
- No modals for reading-adjacent actions
- No toast notifications for star/dismiss
- No command palette as load-bearing navigation
- No chat UI, ever — proactive questions are file editors, not conversations
- No "AI Assistant" framing or sparkle icons — the model is invisible infrastructure, not a character
- No skeleton shimmer on the briefing (it's pre-rendered)
- No multi-column newspaper layout
- No auto-inverted dark mode
- No onboarding coachmarks pointing at UI elements
- No gamification, streaks, or badges — the reward for reading is having read
- No aperture motif outside the four specified placements

---

## 8. Memory, feedback, and the learning loop

### What Phase 2 ships: rung 2 plus

The earlier draft of this spec said "rung 2 ship, rung 4 target" but then described proactive questions that propose memory updates — which is a rung 3 feature by the spec's own ladder. Resolving the inconsistency: Phase 2 ships **rung 2 plus** — a living `profile.md` and `memory/*.md` fed into every LLM call (rung 2), with a specific, tightly-scoped rung 3 feature: the model proposes memory updates at the end of each briefing, and every proposed update goes through a diff preview and user approval.

We are honest about reaching into rung 3 on the specific feature where it matters most, and staying at rung 2 everywhere else.

**Rung 4** (the full proactive agent loop — hypothesizing new topics, proactively expanding categories, conversational refinement) remains the north star and is **not in Phase 2**. It is a post-v2.1 stretch goal. The spec should not promise it.

### What lives in `profile.md`

The user's written research interests in prose, in their own voice. The source document. Edited by the user directly (in a file, or via the Settings → Interests view in the app). Distilled by an LLM on request from recent feedback (with user-approved diffs).

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

Feedback is stored as `feedback/YYYY-MM/<arxiv-id>.md` with a short frontmatter header and the user's notes. Append-only — editing a previously stored piece of feedback creates a new record, not an overwrite.

### History

`history.jsonl` is a top-level append-only log of every run, with pointers into `history/YYYY-MM-DD/` for stage-by-stage detail. Two purposes: auditability ("why did this paper end up here"), and context for future runs (the synthesis pass reads recent history to generate longitudinal connections).

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
- `notebooklm-guide.md` — a pre-written user-facing document explaining how to create a NotebookLM notebook with these materials, including a suggested prompt, a recommended podcast style (two-speaker conversational, ~20 minutes, academic register), and explicit notice that uploading the files to NotebookLM sends them to Google's servers

The user downloads the ZIP, creates a NotebookLM notebook themselves, uploads the files, and runs the podcast generation. No Playwright, no browser profile, no UI automation fragility.

### HTML export

A button: "Export as HTML." Produces a **self-contained HTML file** (`briefing.html`) of the day's briefing that can be shared as a file attachment. Useful for emailing an advisor or sharing with a lab group. Entirely local — no hosting, no links to Aparture's infrastructure.

### Stretch: podcast via TTS pipeline (post-v2.1)

A direct podcast feature using a TTS pipeline (ElevenLabs multi-voice dialogue, or Google Chirp 3 if accessible) is **explicitly a post-v2.1 stretch goal**. v2 does not ship with integrated audio generation. The manual NotebookLM export path is the v2 answer for users who want audio.

---

## 11. Scope: Phase 1 vs Phase 2 vs v2.1 vs stretch

The original draft of this spec committed to a single large "v1" that tried to ship the full refactor in one release. Critical review showed this was wrong for three reasons: scope-too-large for a lone builder, the riskiest feature (synthesis) was gated behind 4+ months of platform work, and the refactor had no interim value to the existing tool's user. The revision restructures into **two phases** — and this restructuring is the single biggest change in the revised spec.

### Phase 1 (the new v1, ~6–8 weeks, on the existing Next.js codebase)

**Goal:** prove the synthesis stage and the briefing as the primary artifact. Ship something the existing user can use and see the shape of the final product, without touching Electron, filesystem rearchitecture, or OS keychain.

**What Phase 1 includes:**

- **Synthesis stage** as `pages/api/synthesize.js`. Single LLM call with provider-native structured output (Anthropic tool_use, Google `responseSchema`, OpenAI `response_format`). Returns typed components.
- **Structured-output validator and repair layer** — schema validation with `zod`, citation validation, two-pass repair prompting for structural failures.
- **LLM test harness** — provider-abstraction layer that accepts injected fakes, cached provider responses keyed by input hash, fixture corpus of ~10 real runs for regression testing, golden-output tests for the synthesis stage. See §16.
- **Briefing renderer** — new React components for the reading view, rendered inside the existing `ArxivAnalyzer.js` tree. Full design system from §7 in place: Source Serif + Inter, warm gray palette, 68ch measure, paper cards, debate blocks, longitudinal blocks, proactive question panel, inline and side-panel drill-downs.
- **Two-level per-paper reports** — full technical report (frontier model) and quick summary (cheaper model, compressed from the full report).
- **History in localStorage** — a week's worth of past briefings loadable for longitudinal connections. Temporary compromise; Phase 2 moves everything to files.
- **Profile textarea** — user writes their research interests in prose. Saved to localStorage with an "Export profile" button that downloads it as `profile.md`.
- **Token budget pre-flight** — tokenizer approximations, UI notice thresholds.
- **The current tool's outputs remain available** — the existing arxiv*analysis markdown report + NotebookLM document generation are \_not* removed in Phase 1. The user can still use the tool as it exists today; the briefing is an _additional_ path that runs alongside.

**Phase 1 does NOT include:** Electron packaging, OS keychain, filesystem layout, first-run wizard, memory files (beyond the profile), feedback capture with notes, proactive question diff-apply workflow, figure extraction, daily scheduler, HTML export, NotebookLM ZIP bundle.

**Acceptance gate for Phase 2:** before starting Phase 2, the user runs Aparture daily for 2 weeks and answers: **"Is the Phase 1 briefing better than the current tool's arxiv_analysis output for my morning triage?"** If yes, Phase 2 begins. If no, synthesis prompt iteration continues before platform work starts.

### Phase 2 (~4–6 months after Phase 1 acceptance, the full refactor)

**Goal:** everything else in the original v1 spec. Becomes buildable because (a) Phase 1 has proven the synthesis stage works, (b) Phase 1's React components are the starting point for the Electron app's webview UI, (c) motivation is preserved because the user has a visibly-better tool in hand.

**What Phase 2 includes:**

- **Electron wrapper** around the Phase 1 Next.js app. Single codebase produces both installers (via `electron-builder`) and a self-hostable `npm run start` path. GitHub Releases publishes macOS, Windows, and Linux installers.
- **Filesystem-first state** — `~/aparture/` directory layout as specified in §5. Migration path from Phase 1's localStorage to files.
- **OS keychain integration** via `keytar`. Replaces the Phase 1 textarea-in-settings credential approach.
- **First-run onboarding wizard** — welcome, directory picker, API key walkthrough with pre-flight test calls, field picker, interests prose, model selection, first-run sample analysis.
- **Memory loop** — `memory/*.md` files fed as additional context into LLM calls. Model-proposed updates go through diff preview and user approval.
- **Feedback capture** — star, dismiss, free-text notes per paper, stored in `feedback/YYYY-MM/*.md`.
- **Proactive questions with diff-apply workflow** — user answers a question, a follow-up LLM call generates a proposed diff to `profile.md`, the UI shows the diff, the user approves/edits/rejects before applying.
- **Figure extraction tier 1 (arXiv HTML) + tier 3 (caption only)** — real inline figures from HTML when available, graceful fallback to caption+description otherwise. **Tier 2 (pdf.js region render) deferred to v2.1.**
- **Daily scheduler** — Electron auto-launch + a native scheduler (launchd plist / Windows Task Scheduler / systemd user timer) that triggers a daily run in the background. The briefing is ready when the user opens the app in the morning.
- **HTML export** — self-contained shareable briefing file.
- **NotebookLM ZIP bundle export** — briefing + per-paper full reports + PDFs + guide document.
- **Full audit trail in `history/YYYY-MM-DD/`** — every stage's decisions logged, visible in the Audit view.
- **Structured logging infrastructure** replacing the current scattered `console.log` calls.
- **Cross-platform code signing** — Apple notarization + Windows code signing cert. Real ongoing administrative cost (~$100–500/year depending on certs).

### v2.1 (first priority post-Phase-2)

- **Figure extraction tier 2** (pdf.js region render from multimodal-model-returned bbox)
- **Longitudinal connections that reach back further than 14 days**
- **Profile distillation improvements** — the "distill my interests from recent feedback" workflow gets more sophisticated
- **Cross-paper synthesis depth improvements** — learned from early v2 usage
- **Richer audit view** — timelines, filter decisions, prompt diffs

### Stretch (post-v2.1)

- **TTS dialogue podcast pipeline** (ElevenLabs or Google Chirp 3 if accessible) — replacing the NotebookLM manual bundle as a first-class audio output
- **Rung 4 proactive learning** — model asks clarifying questions at moments of low confidence during a run, proactively proposes new categories to watch, hypothesizes sub-topics
- **Multi-machine sync** — opt-in folder sync via iCloud/Dropbox/Syncthing, no central server
- **Ollama integration** for local-model runs — deferred from the v1/v2 timeline because BYOK with frontier models is the priority per user decision

### Explicitly out of scope (forever)

- Central hosting, accounts, or user database
- Subscription or revenue model
- Team / collaborative features
- Mobile app
- Automated NotebookLM integration (Playwright path is deleted in Phase 2)

---

## 12. Migration from the current codebase

The migration splits into **three buckets** by the shape of the work required. The original spec's framing ("mostly a reshaping") was wrong in at least four places; this structure replaces it.

### Bucket A: Literal port (small cost, preserved essentially as-is)

- **LLM provider integration via raw `fetch()`.** The current code uses no provider SDKs — all calls are raw fetch to REST endpoints. This works unchanged in Node (CLI/Next.js API routes), browser (webview), and Electron (both processes). **This is the one genuine "preserved unchanged" win.**
- **arXiv query building and XML parsing** in the current `fetchPapers`/`fetchSingleCategory`/`buildArxivQuery`/`executeArxivQuery`/`parseArxivEntry` functions. The logic is fine. One minor replacement: the current code uses the browser `DOMParser`, which works in the webview but should be swapped for `fast-xml-parser` or similar for any calls from Electron's main process.
- **Playwright PDF download with reCAPTCHA fallback.** In Electron this is a direct port — the Node runtime is available. **No sidecar architecture, no Rust port, no dropped fallback.** This is the single biggest win from switching from Tauri to Electron.
- **Retry/correction prompt patterns** — the existing single-shot re-prompt on validation failure is preserved (though augmented for the structured-output synthesis stage; see bucket C).
- **Password gate → removed.** The current `checkPassword(password)` calls in each API route are simply removed; the app runs locally on a single user's machine.

### Bucket B: Rewrite guided by old code (medium cost, old code as reference)

- **`ArxivAnalyzer.js` monolith split.** 4,370 LOC of inline functions, ~25 `useState` hooks sharing one closure scope, arXiv fetching and report generation coupled directly to React state. **Not cleanly splittable into components** — this is closer to a _rewrite guided by the old file_ than a refactor. Budget: the single largest line item across Phase 1 and Phase 2 combined.
- **State management.** From component-scoped `useState` + localStorage to a proper store (Zustand or similar) + filesystem-backed persistence (in Phase 2). Phase 1 keeps localStorage as a transitional mechanism.
- **Configuration UI.** From scattered form fields inside `ArxivAnalyzer` to a dedicated Settings view with an internal left-rail.
- **Report generation.** From the current `generateMarkdownReport` function (Blob + `createObjectURL`, reads React state directly) to a typed-structure-driven renderer that takes the synthesis output and produces briefing content.

### Bucket C: Net-new, no precedent (large cost, new infrastructure)

These pieces have no precedent in the current codebase and must be built from scratch:

- **Structured-output synthesis stage.** The current codebase uses **zero** provider-native structured-output mechanisms (no `tool_use`, no `response_format`, no `responseSchema`). Every "structured" response today is free-text JSON parsed by a hand-rolled shallow validator. The existing `generate-notebooklm.js` (1,062 LOC) spends most of its bulk on post-hoc hallucination correction tied to a markdown output format the synthesis stage explicitly replaces — **the synthesis stage is net-new work, not a reshape of the notebooklm generator.**
- **Structured-output retry/repair infrastructure.** The current shallow JSON validators catch malformed top-level fields but cannot detect nested structural failures in a 6-component typed schema. New validation layer required: `zod`-based schema, two-pass repair prompting, graceful degradation to a minimal briefing on repair failure.
- **Citation validation pass.** Every `PaperCard.arxivId` must exist in the input list; every reference in `DebateBlock`/`LongitudinalConnection` must be verified. Replaces the Levenshtein-based hallucination detection in the current notebooklm path, but the validation logic itself is new.
- **LLM test harness.** No unit tests, no fixtures, no golden outputs, no mocking exist today. The current `cli/tests/` directory contains end-to-end Playwright scripts that drive the real dev server. Phase 1 must build: provider-abstraction layer, cached provider responses keyed by input hash, golden-output tests for the synthesis stage. See §16.
- **Tokenizer abstraction.** No local tokenizer lives in the codebase today. `tiktoken` for OpenAI is npm-available; Anthropic and Google lack first-party JS tokenizers and require char-count heuristics. Used for the token budget pre-flight.
- **Credential abstraction.** Current code reads `process.env.CLAUDE_API_KEY` directly in every API route handler. Phase 2 replaces this with a `keytar`-backed credential loader uniformly across all providers.
- **Structured logging infrastructure.** Current code has ~80+ scattered `console.log`/`console.warn`/`console.error` calls with no structured format or log levels. Phase 2 adds a structured logger and the per-run audit trail.
- **Daily scheduler** (Phase 2). Cross-platform daily-run trigger via Electron auto-launch + native OS scheduler integration. No precedent in the codebase.
- **Figure extraction pipeline** — tiers 1 and 3 in Phase 2, tier 2 in v2.1.
- **First-run onboarding wizard** (Phase 2) — dedicated full-screen flow, per-provider API key walkthroughs with pre-flight test calls.
- **OS keychain integration** (Phase 2). `keytar` is mature but the integration into the wizard, settings, and credential abstraction are new.
- **Filesystem-backed state layer** (Phase 2). Migration from Phase 1's localStorage to the `~/aparture/` directory layout.
- **Electron shell + electron-builder config** (Phase 2). Cross-platform signing/notarization, installer builds via CI.

### Deleted from the codebase (Phase 2)

- `cli/notebooklm-automation.js` (826 LOC) — Playwright NotebookLM driver
- `cli/server-manager.js` (303 LOC) — Next.js dev server lifecycle for CLI
- `cli/run-analysis.js` (857 LOC) — CLI orchestration (Electron replaces it)
- `cli/browser-automation.js` (1,122 LOC) — Playwright Aparture UI driver
- `cli/setup.js` (197 LOC) — CLI config UI (wizard replaces it)
- Password gate code across all API routes
- **~3,300 LOC of CLI orchestration deleted in total**

---

## 13. Open questions and risks

### Open questions

- **arXiv HTML-version coverage** on real ML/astro papers is unknown. Should be measured on a real week's papers before committing to tier 1 as the default figure extraction path.
- **Synthesis prompt quality** — the acceptance criterion for Phase 2 is "is the Phase 1 briefing better than the current tool's arxiv_analysis output for daily triage?" This is a subjective judgment the builder makes after 2 weeks of daily use. If the answer is no, Phase 2 waits.
- **Electron cross-platform signing costs** — Apple Developer account ($99/year). Windows code signing certs ($75–400/year depending on issuer). Linux signing not required but recommended.
- **Longitudinal connections depth** — at launch, the memory loop has zero history. Longitudinal features become useful only after ~2 weeks of daily runs. Spec should not promise longitudinal features as a day-one value; they are a compounding benefit.

### Risks with mitigations

- **Scope is still large for a lone builder.** Phase 1 ~6–8 weeks; Phase 2 ~4–6 months. Total 5–8 months. _Mitigation:_ the two-phase split means Phase 1 has standalone value; Phase 2 can pause or slow without killing the project.
- **Synthesis pass quality is unknown.** _Mitigation:_ Phase 1's explicit acceptance gate. If synthesis doesn't meet the "better than current tool" bar after 2 weeks, prompt iteration continues before Phase 2 starts. Better to discover this at month 2 than month 8.
- **Onboarding wizard is load-bearing in Phase 2.** If the wizard is clunky, Phase 2 fails regardless of the rest. _Mitigation:_ user-test the wizard on a real non-builder researcher before shipping Phase 2. Dogfood is not enough.
- **alphaxiv shipping first.** alphaxiv raised $7M in November 2025 and is moving fast. If they ship a daily personalized digest with Deep Research in the next 90 days, Aparture's addressable audience shrinks. _Mitigation:_ the local-first / BYOK / open-source conjunction is a moat alphaxiv cannot cross without contradicting their business model, but distribution is a race. Ship Phase 1 as quickly as possible and begin distribution with the Phase 1 sample briefings before Phase 2 is complete.
- **Electron binary size reputation.** 150 MB installers and the "Electron app" reputation among a subset of engineers. _Mitigation:_ the target audience does not share this reputation — they use VS Code, Slack, Obsidian, Notion, Figma Desktop, Zotero's new version, all Electron. Name the trade-off in the README.
- **LLM test fixture corpus becomes stale.** As models evolve, cached responses reflect old behavior. _Mitigation:_ regenerate fixtures on model upgrades; budget the cost.
- **Prompt-iteration cost during Phase 1.** Iterating on the synthesis prompt is expensive — each test run can be ~200k tokens once memory + history are in context. _Mitigation:_ build the fixture corpus early so most iterations run against cached responses; reserve ~$20–50 for live prompt-engineering calls.

---

## 14. What makes this spec done

This spec is considered approved when:

1. The user has read the revised version and confirmed the positioning, principles, two-phase restructuring, audience honesty, and scope cut lines
2. The open questions above have either been answered or explicitly parked as "decide during implementation"
3. The handoff to the `writing-plans` skill has been authorized

At that point, a separate implementation plan is drafted that translates this design into concrete engineering tasks in dependency order, starting with Phase 1.

---

## 15. Distribution

Open source alone is not distribution. Zotero had 15 years and library channel partnerships. arxiv-sanity-lite has been free and open source since ~2019 with a small devoted audience but never reached the academic mainstream. Aparture must have an explicit distribution plan or it risks the same fate.

### Phase 1 distribution (private, scoped audience)

- The builder's immediate academic network (~10–20 colleagues, students, collaborators)
- One or two targeted lab Slacks / Discords (astrostatistics, ML safety, etc.)
- **No public launch yet** — Phase 1 is a working prototype being validated, not a product

### Phase 2 distribution (public launch)

- **"Show HN: Aparture — a spiritual successor to arxiv-sanity-lite"** with sample briefings embedded as static HTML pages. This is the single most important distribution event in the project's life.
- **A landing page** at `aparture.dev` or similar (static, free hosting) showing: a sample briefing, architecture diagram, install button (GitHub Releases), self-host instructions, the "bringing the arXiv into focus" tagline with the aperture wordmark
- **Academic Twitter / Bluesky** — builder's own account + targeted replies to arxiv-sanity references, with screenshots of real briefings
- **arxiv-sanity audience overlap** — reach out to Karpathy directly (respectfully, as a tribute) and to the arxiv-sanity-lite GitHub community
- **ML Collective, Alignment Forum, LessWrong-adjacent communities** — where daily arXiv triage is a shared pain point and local-first/BYOK framing lands
- **Targeted lab Slacks** — ML, cosmology, condensed matter, structural biology. Each has an audience that suffers from the arXiv firehose differently.
- **Conference booths / posters** — opportunistic, not essential. A printed briefing handed out at a major conference is more persuasive than any slide deck.

### Empirical demonstration as a shippable artifact

Before the public launch, run Aparture side-by-side with Semantic Scholar Research Feeds on the same seed paper set for 2 weeks, and publish the comparison (using the builder's own research workflow with consent). The write-up becomes both a technical artifact and a distribution asset — concrete evidence, not rhetoric.

### What distribution is NOT

- A GitHub repo with a good README
- Assuming users will find it
- Assuming "it's better than Semantic Scholar" is self-evident

---

## 16. Testing strategy

The earlier draft of this spec said nothing about testing. This was a major omission for an LLM-backed product where every regression test can cost real API money.

### Test layers

- **Unit tests** for pure functions — arXiv query building, score blending, date handling, validator logic, report formatting, tokenizer approximations. No LLM calls. Fast.
- **Integration tests with cached LLM responses.** A fixture corpus of ~10 real runs stored in `cli/tests/fixtures/`. Regression tests replay fixtures through the pipeline and verify: (a) validators accept known-good outputs, (b) repair logic kicks in for known-bad outputs, (c) synthesis produces structurally-valid briefings for known inputs.
- **Golden-output tests for the briefing renderer.** Given a fixed synthesis output structure, React rendering produces a stable output. Snapshot tests with diff detection.
- **End-to-end tests** against the live dev server — only in CI, only triggered manually, only with a dedicated "test" API key, budgeted to ~1 run per week at most.

### The provider abstraction

All LLM calls go through a single `callModel()` abstraction that accepts an injected mock in test mode. The current codebase has three separate duplicated `callAIModel` functions in `score-abstracts.js`, `analyze-pdf.js`, and `generate-notebooklm.js`. Phase 1 consolidates these into one module.

In test mode, `callModel()` looks up the input by content hash in the fixture corpus and returns the cached response. No network calls are made. The fixture corpus grows over time as real runs are captured and added.

### Cost budget for prompt iteration

Iterating on the synthesis prompt is the single most expensive activity in Phase 1. Realistic budget: **~$20–50 total in provider fees for Phase 1 prompt engineering**. The fixture corpus should be built early so that later iterations can be tested against cached runs instead of fresh API calls.

### What is NOT tested

- The visual design of the briefing (design reviews replace visual tests)
- The LLM's _judgment_ (we can't regression-test "did the model pick the right papers"; we can only test "did it produce structurally-valid output")
- Network flakiness (live API calls have their own behavior; we don't try to mock their failure modes beyond basic retry testing)

---

## 17. Summary of changes from the original spec draft

For reference, the revisions in this document versus the first draft:

- **Two-phase restructuring** (new). Phase 1 on existing Next.js codebase to prove synthesis stage; Phase 2 does the Electron + filesystem + wizard + memory work.
- **Electron replaces Tauri** (new). Critical review showed Tauri breaks Playwright, requires Rust/JS porting, and underestimates cross-platform signing costs. Electron preserves ~95% of the current code.
- **"Spiritual successor to arxiv-sanity-lite"** framing added. Acknowledges the topical precedent honestly.
- **§3 positioning rewritten** to lead with synthesis + longitudinal memory + faithful technical depth. Local-first/BYOK/open-source demoted to credibility anchors.
- **§3.5 audience honesty** section added. "Non-AI-savvy researcher" framing was aspirational; real v1/v2 user is technically comfortable.
- **§12 migration** restructured into port / rewrite-guided-by-old / net-new buckets. Ends the "mostly a reshaping" soft-pedaling.
- **Missing v1 line items made explicit:** daily scheduler, LLM test harness, credential abstraction, tokenizers for pre-flight, structured-output retry/repair, citation validation, structured logging.
- **Figure extraction tier 2 (pdf.js region render) moved to v2.1** due to multimodal bbox reliability uncertainty.
- **Rung 2 vs rung 3 conflation resolved.** Phase 2 ships "rung 2 plus": rung 2 baseline with the specific rung 3 feature of model-proposed memory diffs at end of briefing.
- **License decided:** Apache 2.0.
- **§7 briefing design** expanded with concrete visual direction, typography, aperture metaphor placements, sidebar IA, paper card anatomy, drill-down patterns, and a named design risk.
- **§15 distribution** added. Names concrete channels and a 2-week empirical comparison to Semantic Scholar as a shippable artifact.
- **§16 testing strategy** added. Provider abstraction + cached fixtures + golden-output tests + cost budget for prompt iteration.
- **Name, tagline, and focus metaphor preserved unchanged.**
