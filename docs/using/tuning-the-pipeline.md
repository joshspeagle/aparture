# Tuning the pipeline

Once you have generated several briefings with the default configuration, you can tune the pipeline in the **Settings** panel (sidebar → Settings) to adjust which models run at each stage, how many papers receive full-text PDF analysis, how many API calls execute in parallel, and which optional stages or review gates remain active.

Because Stage 4 reads complete PDFs at tens of thousands of tokens per paper, it accounts for the majority of token expenditure on a typical run. The primary tuning objective is therefore ensuring that Stage 4 analyzes only the papers worth reading in full. The Settings panel reflects this structure: per-stage model slots sit at the top, batching and concurrency parameters live under Advanced Options, and review gates and post-briefing checks sit at the bottom.

## The mental model

Each pipeline stage narrows the candidate pool before the next stage executes, allowing fast, inexpensive models to screen hundreds of abstracts while frontier or mid-tier models read only the surviving shortlist:

| Stage              | What runs                                                                                                                            | Rough per-paper cost |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Stage 1 · fetch    | arXiv OAI-PMH / Atom API                                                                                                             | Free                 |
| Stage 2 · filter   | <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> triage | Fractions of a cent  |
| Stage 3 · scoring  | 0.0–10.0 relevance score with justification                                                                                          | A fraction of a cent |
| Stage 3.5 · post   | Comparative consistency pass on top N                                                                                                | A fraction of a cent |
| Stage 4 · PDFs     | Full-text PDF read of top-ranked papers                                                                                              | A few cents each     |
| Stage 5 · briefing | Editorial synthesis + hallucination audit                                                                                            | A few cents per run  |

Aparture computes cost estimates automatically so you do not have to calculate token totals by hand. Gates 2 and 3 display the projected cost of the stage they hold back, and once a run completes, the Download Report card shows a per-stage cost breakdown computed from actual token usage and the model registry pricing (`utils/models.js`), using active promotional rates before their expiration date and list prices thereafter. When a custom model has no price entry in the registry, the cost estimate for that stage is omitted.

## Per-stage model slots

Every LLM stage reads from an independent model slot, with all-Google defaults configured in `DEFAULT_CONFIG`:

| Slot                  | Setting label                        | Default                 | What it drives                                                                                                                             |
| --------------------- | ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `filterModel`         | Quick Filter Model                   | `gemini-3.5-flash-lite` | Stage 2 <span class="verdict is-yes">YES</span>/<span class="verdict is-maybe">MAYBE</span>/<span class="verdict is-no">NO</span> verdicts |
| `scoringModel`        | Abstract Scoring Model               | `gemini-3.6-flash`      | Stage 3 abstract relevance scoring                                                                                                         |
| `postProcessingModel` | Review Model (under post-processing) | `gemini-3.6-flash`      | Stage 3.5 comparative consistency pass                                                                                                     |
| `pdfModel`            | Deep PDF Analysis Model              | `gemini-3.8-flash`      | Stage 4 full-text PDF analysis                                                                                                             |
| `briefingModel`       | Briefing Model (synthesis + suggest) | `gemini-3.8-flash`      | Stage 5 synthesis, hallucination audit, editor questions, and profile refinement                                                           |
| `quickSummaryModel`   | Quick-Summary Model (briefing prep)  | `gemini-3.5-flash-lite` | ~300-word per-paper summary generated in parallel just before synthesis                                                                    |
| `notebookLMModel`     | (chosen on the Podcast card)         | `gemini-3.8-flash`      | Optional podcast discussion guide bundle                                                                                                   |

In the Settings UI, `postProcessingModel` (**Review Model**) appears only when **Enable Post-Processing** is checked. Because `postProcessingModel` remains on `gemini-3.6-flash` when you change `scoringModel`, users running without a Google API key should either assign `postProcessingModel` to their active provider or uncheck **Enable Post-Processing**. The `notebookLMModel` slot is selected directly on the Podcast card inside the briefing view. All model dropdowns are locked while a pipeline run is in progress.

