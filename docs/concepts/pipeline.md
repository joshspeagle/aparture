# The pipeline

A tour of Aparture's six-stage paper-to-briefing pipeline — what each stage does, how long it takes, how much it costs, and where it can pause for you to weigh in.

## The six stages at a glance

Every run passes through the same waterfall. Each stage reads the output of the one before it, does less work than the previous one (because papers have been filtered out), and uses a more expensive model as the stakes go up.

```
┌──────────────────┐
│ 1. fetchPapers   │  arXiv API · no LLM · 10–60 s · free
└────────┬─────────┘
         │ all papers in window
         ▼
┌──────────────────┐
│ 2. quickFilter   │  fast model · YES / MAYBE / NO · 5–30 s/100 papers
└────────┬─────────┘  ~$0.0001–0.0003 per paper
         │
         │   ⏸  pauseAfterFilter (default: on) — review buckets, override verdicts
         │
         │ YES + MAYBE papers
         ▼
┌──────────────────┐
│ 3. scoreAbstracts│  scoring model · 0–10 scores + justifications
└────────┬─────────┘  10–60 s/100 papers · ~$0.0005–0.002 per paper
         │ scored papers (score > 0)
         ▼
┌──────────────────┐
│ 3.5. postProcess │  comparative re-score of top N (default 50)
└────────┬─────────┘  5–20 s · ~$0.001–0.003 per paper · optional
         │ re-ranked papers
         ▼
┌──────────────────┐
│ 4. analyzePDFs   │  deep PDF model · full-text analysis + final score
└────────┬─────────┘  30–120 s for top 10 · ~$0.02–0.10 per paper
         │
         │   ⏸  pauseBeforeBriefing (default: on) — star / dismiss / comment
         │
         │ papers + deepAnalysis objects
         ▼
┌──────────────────┐
│ 5. briefing      │  quick summaries → synthesis → hallucination audit
└──────────────────┘  15–60 s · ~$0.05–0.30 per briefing
```

Two optional pause gates let you steer the run before expensive work happens. Both are on by default and can be toggled in Settings → Review & confirmation.

## Stage 1: fetch papers

**What it does.** Queries the arXiv API for every paper in your selected categories, within a configurable date window (default: last 24 hours). If the window returns too few papers, Aparture widens it automatically — trying 3, 7, and then 14 days back before giving up. Deduplicates cross-listed papers and sorts chronologically.

**Inputs.** `selectedCategories`, `daysBack`.

**Output.** A list of raw papers with title, abstract, authors, and PDF URL.

**Cost.** $0. The arXiv API is free.

**Duration.** 10–60 seconds, depending on category count and arXiv load.

**Pause gates.** None.

## Stage 2: quick filter

**What it does.** Batches papers and asks a fast, cheap model to give each one a YES / MAYBE / NO verdict against your research profile, along with a one-sentence summary and justification. This is triage, not scoring — the goal is to drop papers that are clearly irrelevant before the more expensive stages run. Can be disabled entirely with `useQuickFilter: false`.

You can override any verdict in the review-gate UI. Overrides are recorded as `filter-override` feedback events and feed into the Suggest Improvements flow as a "profile may be too narrow or too broad" signal.

**Inputs.** Papers from stage 1, your `profile.content`, `filterModel` (default: `gemini-3.1-flash-lite`), `filterBatchSize` (default: 3), `categoriesToScore` (default: `['YES', 'MAYBE']`).

**Output.** Papers bucketed into `yes` / `maybe` / `no` with filter summaries. Only YES + MAYBE advance to stage 3.

**Cost.** ~$0.0001–0.0003 per paper (~50–150 input tokens).

**Duration.** 5–30 seconds per 100 papers.

**Pause gate.** `pauseAfterFilter` (default: on). The pipeline halts at the `filter-review` stage. The UI displays the three buckets and lets you click any paper's verdict pill to override it before proceeding.

## Stage 3: score abstracts

**What it does.** Sends each surviving paper's full abstract to a stronger scoring model and asks for a 0.0–10.0 relevance score (one decimal place) with a 2–3 sentence justification. Papers that score exactly 0 are dropped. This is the main quality filter — everything downstream uses these scores to decide which papers deserve expensive deep analysis, and the number you see on each paper card in the briefing traces back to this stage.

### How the score is calculated

The scoring prompt asks the model to evaluate each paper on two dimensions (0–10 each) and average them with equal weight:

**Research alignment** — how well the paper matches your profile:

| Range | Meaning                                                   |
| ----- | --------------------------------------------------------- |
| 9–10  | Directly addresses your core research areas, perfect fit  |
| 7–8   | Strong overlap with stated interests                      |
| 5–6   | Moderate connection                                       |
| 3–4   | Weak, peripherally related                                |
| 0–2   | Little to no connection                                   |

**Paper quality** — how impactful or well-executed the work is:

| Range | Meaning                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| 9–10  | Genuinely transformative — likely to be remembered as a landmark in 5–10 years   |
| 7–8   | Significant methodological advance or major discovery with clear impact          |
| 5–6   | Competent work, adequately executed using standard approaches                    |
| 3–4   | Incremental work with limited novelty                                            |
| 0–2   | Poor execution, outdated, or fundamentally flawed                                |

