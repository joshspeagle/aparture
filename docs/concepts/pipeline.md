# The pipeline

A tour of Aparture's paper-to-briefing pipeline — what each stage does, what it reads and writes, and where it can pause for you to weigh in.

## The stages at a glance

Every run passes through the same waterfall. Each stage reads the output of the previous one, does less work than the previous one (because papers have been filtered out along the way), and uses a more capable model as the stakes go up.

```
┌──────────────────┐
│ 1. fetchPapers   │  arXiv API · no LLM · free
└────────┬─────────┘
         │ all papers in window
         ▼
┌──────────────────┐
│ 2. quickFilter   │  fast model · YES / MAYBE / NO
└────────┬─────────┘  ~fractions of a cent per paper
         │
         │   ⏸  pauseAfterFilter (default: on) — review buckets, override verdicts
         │
         │ YES + MAYBE papers
         ▼
┌──────────────────┐
│ 3. scoreAbstracts│  scoring model · 0.0–10.0 with justification
└────────┬─────────┘  ~fractions of a cent per paper
         │ scored papers (score > 0)
         ▼
┌──────────────────┐
│ 3.5. postProcess │  comparative re-score of top N (default 50)
└────────┬─────────┘  ~fractions of a cent per paper · optional
         │ re-ranked papers
         │
         │   ⏸  pauseBeforeDeepAnalysis (default: on) — star / exclude papers before PDF run
         │
         ▼
┌──────────────────┐
│ 4. analyzePDFs   │  deep PDF model · full-text analysis + final score
└────────┬─────────┘  ~a few cents per paper
         │
         │   ⏸  pauseBeforeBriefing (default: on) — star / dismiss / comment
         │
         │ papers + deepAnalysis objects
         ▼
┌──────────────────┐
│ 5. briefing      │  quick summaries → synthesis → hallucination audit
└──────────────────┘  ~a few cents per briefing
```

Three optional pause gates let you steer the run before expensive work happens. All three are on by default and can be toggled in Settings → Review & confirmation.

Wall-clock duration varies widely with provider latency, paper volume, and which models are in which slots, so this page doesn't quote seconds. Briefings usually land within a few minutes on a hundred-paper day at the default concurrency; the longest stretch tends to be Stage 4 because it reads full PDFs.

## Stage 1: fetch papers

**What it does.** Queries the arXiv API for every paper in your selected categories, within a configurable date window (default: last 24 hours). If the window returns too few papers, Aparture widens it automatically — trying 3, 7, and then 14 days back before giving up. Cross-listed papers are deduplicated and the list is sorted chronologically.

**Inputs.** `selectedCategories`, `daysBack`.

**Output.** A list of raw papers with title, abstract, authors, and PDF URL.

**Cost.** Free. The arXiv API carries no charge.

**Pause gates.** None.

See [arXiv ingestion](./arxiv-ingestion.md) for the two-path architecture (OAI-PMH primary, Atom fallback) and the configurable knobs (mode, window semantics, fill-ups, cache).

After Stage 1 fetch (and any fill-up steps), an in-memory **dedupe pass** runs against a 90-day rolling index of arxivIds seen in past runs. In Remove mode (default) duplicates are dropped before the LLM filter; in Flag mode they're kept but tagged for the UI. The index is maintained client-side from your saved briefings — aborted runs (no briefing produced) don't add anything, so restarting a stopped run won't blank itself out. See [Tuning the pipeline](../using/tuning-the-pipeline.md#duplicate-detection) for the user-facing toggle.

## Stage 2: quick filter

**What it does.** Batches papers and asks a fast, cheap model to give each one a <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> verdict against your research profile, along with a one-sentence summary and a short justification. This is triage, not scoring — the goal is to drop papers that are clearly irrelevant before the more expensive stages run. The stage can be disabled entirely via `useQuickFilter: false` in config.

You can override any verdict at the review gate. Overrides are recorded as `filter-override` feedback events and flow into the profile-refinement flow as a "profile may be too narrow or too broad" signal.

**Inputs.** Papers from Stage 1, `profile.content`, `filterModel` (default `gemini-3.1-flash-lite`), `filterBatchSize` (default 3), `filterConcurrency` (default 3), `categoriesToScore` (default `['YES', 'MAYBE']`).

**Output.** Papers bucketed into `yes` / `maybe` / `no` with filter summaries. Only the verdicts listed in `categoriesToScore` advance to Stage 3.

**Cost.** Fractions of a cent per paper — roughly 50–150 input tokens each.