When assigning models to slots, match model capability to stage token volume and combine providers freely across stages.

### Spend on what reads the most

Stage 4 PDF analysis processes complete manuscripts (including figures, equations, and tables) at tens of thousands of input tokens per paper. Assigning a stronger model to `pdfModel` justifies its cost through more accurate technical summaries, better methodological extraction, and fewer unsupported claims flagged during the Stage 5 audit. Upgrading `pdfModel` improves briefing quality more directly than upgrading any earlier stage.

Stage 5 synthesis reads all final-round full reports alongside your profile in a single call. Because `briefingModel` executes once per briefing (plus once for the audit) rather than once per paper, upgrading `briefingModel` adds much less cost per run than upgrading `pdfModel`.

### Keep filtering and scoring lightweight {#dont-spend-on-what-filters}

The Stage 2 quick filter evaluates every fetched abstract (often 100 or more per day) to separate plausible candidates from clear non-matches. Lightweight, low-latency models such as `gemini-3.5-flash-lite`, `claude-haiku-5.5`, or `gpt-6-luna` handle binary and ternary abstract triage well at minimal cost.

Stage 3 abstract scoring ranks the surviving abstracts on a 0.0–10.0 scale. Mid-tier models such as `gemini-3.6-flash`, `claude-sonnet-5.5`, or `gpt-6.1-sol` provide reliable calibration across batches without incurring flagship token rates (see [Model selection](/concepts/model-selection) for per-stage recommendations).

### Mixing providers is fine

Each stage slot operates independently and requires only a valid API key for the provider assigned to that slot. For example, you can run Gemini Flash-Lite on `filterModel`, Claude Sonnet on `scoringModel`, Claude Opus or GPT-6.1 Sol on `pdfModel`, and Gemini Flash on `briefingModel` within the same pipeline run. See [Model selection](/concepts/model-selection) for complete provider lineups and cost estimates.

## Parallelism

Parallelism settings control how many API calls fire concurrently at each batch-capable stage (`filterConcurrency`, `scoringConcurrency`, `postProcessingConcurrency`, `pdfAnalysisConcurrency`, and `quickSummaryConcurrency`), defaulting to 3 (or 5 for quick summaries) and clamped to the range 1–20.

### Parallel filter calls

**Parallel Filter Calls** (`filterConcurrency`, default 3, range 1–20) sets how many `/api/quick-filter` batches execute concurrently. Because Stage 2 screens every fetched paper, increasing `filterConcurrency` yields the largest wall-clock speedup on high-volume category sets: filtering 250 papers at `filterBatchSize: 3` requires roughly 84 batches, so raising concurrency from 1 to 5 reduces Stage 2 duration by roughly a factor of five.

On Anthropic models, the worker pool runs a single-flight cache warmup where the first batch completes alone to populate the ephemeral prompt-cache prefix before sibling workers launch. Google and OpenAI workers start concurrently without a warmup barrier.

### Parallel scoring calls

**Parallel Scoring Calls** (`scoringConcurrency`, default 3, range 1–20) sets how many `/api/score-abstracts` batches run concurrently in Stage 3. Total scoring batches scale with the Stage 2 pass-through rate (for example, a 60% pass rate on 250 papers produces 50 batches at `scoringBatchSize: 3`), and Anthropic models apply the same single-flight prompt-cache warmup as Stage 2.

### Parallel review calls

**Parallel Review Calls** (`postProcessingConcurrency`, default 3, range 1–20) sets how many `/api/rescore-abstracts` batches run concurrently during the optional Stage 3.5 consistency pass when **Enable Post-Processing** is active.

### Parallel PDF calls