**Final score = (Alignment × 0.5) + (Quality × 0.5)**, to one decimal place.

The prompt explicitly calibrates the Quality dimension strictly: most competent work is expected to score 4–6 on quality, not 7+. A 9 on the final score therefore requires both strong profile alignment *and* a paper the model considers genuinely transformative — it's a deliberately rare event. In practice a run's highest-scored paper often lands in the 7.5–8.5 range, and 9+ is reserved for the handful of papers that clear both bars.

This rubric lives in the `pages/api/score-abstracts.js` prompt; see [Reference: prompts](/reference/prompts) for how to edit it if your field benefits from a different calibration (e.g., purely applied work that shouldn't cap at 6 on quality).

**Inputs.** Papers from stage 2, `profile.content`, `scoringModel` (default: `gemini-3-flash`), `scoringBatchSize` (default: 3).

**Output.** `scoredPapers` with `relevanceScore`, `scoreJustification`, and `initialScore` (preserved for post-processing). Papers that failed to score are kept separately in `failedPapers` and don't advance.

**Cost.** ~$0.0005–0.002 per paper (~200–600 input tokens).

**Duration.** 10–60 seconds per 100 papers.

**Pause gates.** None.

## Stage 3.5: post-process scores

**What it does.** An optional consistency pass on the top N scored papers (default: 50). Papers are shuffled and compared head-to-head in batches, and the model adjusts scores up or down to bring outliers into line with the broader ranking. Records `adjustmentReason` and confidence (HIGH / MEDIUM / LOW) alongside the new score. Disable with `enableScorePostProcessing: false`.

**Why it matters.** Different batches can drift in calibration — early batches may score stricter than late ones. This pass normalises the ranking without changing which papers advance.

**Inputs.** Top N papers from stage 3, `profile.content`, `postProcessingModel` (default: `gemini-3-flash`), `postProcessingCount` (default: 50), `postProcessingBatchSize` (default: 5).

**Output.** `scoredPapers` updated with `adjustedScore`, `adjustmentReason`, and a `scoreAdjustment` trail.

**Cost.** ~$0.001–0.003 per paper (~300–800 tokens per comparison).

**Duration.** 5–20 seconds (only touches the top N).

**Pause gates.** None.

## Stage 4: analyze PDFs

**What it does.** For the top N papers (default: 30 via `maxDeepAnalysis`), fetches the full PDF from arXiv and asks a vision-capable model to produce a structured deep analysis — key findings, methodology, limitations, a final relevance score. Both the pre-PDF and final scores are preserved, so you can see how much the PDF moved the score.

PDF downloads are serialised server-side (~5s between arXiv requests) to respect arXiv's rate limits, but the LLM analyses themselves run in parallel via a worker pool. Default concurrency is 3 workers (tunable via `pdfAnalysisConcurrency`, 1–20). If arXiv returns reCAPTCHA instead of a PDF, Aparture falls back to a Playwright browser with cached session cookies.

On **Anthropic** providers, the pool applies a cache-warmup barrier: the first worker finishes its call alone so the ephemeral prompt-cache entry is primed once, then the remaining workers start and hit the cache on every subsequent paper. This trades ~3–6 s on the first paper for ~90% input-token discount on the rest. Google and OpenAI have no warmup — all workers start immediately.

**Inputs.** Top N papers from stage 3.5, `profile.content`, `pdfModel` (default: `gemini-3.1-pro`), `pdfAnalysisConcurrency` (default: 3).

**Output.** `finalRanking` — papers augmented with `deepAnalysis`, `finalScore`, `preAnalysisScore`, and `pdfScoreAdjustment`.

**Cost.** ~$0.02–0.10 per paper (~4,000–25,000 input tokens depending on PDF length). This stage dominates the bill. Anthropic prompt caching (automatic on Anthropic models) reduces repeat-prefix input tokens by ~90%, which cuts the effective per-paper input cost by a comparable margin once warmup is done.

**Duration.** 30–120 seconds for the top 10 papers at the default concurrency of 3. Higher concurrency compresses wall-clock time but is bounded by provider rate limits (see [Tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-analyses)).

**Pause gates.** None within the stage, but a gate fires after it completes.

## Stage 5: briefing synthesis

After PDF analysis, the pipeline orchestrates the full briefing flow in one go:

1. **Map** each paper in `finalRanking` to a briefing-formatted entry, attaching engagement metadata (stars, dismissals, comments from your feedback events).
2. **Generate quick summaries** in parallel (five at a time) via `/api/analyze-pdf-quick` — ~300-word pre-reading summaries for the inline-expansion panels.
3. **Call `/api/synthesize`** to produce the structured briefing from your profile + papers + recent briefing history. The `briefingModel` (default: `gemini-3.1-pro`) gets the main synthesis prompt. Output is validated against a zod schema; if validation fails, a two-pass repair call attempts to fix the structure without re-inferring content.
4. **Call `/api/check-briefing`** to audit the briefing against the source corpus — a second, independent LLM pass looks for claims that aren't supported by the papers' abstracts, quick summaries, or full reports.
5. **Optionally retry** if the audit flags hallucinations (see the next section).
6. **Save** the briefing + generation metadata to localStorage with a 90-day rolling window.

**Inputs.** `finalRanking`, `profile.content`, `briefingModel` (synthesis + hallucination check), `quickSummaryModel` (per-paper compression run in parallel just before synthesis, default `gemini-3.1-flash-lite`), `quickSummaryConcurrency` (default 5, clamped 1–20), `briefingRetryOnYes` / `briefingRetryOnMaybe` retry policy, accumulated feedback events.

Unlike Stage 4's parallel PDF analysis, the quick-summary fan-out doesn't apply an Anthropic cache-warmup barrier: the default `quickSummaryModel` is a Google model (no caching), and even on an Anthropic model the per-paper input is small enough that racing cache-creates isn't worth an extra serialised first call.

**Output.** A saved briefing object + `briefingCheckResult` (verdict, justification, flagged claims) + cached quick summaries and full reports.

**Cost.** ~$0.05–0.30 per briefing:

- Quick summaries: ~$0.005–0.02 per paper (short model, 1–2 page compression).
- Synthesis: ~$0.02–0.15 (~3,000–8,000 input tokens).
- Hallucination check: ~$0.02–0.10 (~2,000–5,000 tokens).
- Retry if triggered: +~$0.02–0.15 for a second synthesis pass.

**Duration.** 15–60 seconds. Quick summaries run in parallel; synthesis and check run sequentially.

**Pause gate.** `pauseBeforeBriefing` (default: on). The pipeline halts at the `pre-briefing-review` stage after stage 4 finishes, giving you a chance to star, dismiss, or comment on papers before synthesis runs. Stars and dismissals influence which papers anchor which themes in the briefing.

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

When a retry runs, the synthesis prompt gets a retry hint summarising the flagged claims, and the audit runs again on the retried briefing. Flagged claims from the final pass are shown as a collapsible disclosure in the briefing UI, so you can see what the auditor flagged even if you decide to trust the briefing anyway.

::: tip Only one retry per briefing
The retry path fires at most once — a design choice to avoid runaway loops at the cost of accepting one stuck verdict. If the retry also flags, the second briefing is what you see.
:::

## The Download Report vs the briefing

Two outputs come out of a successful run, and they're different enough that conflating them causes persistent confusion.

The **briefing** is the editorial product: synthesis LLM output with an executive summary, themes, per-paper cards, and a hallucination audit. Stage 5 produces it, `components/briefing/BriefingView.jsx` renders it, and `useBriefing` saves it to the sidebar archive. It's the page you open day-to-day.

The **Download Report** is a flat markdown export compiled by `lib/analyzer/exportReport.js` from Stage 4's per-paper deep-analysis outputs. It has no editorial framing, no theme grouping, no profile-shaped "why it matters" — just the raw technical write-ups stitched together, one after another, with scores and metadata. No LLM call happens at export time; it's a deterministic compile of cached outputs. The card surfaces as soon as Stage 4 finishes, which means **it's visible during the pre-briefing pause** — you can export the technical detail without waiting on or running briefing synthesis at all.

Neither depends on the other existing. Rule of thumb: you'll read a briefing, you'll archive or share a report. If you want both, Stage 5 produces the briefing and the Download card keeps working in parallel. If you want only the report (e.g., unattended runs, archival pipelines), disable briefing synthesis or stop the run at Gate 2.

## Reading this alongside the UI

- The **Progress Timeline** (left side of the main area during a run) shows each of the six stages with a status icon and live progress counter.
- The **review-gate UIs** appear when `pauseAfterFilter` or `pauseBeforeBriefing` fire — they occupy the main area until you click "Continue to [next stage]".
- The **Download Report** card appears after Stage 4, regardless of whether Stage 5 has run. See the section above for what's in it and how it differs from the briefing.

## Where to tune what

- **Skip a stage?** Toggle `useQuickFilter` or `enableScorePostProcessing` in Settings. Both stages are safe to skip when your profile is narrow and well-calibrated.
- **Pick a different model per stage?** The config exposes `filterModel`, `scoringModel`, `postProcessingModel`, `pdfModel`, `briefingModel`, and `quickSummaryModel` as independent slots. See [Model selection](/concepts/model-selection) for recommended combinations.
- **Tune the briefing output?** Edit `prompts/synthesis.md` — it takes effect on the next run, no rebuild needed. See [Prompts](/reference/prompts).
- **Understand what stars and dismissals do?** They feed synthesis as engagement signals and become part of the briefing's framing. See [Giving feedback](/using/giving-feedback).

## Next steps

- [Briefing anatomy →](/concepts/briefing-anatomy) — how the synthesis prompt produces each briefing section.
- [Model selection →](/concepts/model-selection) — pick the right model for each stage.
- [Tuning the pipeline →](/using/tuning-the-pipeline) — thresholds, batch sizes, review gates.