**Pause gate.** `pauseAfterFilter` (default: on). The pipeline halts at the `filter-review` stage. The review UI shows the three buckets and lets you click any paper's verdict button to move it before continuing.

## Stage 3: score abstracts

**What it does.** Sends each surviving paper's full abstract to a stronger scoring model and asks for a 0.0–10.0 relevance score (one decimal place) with a 2–3 sentence justification. Papers that score exactly 0 are dropped. This is the main quality filter — everything downstream uses these scores to decide which papers deserve expensive deep analysis, and the number you see on each paper card in the briefing traces back to this stage.

### How the score is calculated

The scoring prompt asks the model to evaluate each paper on two dimensions (0–10 each) and average them with equal weight.

**Research alignment** — how well the paper matches your profile:

| Range | Meaning                                                  |
| ----- | -------------------------------------------------------- |
| 9–10  | Directly addresses your core research areas, perfect fit |
| 7–8   | Strong overlap with stated interests                     |
| 5–6   | Moderate connection                                      |
| 3–4   | Weak, peripherally related                               |
| 0–2   | Little to no connection                                  |

**Paper quality** — how impactful or well-executed the work is:

| Range | Meaning                                                                        |
| ----- | ------------------------------------------------------------------------------ |
| 9–10  | Genuinely transformative — likely to be remembered as a landmark in 5–10 years |
| 7–8   | Significant methodological advance or major discovery with clear impact        |
| 5–6   | Competent work, adequately executed using standard approaches                  |
| 3–4   | Incremental work with limited novelty                                          |
| 0–2   | Poor execution, outdated, or fundamentally flawed                              |

**Final score = (Alignment × 0.5) + (Quality × 0.5)**, to one decimal place.

The prompt explicitly calibrates the Quality dimension strictly: most competent work is expected to score 4–6 on quality, not 7+. A 9 on the final score therefore requires both strong profile alignment _and_ a paper the model considers genuinely transformative — a deliberately rare event. In practice a run's highest-scored paper often lands in the 7.5–8.5 range, and 9+ is reserved for the handful of papers that clear both bars.

This rubric lives in the `pages/api/score-abstracts.js` prompt. See [Reference: prompts](/reference/prompts) for how to edit it if your field benefits from a different calibration — for instance, if you mostly read applied work that shouldn't cap at 6 on quality.

**Inputs.** Papers from Stage 2, `profile.content`, `scoringModel` (default `gemini-3-flash`), `scoringBatchSize` (default 3), `scoringConcurrency` (default 3).

**Output.** `scoredPapers` with `relevanceScore`, `scoreJustification`, and `initialScore` (preserved for post-processing). Papers that failed to score are kept separately in `failedPapers` and don't advance.

**Cost.** A fraction of a cent per paper — roughly 200–600 input tokens each.

**Pause gates.** None.

## Stage 3.5: post-process scores

**What it does.** An optional consistency pass on the top N scored papers (default 50). Papers are shuffled and compared head-to-head in small batches, and the model adjusts scores up or down to bring outliers into line with the broader ranking. Records `adjustmentReason` and a confidence rating (HIGH / MEDIUM / LOW) alongside the new score. Disable with `enableScorePostProcessing: false`.

**Why it matters.** Stage 3 scores each paper independently, which can let different batches drift in calibration — early batches may score stricter than late ones, or vice versa. The post-processing pass normalises the ranking without changing which papers advance.

**Inputs.** Top N papers from Stage 3, `profile.content`, `postProcessingModel` (default `gemini-3-flash`), `postProcessingCount` (default 50), `postProcessingBatchSize` (default 5), `postProcessingConcurrency` (default 3).

**Output.** `scoredPapers` updated with `adjustedScore`, `adjustmentReason`, and a `scoreAdjustment` trail.

**Cost.** A fraction of a cent per paper, and the stage only touches the top N.

**Pause gates.** None.

## Stage 4: analyze PDFs

**What it does.** Takes the top N papers by score (`maxDeepAnalysis`, default 30), fetches each full PDF from arXiv, and sends it to a vision-capable model to produce a structured deep analysis — key findings, methodology, limitations, and a final relevance score. Both the pre-PDF and final scores are preserved, so you can see how much the full-text read moved the score.

The stage runs with a worker pool. PDF downloads are serialised server-side (~5 seconds between arXiv requests) to respect arXiv's rate limits, but once the PDFs are in hand the LLM analyses themselves run in parallel. Default concurrency is 3, tunable via `pdfAnalysisConcurrency` (1–20). If arXiv returns reCAPTCHA instead of a PDF, Aparture falls back to a Playwright browser with cached session cookies.