**Papers to Analyze** (`maxDeepAnalysis`, default 30, range 1–100) caps the number of papers sent to Stage 4, while **Parallel PDF Calls** (`pdfAnalysisConcurrency`, default 3, range 1–20) sets how many PDF LLM analyses run in parallel. Server-side PDF downloads from arXiv are serialized with a 15-second spacing to honor the crawl delay specified in arXiv's `robots.txt` (with a Playwright reCAPTCHA fallback consuming two spacing slots: one for the abstract page and one for the PDF). Because downloads are spaced 15 seconds apart, downloading 30 PDFs requires at least 7.5 minutes regardless of LLM concurrency; once each PDF is downloaded, the LLM analysis workers run in parallel:

- **Anthropic**: The first worker completes its call alone so the shared prompt-cache prefix is written once before remaining workers read from it.
- **Google and OpenAI**: All workers start as soon as their PDF bytes are available.

### Parallel quick-summary calls

**Parallel Quick-Summary Calls** (`quickSummaryConcurrency`, default 5, range 1–20), located under **Briefing Options** in Advanced Options, controls how many `/api/analyze-pdf-quick` requests run in parallel during Stage 5 to generate the ~300-word inline paper summaries.

### Tuning guidance

A concurrency of 3 works reliably across standard provider tiers. On higher rate-limit tiers (Anthropic Tier 3+, Google paid Tier 2+, or OpenAI Launch tier and above), raising concurrency to 5–8 reduces run duration; on free-tier Google keys or entry-level tiers that return HTTP 429 errors, lower concurrency to 1–2.

Aparture coordinates rate-limit recovery across workers automatically. Whenever any worker receives an HTTP 429 (rate-limited), 503 (unavailable), or Anthropic 529 (overloaded) response, all concurrent workers targeting that provider pause for the `Retry-After` duration (capped at 60 seconds, or 5 seconds when no header is present) before retrying with exponential jittered backoff up to `maxRetries` retries (default 4, for 5 total attempts). Non-retryable client errors fail immediately on the first attempt with the provider's diagnostic message, including authentication failures (401, 403), invalid model IDs or malformed payloads (400, 404), oversized requests (413), and 422 responses other than safety refusals or reCAPTCHA notices. At the end of each stage, the activity log reports how many batches hit rate limits, and when a Gemini Flash-Lite stage is configured with enough batches and concurrency to exceed roughly 60 requests per minute, Aparture logs a pre-flight warning before starting the stage.

### When a provider declines on content grounds

Provider safety-classifier refusals arrive as HTTP 200 responses whose payload declines to generate content (`stop_reason: "refusal"` on Anthropic, `content_filter` or a `refusal` field on OpenAI, and `blockReason` or a safety `finishReason` on Google).

Because safety-classifier refusals are deterministic for a given prompt and model, retrying the identical call would waste `maxRetries` attempts and bill input tokens each time for the same refusal. Aparture bypasses the retry ladder on safety refusals and applies the policy selected under **Settings → Query Options → On Safety Refusal**:

| Policy                      | `refusalPolicy` | What happens                                                                                                                                            |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skip and continue**       | `skip`          | Default. Drops the affected paper or batch, records the refusal metadata, and continues the run so an unattended run completes cleanly.                 |
| **Retry on fallback model** | `fallback`      | Re-issues the request once against `refusalFallbackModel` (which may use a different provider), then skips the item if the fallback model also refuses. |
| **Stop the run**            | `fail`          | Halts the pipeline immediately on the first safety refusal and displays the stage, provider, and instructions for switching to `skip` or `fallback`.    |

Every safety refusal is surfaced in an end-of-run summary card listing the declined paper or batch, the stage, and the refusal category so that skipped papers are never dropped silently.

When configuring safety-refusal handling, note how synthesis calls, fallback billing, and cross-provider rate limits behave:

- **Stage 5 synthesis cannot skip**: Because `/api/synthesize` generates the entire briefing in a single call, a safety refusal during synthesis halts the briefing step with an explicit error while leaving your Stage 4 paper analyses intact so you can re-run synthesis on a different `briefingModel`.
- **Fallback model selection is explicit**: Because `fallback` bills tokens to a model outside your primary slot assignment, you must set `refusalFallbackModel` explicitly; if `refusalFallbackModel` is left empty, `fallback` degrades safely to `skip`.
- **Cross-provider fallback caching**: When `refusalFallbackModel` points to a different provider, fallback calls honor that provider's rate-limit barrier, and on Anthropic models the first fallback call warms the prompt cache before subsequent fallback calls execute.

