# Design principles

Aparture's job is to let a researcher stop skimming the arXiv without worrying about what they're missing. Every design decision serves one of three requirements that job imposes: the briefing must be worth reading, it must be checkable, and the user must stay in control.

The principles below are how those requirements show up in practice. Each one points at the place in the codebase where it is enforced, so you can verify the claim rather than take it on faith.

## 1. The profile is the tool's memory

Your profile is a plain-English document you wrote, and it is the only representation of your interests the pipeline has. Every stage reads it. It grows the way memory should: each star, dismissal, and comment either becomes a proposed edit to the profile — shown to you as a diff you accept or reject — or it gets discarded. Nothing about your preferences is stored anywhere you can't read and edit.

_In the code:_ `hooks/useProfile.js` (every pipeline stage reads `profile.content`), `pages/api/suggest-profile.js` (feedback → proposed edits with per-change rationales).

## 2. Nothing expensive happens without you

The pipeline pauses before each escalation in cost or judgment: after filtering, after scoring (before PDFs are read), and before the briefing is written. Each gate shows you what's about to happen and lets you override it. A "skip remaining gates" link exists for days you don't need them, and each gate can be turned off in settings.

_In the code:_ the three gates in `lib/analyzer/pipeline.js`; `components/run/ReviewGateBanner.jsx`.

## 3. Spending follows relevance

Cheap models read everything; capable models read only what survives. Each pipeline stage has its own model slot, and defaults follow a rule rather than a brand: the cheapest registered model that meets the slot's capability bar, re-derived whenever the registry is refreshed. Prompt caching and cross-run duplicate detection exist for the same reason — to avoid paying twice for the same reading.

_In the code:_ `utils/models.js` (registry with per-model pricing), `lib/analyzer/applyDedupe.js`, the caching paths in `lib/llm/`.

## 4. Synthesis is the product, and claims must be checkable

The briefing argues across papers — that editorial connection is the point, and it is allowed. Claims about individual papers are not given the same freedom: numbers, methods, and attributions are audited against the source material, and every cited arXiv ID must exist in the set of papers the model was actually given. A briefing that fails these checks is repaired or retried before you see it.

_In the code:_ `lib/synthesis/validator.js` (citation validation), `pages/api/check-briefing.js` and `prompts/check-briefing.md` (the audit pass).

## 5. Filter permissively, judge strictly

Early stages err toward letting papers through; later stages re-judge alignment from scratch instead of trusting the stage before. A paper that scraped through the filter still has to earn its score, and a high score still has to earn its place in the briefing.

_In the code:_ `prompts/rubric-scoring.md` (the scoring rubric explicitly does not treat filter survival as evidence of relevance).

## 6. Be a good arXiv citizen

Requests to arXiv are serialized, spaced with jitter, cached, and identified with a contact address when configured. Harvesting uses OAI-PMH with careful date-window handling rather than hammering the search API.

_In the code:_ `lib/arxiv/spacing.js`, `lib/arxiv/ingest.js`.

## 7. Local-first

Your API keys, profile, feedback, and briefing history live on your machine. The current architecture is single-tenant — one researcher per instance — and hosted multi-user operation is an explicit non-goal. Future packaging (a desktop app) can add export or sync without moving your data off your machine.

_In the code:_ `.env.local` for keys, browser localStorage plus repo-local `reports/` for state; see [Environment](/reference/environment) for the deployment model.
