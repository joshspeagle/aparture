# Design principles

Aparture is designed so a researcher can stop skimming daily arXiv listings while staying confident that no relevant paper was missed. Every architectural decision serves a common goal: the daily briefing must be substantive, every factual claim must be verifiable against its source paper, and the researcher must remain in control of both paper selection and profile memory.

Each principle below traces directly to the modules in the codebase that enforce it.

## 1. The profile is the tool's memory

Your research profile is a plain-English document that you write and edit, serving as the sole representation of your scientific interests across the pipeline. Every stage reads it directly. As you record stars, dismissals, comments, overrides, and answers, those signals either become proposed atomic diffs to your profile (presented with written rationales for you to accept or reject individually) or remain pending until you act on them. No hidden preference weights or opaque embeddings are stored outside the text you can inspect and edit.

_In the code:_ `hooks/useProfile.js` (every pipeline stage reads `profile.content`) and `pages/api/suggest-profile.js` (converts accumulated feedback into proposed diffs with per-change rationales).

## 2. You decide what gets read in full

The pipeline pauses at three interactive checkpoints by default: after quick filtering (Gate 1), after abstract scoring before any PDF is downloaded (Gate 2), and after full-text PDF reading before the briefing is synthesized (Gate 3). Each gate displays the exact candidate set scheduled for the next stage and lets you modify it: you can override filter bucket assignments, star borderline abstracts into the PDF set or dismiss irrelevant ones, and attach paper-level or run-level notes before synthesis. Gates 2 and 3 also report the projected token cost of the upcoming stage. Every gate banner includes a **Skip remaining gates this run** shortcut for unattended runs, and each gate can be toggled off persistently in Settings.

_In the code:_ the three gate checkpoints in `lib/analyzer/stages/startProcessing.js` and the banner UI in `components/run/ReviewGateBanner.jsx`.

## 3. Spending follows relevance

Lightweight models screen the full daily volume while higher-capacity models read only the shortlisted candidates. Every pipeline stage reads from an independent model slot whose defaults are selected from the model registry's pricing and capability metadata: fast, low-cost models handle high-volume abstract filtering and quick summaries, while stronger models handle abstract scoring, full-text PDF reading, and briefing synthesis. You can reassign any slot per stage, and provider prompt caching alongside cross-run duplicate detection ensure that you never pay twice to process the same prefix or paper.

_In the code:_ `utils/models.js` (model registry with per-model pricing), `lib/analyzer/applyDedupe.js` (90-day seen-papers deduplication), and the provider caching adapters in `lib/llm/`.

## 4. Synthesis is the product, and claims must be checkable

The briefing synthesizes arguments and connections across papers, while enforcing strict factual grounding on every statement about an individual paper. Quantitative results, methodological descriptions, and author attributions are audited against the untruncated abstracts and Stage 4 full reports supplied to the synthesis model, and every cited `arxivId` in cards or prose must belong to the active run's input corpus. Before display, deterministic validation overwrites every card's title and score with ground-truth pipeline metadata and verifies that every non-dismissed final-round paper appears in at least one theme. Any briefing that fails structural validation undergoes one LLM repair call followed, if needed, by deterministic code salvage that labels added or redacted elements explicitly. When the post-synthesis hallucination audit flags unsupported claims, Aparture retries synthesis once by default and saves the final audit verdict and flagged claims alongside the briefing.

_In the code:_ `lib/synthesis/validator.js` (metadata corrections, citation and coverage validation, and deterministic salvage), `pages/api/check-briefing.js`, `lib/synthesis/checkCorpus.js`, and `prompts/check-briefing.md` (the hallucination audit pass).

## 5. Filter permissively, judge strictly

Early triage stages cast a wide net so borderline or interdisciplinary papers are retained, while subsequent stages evaluate relevance and quality from scratch against explicit rubrics. Passing the Stage 2 quick filter carries no automatic weight in Stage 3 abstract scoring, and a high abstract score must still be confirmed by the Stage 4 full-text PDF analysis.

_In the code:_ `prompts/rubric-scoring.md` (the Stage 3 scoring rubric evaluates research alignment and paper quality independently of Stage 2 survival).

## 6. Be a good arXiv citizen

All requests to arXiv are serialized, spaced with random jitter, cached locally, and identified with a contact email address (`ARXIV_CONTACT_EMAIL`) when configured. Metadata harvesting requests are spaced 3 to 5 seconds apart, and PDF or HTML page fetches are spaced 15 seconds apart in compliance with the crawl delay specified in arXiv's `robots.txt`. Category harvesting uses arXiv's bulk OAI-PMH endpoint with anchored date-window filtering to minimize query load.

_In the code:_ `lib/arxiv/spacing.js`, `lib/arxiv/ingest.js`, and `lib/analyzer/rateLimit.js` (the 15-second PDF download throttle).

## 7. Local-first

Your API keys, research profiles, feedback store, extracted figures, and archived briefings reside on your local machine, and the development server binds to `127.0.0.1` by default. Aparture is architected as a single-researcher local workstation tool, so your research notes, profile history, and reading patterns remain entirely under your control on disk.

_In the code:_ `.env.local` for credentials, browser `localStorage` plus repository-local `reports/` for persistent state; see [Environment](/reference/environment) for configuration details.