Safety refusals are rare in astrophysics, statistics, and core machine learning, occurring primarily in cybersecurity (`cs.CR`) or quantitative biology (`q-bio.*`) abstracts whose terminology triggers an overly broad provider classifier.

## Batch sizes

Batch size settings control how many abstracts are grouped into a single API request during Stages 2, 3, and 3.5:

| Setting            | Default | Reasonable range | Notes                                                                        |
| ------------------ | ------- | ---------------- | ---------------------------------------------------------------------------- |
| Filter Batch Size  | 3       | 3–10             | Compact prompts; larger batches increase throughput on high-volume runs      |
| Scoring Batch Size | 3       | 3–8              | Each item includes a full abstract and requires a 2–3 sentence justification |
| Review Batch Size  | 5       | 3–10             | Stage 3.5 compares multiple abstracts side by side within each batch         |
| PDF analysis batch | 1       | (always 1)       | Fixed at 1 PDF per request; scale throughput via **Parallel PDF Calls**      |

Increasing batch sizes reduces request count when your provider enforces strict requests-per-minute limits and your selected model has a large context window; decreasing batch sizes prevents context-window truncation and keeps per-abstract scoring justifications sharp.

## Which papers advance where

Candidate advancement between stages is governed by the filter verdict checkboxes and the **Papers to Analyze** cap.

### Filter verdicts to advance

Under **Categories to Process** (Advanced Options → Filter Options), three checkboxes (`YES`, `MAYBE`, and `NO`) determine which Stage 2 buckets advance to Stage 3 abstract scoring. The default selection is <span class="verdict is-yes">YES</span> + <span class="verdict is-maybe">MAYBE</span>. Unchecking <span class="verdict is-maybe">MAYBE</span> lowers Stage 3 scoring costs on high-volume days at the expense of dropping interdisciplinary or borderline papers that the fast filter model was uncertain about.

### Papers to Analyze

**Papers to Analyze** (`maxDeepAnalysis`, default 30, range 1–100) caps how many papers advance from Stage 3/3.5 into Stage 4 full-text PDF analysis. After abstract scoring ranks all surviving papers, the top `N` papers by score (modified by any manual stars or dismissals at Gate 2) advance to Stage 4, while lower-ranked papers remain visible in the scored list without downloading their PDFs.

Because Stage 4 is the primary cost driver of the pipeline, adjusting **Papers to Analyze** affects total run cost more directly than any other numeric parameter.

::: info Top-N selection without a fixed minimum score
Stage 4 advancement selects the top `N` papers by score rather than enforcing a hard minimum score cutoff. On a sparse submission day, a paper scoring 3.5 may fall within the top 30 and receive full-text analysis, whereas on a dense submission day a paper scoring 6.5 at rank 31 will fall just below the automatic cutoff unless you star it at Gate 2.
:::

## Optional stages

### Post-processing

**Enable Post-Processing** (enabled by default) runs the Stage 3.5 comparative consistency pass across the top `postProcessingCount` scored abstracts (default 50). Papers are grouped into small shuffled batches (`postProcessingBatchSize`, default 5) and re-evaluated side by side so the model can align score calibration across independent Stage 3 batches.

Stage 3.5 runs on `postProcessingModel` (**Review Model**, default `gemini-3.6-flash`). If you do not have a Google API key configured, either switch **Review Model** to your active provider or uncheck **Enable Post-Processing** so Stage 3.5 batches do not fail and fall back to raw Stage 3 scores. You can also disable post-processing when you want faster turnaround during rapid profile iteration.

### Quick filter