On **Anthropic** providers, the pool applies a cache-warmup barrier: the first worker finishes its call alone so the ephemeral prompt-cache entry is primed once, and the remaining workers then start and hit the cache on every subsequent paper. This costs a few extra seconds on the first paper in exchange for a large input-token discount on the rest. Google and OpenAI have no warmup — all workers start immediately.

Across all LLM stages (filter, score, post-process, PDF analysis, briefing), Aparture maintains a per-provider rate-limit barrier: when any worker catches a 429 or 503, all concurrent workers for that provider pause until the provider-signaled `Retry-After` elapses (capped at 60 s). This prevents cascading 429s when one of N parallel batches trips the project's RPM cap — Gemini's free-tier 60 RPM in particular.

**Inputs.** Top N papers from Stage 3.5, `profile.content`, `pdfModel` (default `gemini-3.1-pro`), `pdfAnalysisConcurrency` (default 3).

**Output.** `finalRanking` — papers augmented with `deepAnalysis`, `finalScore`, `preAnalysisScore`, and `pdfScoreAdjustment`.

**Cost.** A few cents per paper. This stage dominates the bill. Anthropic prompt caching (automatic on Anthropic models) reduces repeat-prefix input tokens substantially, which cuts the effective per-paper input cost by a comparable margin once warmup is done.