Whether Stage 2 executes is controlled by the `useQuickFilter` flag (default `true`) in saved application state. When your selected arXiv categories yield a small daily volume (fewer than roughly 30 papers per run), skipping Stage 2 and sending all fetched abstracts directly to Stage 3 adds negligible cost; on high-volume categories such as `cs.LG` or `cs.CL`, keeping the quick filter enabled reduces Stage 3 scoring volume substantially.

## Review & confirmation

The **Review & confirmation** section in Settings controls pause gates, hallucination audit retries, editor clarification questions, and automatic profile proposals:

| Checkbox                                                                                        | Default | What it does                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pause after filter to review overrides                                                          | on      | Pauses at Gate 1 (`pauseAfterFilter`) so you can move papers between <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-no">NO</span> buckets      |
| Pause before deep analysis                                                                      | on      | Pauses at Gate 2 (`pauseBeforeDeepAnalysis`) after scoring so you can star borderline papers into the PDF set or exclude low-relevance papers                                                                     |
| Pause before briefing to review scores and add feedback                                         | on      | Pauses at Gate 3 (`pauseBeforeBriefing`) so you can star, dismiss, or comment on analyzed papers before synthesis                                                                                                 |
| Auto-retry briefing if hallucination check returns <span class="verdict is-no">YES</span>       | on      | Re-runs Stage 5 synthesis once with a retry hint whenever the audit flags unsupported claims (`briefingRetryOnYes`)                                                                                               |
| Auto-retry briefing if hallucination check returns <span class="verdict is-maybe">MAYBE</span>  | off     | Re-runs Stage 5 synthesis once when the audit returns an uncertain verdict (`briefingRetryOnMaybe`)                                                                                                               |
| Ask me up to two questions after each briefing when the day's papers expose a gap in my profile | on      | Runs `/api/editor-questions` on `briefingModel` after the audit to append up to two tap-to-answer clarification questions under **Notes from the editor** (`editorQuestions`)                                     |
| Propose profile changes after a briefing when my recent feedback adds up                        | on      | Runs a background refinement check after a production briefing when unweighed feedback reaches the proposal threshold (`autoProposals`; see [automatic proposals](/using/refining-over-time#automatic-proposals)) |

### pauseBeforeDeepAnalysis

`pauseBeforeDeepAnalysis` (default: **on**) pauses the pipeline at Gate 2 between Stage 3.5 post-processing and Stage 4 PDF analysis, displaying the projected PDF stage cost above the **Will PDF (top-N)**, **Borderline**, and **Low score** groups. Each row provides **STAR** and **DISMISS** controls so that the resulting PDF candidate set equals `(top-N) ∪ {starred papers} − {dismissed papers}`, allowing you to exceed `maxDeepAnalysis` whenever you star extra borderline papers. The banner also includes the free-text **"+ feedback on this scoring round"** input for recording run-level `score-review` observations (see [Review gates → Gate 2](/using/review-gates#gate-2-before-pdf-analysis-score-review)).

### Skip remaining gates this run

Clicking **Skip remaining gates this run** in the banner of Gate 1, Gate 2, or Gate 3 bypasses all subsequent pause gates for the rest of the current run without modifying your persistent Settings checkboxes. Keep the three pause gates enabled while calibrating a new profile or category set, and disable them selectively once filter buckets and score rankings match your expectations across consecutive runs (see [Review gates](/using/review-gates)).

For the synthesis audit checkboxes, keeping `briefingRetryOnYes` enabled catches and repairs confirmed unsupported claims automatically at the cost of one additional synthesis and audit call on the rare runs where `YES` triggers. Keeping `briefingRetryOnMaybe` disabled avoids spending an extra synthesis pass on strict paraphrase flags. Either retry path executes at most once per briefing.

## arXiv fetching

Under Advanced Options, arXiv harvesting is configured through the ingestion mode, window semantics, minimum papers per subcategory, fill-up lookback days, and cache TTL. See [arXiv ingestion](../concepts/arxiv-ingestion.md) for the mechanics of each setting.

### Duplicate detection

Aparture maintains a rolling 90-day **seen-papers index** in browser `localStorage` (`aparture-seen-papers-index`) recording the `arxivId` of every paper processed in your saved briefings. By default, **Remove duplicate papers** in Settings drops previously seen papers after Stage 1 fetch before any LLM calls execute, saving tokens and preventing cross-run repetition. If you uncheck **Remove duplicate papers**, duplicate submissions remain in the run and display a muted _"seen ‹date›"_ badge across filter, scoring, and briefing cards.

On your first run after upgrading, Aparture seeds the seen-papers index asynchronously from your existing briefing files on disk. If you start a run while that initial migration is still in progress, the status line notes `seen-papers index still loading` and processes the run without deduplication; all subsequent runs use the populated index.

Papers are committed to the seen-papers index only when a **briefing is saved** at the end of Stage 5. If you stop or abort a run at Gate 1, Gate 2, or Gate 3 before synthesis completes, none of that run's fetched papers are marked as seen, so restarting the pipeline will fetch them again. Once a briefing saves, every paper that entered Stage 2 filtering during that run (`yes`, `maybe`, and `no` buckets alike) is recorded in the index for 90 days. To rebuild the index from scratch, delete the `aparture-seen-papers-index` key under DevTools → Application → Local Storage and reload the page.

When duplicate removal is enabled, note how profile edits and subcategory fill-ups interact with the 90-day index:

- **Profile updates do not resurrect previously filtered papers**: A paper marked `NO` under an earlier profile remains in the 90-day seen-papers index after you broaden your profile; disable **Remove duplicate papers** temporarily for one run if you want to re-evaluate recent days against a newly rewritten profile.
- **Subcategory fill-ups run before deduplication**: Because Stage 1 checks `minPapersPerSubcategory` before the in-memory deduplication pass removes previously seen papers, a subcategory whose recent papers were already seen in yesterday's run may end up with fewer than `minPapersPerSubcategory` net papers after deduplication.

## A few common configurations

Starting from the shipped defaults (all-Google models, all three review gates on, `briefingRetryOnYes` on, `briefingRetryOnMaybe` off, and **Papers to Analyze** set to 30), three common adjustments cover most workflows:

- **Cost-sensitive**: Assign Flash-Lite, Haiku 5.5, or Luna models to `filterModel` and `scoringModel`, lower **Papers to Analyze** to 10–15, uncheck **Enable Post-Processing**, and keep `briefingRetryOnMaybe` off.
- **Highest quality**: Assign a flagship model (`gemini-4-argon`, `claude-opus-5.5`, `claude-fable-5.1`, or `gpt-6-astra` / `gpt-6.1-sol`) to `pdfModel` and `briefingModel` while keeping a calibrated mid-tier model on `scoringModel` (see [Model selection](/concepts/model-selection)), keep **Enable Post-Processing** on, raise **Papers to Analyze** to 50 or more, and enable both hallucination retry checkboxes.
- **Unattended**: Uncheck all three pause gates (or click **Skip remaining gates this run** at Gate 1), optionally uncheck both hallucination retry boxes to bound run duration, and set **Papers to Analyze** to a fixed count (such as 20 or 25) so daily token spend remains predictable regardless of submission spikes.

## Where to see what a past briefing used

Every saved briefing records its full stage configuration inside the expandable **Generation details** panel beneath the briefing body. Inspecting Generation details on an archived briefing shows the exact profile snapshot, stage model IDs, category list, filter bucket counts, gate and retry settings, and audit verdict from that run (see [Reading a briefing → Generation provenance](/using/reading-a-briefing#generation-provenance)).

## Next

Continue to [Review gates →](/using/review-gates) for a detailed guide to using or disabling each of the three interactive checkpoints.

Related guides:

- [**The pipeline**](/concepts/pipeline): Architectural overview of Stages 1 through 5 and their data contracts.
- [**Model selection**](/concepts/model-selection): Complete model registry, pricing tables, and multi-provider configurations.
- [**Prompts**](/reference/prompts): How to customize the hot-reloadable scoring and synthesis prompt files on disk.