**Pause gates.** `pauseBeforeDeepAnalysis` (default: on) fires _before_ Stage 4 starts, immediately after Stage 3.5 completes. It shows the scored list in three groups — the automatic top-N selection, a borderline band, and low-score papers — and lets you star papers into the PDF set or exclude them from it. See [Review gates → Gate 2](/using/review-gates#gate-2-before-pdf-analysis-score-review) for the full affordances. `pauseBeforeBriefing` (default: on) fires after Stage 4 completes.

## Stage 5: briefing synthesis

After PDF analysis, the pipeline orchestrates the full briefing flow in one go:

1. **Map** each paper in `finalRanking` to a briefing-formatted entry, attaching engagement metadata (stars, dismissals, and comments from your feedback events).
2. **Generate quick summaries** in parallel via `/api/analyze-pdf-quick` — ~300-word pre-reading summaries for the inline-expansion panels. Default concurrency is 5 (`quickSummaryConcurrency`, clamped 1–20).
3. **Call `/api/synthesize`** to produce the structured briefing from your profile + papers + recent briefing history. The `briefingModel` (default `gemini-3.1-pro`) gets the main synthesis prompt. Output is validated against a zod schema; if validation fails, a two-pass repair call attempts to fix the structure without re-inferring content.
4. **Call `/api/check-briefing`** to audit the briefing against the source corpus — a second, independent LLM pass looks for claims that aren't supported by the papers' abstracts, quick summaries, or full reports.
5. **Optionally retry** if the audit flags hallucinations (see the next section).
6. **Save** the briefing + generation metadata to the app's local storage (browser-side, 90-day rolling window).

Unlike Stage 4's parallel PDF analysis, the quick-summary fan-out doesn't apply an Anthropic cache-warmup barrier: the default `quickSummaryModel` is a Google model (no caching), and even on an Anthropic model the per-paper input is small enough that racing cache-creates isn't worth an extra serialised first call.

**Inputs.** `finalRanking`, `profile.content`, `briefingModel` (synthesis + hallucination check), `quickSummaryModel` (per-paper compression), `quickSummaryConcurrency`, `briefingRetryOnYes` / `briefingRetryOnMaybe`, accumulated feedback events.

**Output.** A saved briefing object + `briefingCheckResult` (verdict, justification, flagged claims) + cached quick summaries and full reports.

**Cost.** A few cents per briefing on typical setups:

- Quick summaries: a small amount per paper (short model, one-page compression).
- Synthesis: a few thousand input tokens.
- Hallucination check: another few thousand tokens.
- Retry, if triggered: roughly doubles the synthesis + check cost.

**Pause gate.** `pauseBeforeBriefing` (default: on). The pipeline halts at the `pre-briefing-review` stage after Stage 4 finishes, giving you a chance to star, dismiss, or comment on papers before synthesis runs. Stars and dismissals influence which papers anchor which themes in the briefing.

## The hallucination-retry loop

The audit step runs every time, and the result is persisted in the briefing's `generationMetadata` so you can see what was checked and what was flagged.

```
          ┌─────────────────────┐
          │ /api/synthesize     │
          └──────────┬──────────┘
                     │ briefing object
                     ▼
          ┌─────────────────────┐
          │ /api/check-briefing │
          └──────────┬──────────┘
                     │ { verdict, justification, flaggedClaims }
                     ▼
              ┌──────────────┐
              │ verdict?     │
              └──────┬───────┘
                     │
       ┌─────────────┼──────────────┐
       │             │              │
      YES           MAYBE           NO
       │             │              │
       ▼             ▼              ▼
 retryOnYes?   retryOnMaybe?    keep briefing
   yes/no?       yes/no?
       │             │
       ▼             ▼
  retry synth   retry synth     (both retry paths)
  with hint     with hint              │
       │             │                 │
       └──────┬──────┘                 │
              ▼                        │
   re-run check-briefing               │
              │                        │
              ▼                        ▼
         save + render the briefing
```

Two checkboxes in Settings → Review & confirmation control when retries fire:

- **`briefingRetryOnYes`** — retry on a confident hallucination verdict.
- **`briefingRetryOnMaybe`** — retry on an uncertain verdict too (more cautious, more expensive).

When a retry runs, the synthesis prompt gets a retry hint summarising the flagged claims, and the audit runs again on the retried briefing. Flagged claims from the final pass are shown as an expandable section in the briefing UI, so you can see what the auditor flagged even if you decide to trust the briefing anyway.

::: tip Only one retry per briefing
The retry path fires at most once — a design choice to avoid runaway loops at the cost of accepting one stuck verdict. If the retry also flags, the second briefing is what you see.
:::

## The Download Report vs the briefing

A successful run produces two separate outputs, and conflating them causes persistent confusion.

The **briefing** is the editorial product: synthesis LLM output with an executive summary, themes, per-paper cards, and a hallucination audit. Stage 5 produces it, `components/briefing/BriefingView.jsx` renders it, and `useBriefing` saves it to the sidebar archive. It's the page you open day-to-day.

The **Download Report** is a flat markdown export compiled by `lib/analyzer/exportReport.js` from Stage 4's per-paper deep-analysis outputs. It has no editorial framing, no theme grouping, no profile-shaped "why it matters" — just the raw technical write-ups stitched together, one after another, with scores and metadata. No LLM call happens at export time; it's a deterministic compile of cached outputs. The card surfaces as soon as Stage 4 finishes, which means **it's visible during the pre-briefing pause** — you can export the technical detail without waiting on or running briefing synthesis at all.

Neither depends on the other existing. In day-to-day use, the briefing is what you read; the report is mostly useful for archival or for handing someone a self-contained file. If you want both, Stage 5 produces the briefing and the Download card keeps working in parallel. If you only want the report (unattended runs, archival pipelines), disable briefing synthesis or stop the run at Gate 2.

## Reading this alongside the UI

- The **Progress Timeline** (left side of the main area during a run) shows each of the stages with a status icon and a live progress counter.
- The **review-gate UIs** appear when `pauseAfterFilter`, `pauseBeforeDeepAnalysis`, or `pauseBeforeBriefing` fire — they occupy the main area until you click the Continue button.
- The **Download Report** card appears after Stage 4, regardless of whether Stage 5 has run. See the section above for what's in it and how it differs from the briefing.

## Where to tune what

- **Skip a stage?** Toggle `useQuickFilter` or `enableScorePostProcessing` in Settings. Both stages are safe to skip when your profile is narrow and well-calibrated.
- **Pick a different model per stage?** The config exposes `filterModel`, `scoringModel`, `postProcessingModel`, `pdfModel`, `briefingModel`, and `quickSummaryModel` as independent slots. See [Model selection](/concepts/model-selection) for recommended combinations.
- **Tune the briefing output?** Edit `prompts/synthesis.md` — it takes effect on the next run, no rebuild needed. See [Prompts](/reference/prompts).
- **Understand what stars and dismissals do?** They feed synthesis as engagement signals and become part of the briefing's framing. See [Giving feedback](/using/giving-feedback).

## Next

[Briefing anatomy →](/concepts/briefing-anatomy) — how the synthesis prompt produces each section of the briefing.

Also worth reading:

- [**Tuning the pipeline**](/using/tuning-the-pipeline) — the Settings panel, knob by knob.
- [**Model selection**](/concepts/model-selection) — picking the right model for each stage.
- [**Review gates**](/using/review-gates) — what each pause shows and when to turn it off.
