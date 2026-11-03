# The pipeline

Every Aparture run executes a five-stage pipeline that harvests daily arXiv submissions, filters and scores their abstracts against your research profile, reads the top-ranked PDFs in full, and synthesizes an audited briefing.

## The stages at a glance

Each stage consumes the output of the preceding stage while narrowing the candidate set, allowing lightweight models to screen hundreds of abstracts while higher-capacity models read only the papers that advance to Stage 4 and Stage 5. Three interactive review gates (highlighted in accent below) pause the pipeline between stages so you can inspect intermediate results and modify which papers advance:

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 720 620" style="width: 100%; height: auto; max-width: 720px; display: block; margin: 0 auto;" role="img" aria-label="Architecture diagram of Aparture pipeline stages 1 through 5 interleaved with the three interactive review gates">
    <defs>
      <marker id="pl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-text-3)" />
      </marker>
      <marker id="pl-arrow-brand" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-brand-1)" />
      </marker>
    </defs>
    <rect x="40" y="14" width="640" height="48" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="36" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">1. fetchPapers</text>
    <text x="205" y="36" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">arXiv OAI-PMH / Atom harvest + 90-day deduplication (no LLM · free)</text>
    <text x="60" y="53" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Output: all non-duplicate papers in submission window</text>
    <line x1="360" y1="62" x2="360" y2="82" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#pl-arrow)" />
    <rect x="40" y="84" width="640" height="48" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="106" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">2. quickFilter</text>
    <text x="205" y="106" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">filterModel · YES / MAYBE / NO abstract triage (~fractions of a cent/paper)</text>
    <text x="60" y="123" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Output: bucketed papers with 1-sentence summaries</text>
    <line x1="360" y1="132" x2="360" y2="152" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#pl-arrow-brand)" />
    <rect x="70" y="154" width="580" height="38" rx="19" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.6" />
    <text x="95" y="178" font-family="var(--vp-font-family-mono)" font-size="12.5" font-weight="700" fill="var(--vp-c-brand-1)">[Gate 1: pauseAfterFilter]</text>
    <text x="295" y="178" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Review YES / MAYBE / NO buckets and override verdicts</text>
    <line x1="360" y1="192" x2="360" y2="212" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#pl-arrow)" />
    <rect x="40" y="214" width="640" height="48" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="236" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">3. scoreAbstracts</text>
    <text x="205" y="236" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">scoringModel · 0.0 to 10.0 score + justification (~fractions of a cent/paper)</text>
    <text x="60" y="253" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Output: scoredPapers (relevanceScore &gt; 0)</text>
    <line x1="360" y1="262" x2="360" y2="282" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#pl-arrow)" />
    <rect x="40" y="284" width="640" height="48" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="306" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">3.5. postProcess</text>
    <text x="205" y="306" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">postProcessingModel · comparative re-score of top N (default 50, optional)</text>
    <text x="60" y="323" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Output: calibrated ranking with adjustedScore and confidence</text>
    <line x1="360" y1="332" x2="360" y2="352" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#pl-arrow-brand)" />
    <rect x="70" y="354" width="580" height="38" rx="19" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.6" />
    <text x="95" y="378" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-brand-1)">[Gate 2: pauseBeforeDeepAnalysis]</text>
    <text x="340" y="378" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Star borderline papers or dismiss before PDF run</text>
    <line x1="360" y1="392" x2="360" y2="412" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#pl-arrow)" />
    <rect x="40" y="414" width="640" height="48" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="436" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">4. analyzePDFs</text>
    <text x="205" y="436" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">pdfModel · full-text PDF read, keyFigure crop, and finalScore (~cents/paper)</text>
    <text x="60" y="453" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Output: finalRanking + deepAnalysis objects + Download Report</text>
    <line x1="360" y1="462" x2="360" y2="482" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#pl-arrow-brand)" />
    <rect x="70" y="484" width="580" height="38" rx="19" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.6" />
    <text x="95" y="508" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-brand-1)">[Gate 3: pauseBeforeBriefing]</text>
    <text x="315" y="508" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Star, dismiss, or comment to steer synthesis</text>
    <line x1="360" y1="522" x2="360" y2="542" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#pl-arrow)" />
    <rect x="40" y="544" width="640" height="60" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="567" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="700" fill="var(--vp-c-text-1)">5. briefingClient: quickSummaries + synthesize + checkBriefing + editorQuestions</text>
    <text x="60" y="586" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Parallel ~300w quick summaries, editorial synthesis, hallucination audit, and editor questions</text>
    <text x="60" y="600" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Output: archived briefing in reports/briefings/&lt;id&gt;.json (~a few cents/run)</text>
  </svg>
</div>

All three review gates are enabled by default and can be toggled in **Settings → Review & confirmation**. Total wall-clock time depends on daily submission volume, provider latency, and the 15-second arXiv PDF download spacing in Stage 4; a 100-paper day at default concurrency typically completes within several minutes, with Stage 4 accounting for the longest portion.

## Stage 1: fetch papers

- **Operation**: Harvests new submissions across your selected categories from arXiv's OAI-PMH endpoint, falling back automatically to the Atom API if OAI-PMH fails. Because `daysBack` (default 1) counts active submission days rather than calendar days, Aparture locates the most recent date with new submissions in your categories and retains that day plus the `daysBack − 1` submission days preceding it, preventing empty runs on weekends or holidays. Whenever an individual subcategory returns fewer than `minPapersPerSubcategory` papers (default 5), Aparture extends the lookback window for that subcategory alone across cumulative slices of 3, 7, and 14 extra days until the minimum is reached. Cross-listed papers are deduplicated across your selected subcategories and sorted newest first.
- **Inputs**: `selectedCategories`, `daysBack`, `arxivWindowSemantics`, `arxivIngestion`, `minPapersPerSubcategory`, and `lookbackExtensions`.
- **Output**: A deduplicated array of raw paper records containing title, abstract, author list, categories, and PDF URL.
- **Cost and pause gates**: Stage 1 is free and runs without a pause gate.

See [arXiv ingestion](./arxiv-ingestion.md) for the OAI-PMH and Atom harvesting mechanics, date-window anchoring, subcategory fill-ups, and caching.

Immediately after Stage 1 harvesting and any subcategory fill-ups complete, an in-memory **deduplication pass** checks the fetched papers against a rolling 90-day client-side index of `arxivId`s from previously saved briefings. In Remove mode (default), previously seen papers are dropped before Stage 2; in Flag mode, they remain in the pipeline with a visual badge. Because the index updates only when a briefing is saved at the end of Stage 5, stopping a run early never marks its papers as seen (see [Tuning the pipeline](../using/tuning-the-pipeline.md#duplicate-detection)).

## Stage 2: quick filter

- **Operation**: Groups fetched abstracts into small batches and queries a fast, low-cost model (`filterModel`) to assign each paper a <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">NO</span> verdict against your research profile, accompanied by a one-sentence summary and brief reasoning. This triage stage removes clearly unrelated papers before Stage 3 scoring, and can be bypassed altogether by setting `useQuickFilter: false` in saved configuration.
- **Feedback integration**: You can override any paper's bucket assignment at Gate 1 (`filter-review`) or in the Pipeline view after the run ends. Every manual change logs a `filter-override` event that routes the paper accordingly during an active run and signals to the profile refinement flow where your profile boundaries are too narrow or too broad.
- **Inputs**: Deduplicated papers from Stage 1, `profile.content`, `filterModel` (default `gemini-3.5-flash-lite`), `filterBatchSize` (default 3), `filterConcurrency` (default 3), and `categoriesToScore` (default `['YES', 'MAYBE']`).
- **Output**: Papers partitioned into `yes`, `maybe`, and `no` buckets with filter summaries, where only buckets listed in `categoriesToScore` advance to Stage 3.
- **Cost**: Fractions of a cent per paper (roughly 50 to 150 input tokens per abstract).
- **Pause gate**: `pauseAfterFilter` (enabled by default) halts the pipeline at Gate 1 (`filter-review`) so you can inspect the three buckets and override verdicts before Stage 3 begins.

## Stage 3: score abstracts

- **Operation**: Evaluates the full abstract of every paper advancing from Stage 2 using `scoringModel`, producing a 0.0–10.0 relevance score (to one decimal place) and a 2–3 sentence justification. Papers receiving a score of exactly 0.0 are dropped. Downstream stages use these scores to select candidates for Stage 4 full-text PDF reading.

### How the score is calculated

The Stage 3 prompt (`prompts/rubric-scoring.md`) evaluates each abstract along two 0–10 dimensions and averages them with equal weight.

**Research alignment** measures how closely the paper matches your profile:

| Range | Meaning                                                  |
| ----- | -------------------------------------------------------- |
| 9–10  | Directly addresses your core research areas, perfect fit |
| 7–8   | Strong overlap with stated interests                     |
| 5–6   | Moderate connection                                      |
| 3–4   | Weak, peripherally related                               |
| 0–2   | Little to no connection                                  |

**Paper quality** measures methodological rigor and scientific impact:

| Range | Meaning                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| 9–10  | Transformative contribution likely to serve as a reference point over 5–10 years |
| 7–8   | Significant methodological advance or major discovery with clear impact          |
| 5–6   | Competent work, adequately executed using standard approaches                    |
| 3–4   | Incremental work with limited novelty                                            |
| 0–2   | Poor execution, outdated, or fundamentally flawed                                |

The combined score is computed as:

$$\text{Final score} = (0.5 \times \text{Alignment}) + (0.5 \times \text{Quality})$$

rounded to one decimal place. Because the rubric calibrates the Quality dimension strictly (assigning 4–6 to competent standard work and reserving 7+ for substantial methodological or empirical advances), a combined score of 9.0 or higher requires both direct profile alignment and a landmark contribution. On a typical run, the highest-scored papers fall in the 7.5–8.5 range.

Because `prompts/rubric-scoring.md` is read from disk on every call, any edits you make to the rubric take effect on the next run without rebuilding the application (see [Reference: prompts](/reference/prompts)).

- **Inputs**: Advancing papers from Stage 2, `profile.content`, `scoringModel` (default `gemini-3.6-flash`), `scoringBatchSize` (default 3), and `scoringConcurrency` (default 3).
- **Output**: `scoredPapers` containing `relevanceScore`, `scoreJustification`, and `initialScore` (retained for comparison against Stage 3.5), while any papers that failed to score are isolated in `failedPapers`.
- **Cost and pause gates**: A fraction of a cent per paper (roughly 200 to 600 input tokens per abstract), with no pause gate between Stage 3 and Stage 3.5.

## Stage 3.5: post-process scores

- **Operation**: Runs an optional comparative consistency pass across the top `postProcessingCount` scored abstracts (default 50). Because Stage 3 evaluates abstracts in small independent batches whose score calibration can drift slightly across batches, Stage 3.5 shuffles the top candidates into comparative batches (`postProcessingBatchSize`, default 5) and adjusts scores up or down so that rankings are calibrated consistently across the pool. Each updated record stores `adjustedScore`, `adjustmentReason`, and a confidence rating (`HIGH`, `MEDIUM`, or `LOW`). Disable this pass by setting `enableScorePostProcessing: false` (or unchecking **Enable Post-Processing** in Settings).
- **Inputs**: Top `N` papers from Stage 3, `profile.content`, `postProcessingModel` (default `gemini-3.6-flash`), `postProcessingCount` (default 50), `postProcessingBatchSize` (default 5), and `postProcessingConcurrency` (default 3).
- **Output**: `scoredPapers` updated with `adjustedScore`, `adjustmentReason`, and a `scoreAdjustment` audit trail.
- **Cost and pause gates**: A fraction of a cent per paper across the top `N` candidates, followed immediately by Gate 2 (`pauseBeforeDeepAnalysis`).

## Stage 4: analyze PDFs

- **Operation**: Selects the top `maxDeepAnalysis` papers by score (default 30, modified by any manual stars or dismissals at Gate 2), downloads each full PDF from arXiv, and sends the document to a vision-capable model (`pdfModel`) to produce a structured technical report covering key findings, methodology, limitations, and a post-PDF `finalScore`. Both `preAnalysisScore` and `finalScore` are preserved on each paper object so you can see how reading the full text shifted the score.
- **Download throttling and concurrency**: Server-side PDF downloads are serialized 15 seconds apart to honor the crawl delay in arXiv's `robots.txt`. If arXiv serves a reCAPTCHA challenge instead of PDF bytes, Aparture falls back to a headless Playwright browser with cached session cookies, consuming two 15-second throttle slots (one for the abstract page and one for the PDF). Once PDFs are downloaded, LLM analysis calls execute in parallel across a worker pool (`pdfAnalysisConcurrency`, default 3, range 1–20).
- **Prompt caching and rate-limit barriers**: On Anthropic models, the worker pool enforces a single-flight cache-warmup barrier where the first worker completes its request alone to populate the prompt-cache entry before remaining workers start; Google and OpenAI workers start immediately. Across all LLM stages (Stages 2, 3, 3.5, 4, and 5), Aparture coordinates a per-provider rate-limit barrier: whenever any worker encounters an HTTP 429, 503, or Anthropic 529 response, all workers targeting that provider pause for the `Retry-After` window (capped at 60 seconds) before retrying. Non-retryable client errors (400, 401, 403, 404, 413, and 422 responses other than safety refusals or reCAPTCHA notices) fail immediately on the first attempt with the provider's error message.
- **Key figure extraction**: During the full-text read, the model identifies the single most informative figure by its printed label (such as `"Figure 3"`). While the PDF buffer is in memory, the server locates that caption in the PDF text layer, crops the figure region above it, and writes the image and caption metadata to `reports/figures/<arxivId>.png` and `.json` without an extra download or model call. If a caption cannot be matched in the PDF text layer, the paper simply omits the figure block.
- **Inputs**: Top candidate papers from Gate 2, `profile.content`, `pdfModel` (default `gemini-3.8-flash`), and `pdfAnalysisConcurrency` (default 3).
- **Output**: `finalRanking` containing papers augmented with `deepAnalysis` (including `keyFigure` and cropped `figure` metadata when extracted), `finalScore`, `preAnalysisScore`, and `pdfScoreAdjustment`.
- **Cost**: A few cents per paper, accounting for the largest share of token expenditure on a typical run (with automatic prompt caching reducing repeated prefix costs on Anthropic and OpenAI).
- **Pause gates**: `pauseBeforeDeepAnalysis` (Gate 2, enabled by default) pauses before Stage 4 begins so you can inspect the **Will PDF (top-N)**, **Borderline**, and **Low score** groups and star or dismiss candidates (see [Review gates → Gate 2](/using/review-gates#gate-2-before-pdf-analysis-score-review)). `pauseBeforeBriefing` (Gate 3, enabled by default) pauses immediately after Stage 4 finishes.

## Stage 5: briefing synthesis

Once Stage 4 completes (and you advance past Gate 3), the briefing client executes the following sequence to produce and archive the final briefing:

1. **Attach engagement metadata**: Maps each paper in `finalRanking` to a synthesis input record and attaches any production stars, dismissals, and paper comments from your feedback store (excluding test-run feedback).
2. **Generate quick summaries**: Fans out parallel calls to `/api/analyze-pdf-quick` on `quickSummaryModel` (default concurrency `quickSummaryConcurrency: 5`, range 1–20) to produce ~300-word inline reader summaries from each Stage 4 report. Quick summaries are generated solely for the interactive card UI and are never passed to synthesis or the hallucination audit.
3. **Synthesize the briefing**: Calls `/api/synthesize` on `briefingModel` (default `gemini-3.8-flash`) with your profile, scoped Writing editorial notes, Gate 3 run instructions, and the full reports and abstracts of the final-round papers. The returned briefing object undergoes deterministic validation in `lib/synthesis/validator.js`: card titles and scores are overwritten from ground-truth inputs, and missing papers, unverified `arxivId` citations, or unthemed cards trigger one LLM repair pass followed, if needed, by deterministic code salvage (see [Briefing anatomy](/concepts/briefing-anatomy#checks-before-display)).
4. **Audit factual claims**: Calls `/api/check-briefing` on `briefingModel` to verify every factual claim in the briefing against the untruncated abstracts and Stage 4 full reports. If the audit call fails due to a transient error, it retries once; if it fails a second time, the briefing is saved as unaudited with an explicit notice in the header.
5. **Execute optional hallucination retry**: If the audit returns a verdict covered by your retry settings (`briefingRetryOnYes` or `briefingRetryOnMaybe`), Aparture re-runs synthesis once with a prompt hint summarizing the flagged claims and re-audits the new draft.
6. **Generate editor clarification questions**: When `editorQuestions` is enabled, makes one compact call to `/api/editor-questions` on `briefingModel` to append up to two tap-to-answer profile clarification questions under **Notes from the editor**.
7. **Archive to disk and browser storage**: Writes the complete briefing record and `generationMetadata` to `reports/briefings/<id>.json` on disk permanently, and updates the browser `localStorage` sidebar index (which trims the oldest dry runs and Minimal API Tests first when browser storage approaches its size cap, while leaving all JSON files on disk intact).

- **Inputs**: `finalRanking`, `profile.content`, `briefingModel`, `quickSummaryModel`, `quickSummaryConcurrency`, `briefingRetryOnYes`, `briefingRetryOnMaybe`, accumulated feedback events, and Gate 3 notes.
- **Output**: Saved briefing JSON, `briefingCheckResult` (verdict, justification, and flagged claims), optional `editorQuestions`, and cached quick summaries and full reports, with each card linked to arXiv abstract, PDF, HTML, and alphaXiv pages.
- **Cost**: Typically a few cents per run across quick summaries, synthesis, audit (plus one retry if triggered), and editor questions.
- **Pause gate**: `pauseBeforeBriefing` (Gate 3, enabled by default) pauses at `pre-briefing-review` before Stage 5 starts so you can star, dismiss, or comment on papers and leave run-level synthesis instructions.

## The hallucination-retry loop

Every synthesis pass is audited by `/api/check-briefing`, and both the verdict and any flagged claims are persisted in `generationMetadata`:

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 700 390" style="width: 100%; height: auto; max-width: 700px; display: block; margin: 0 auto;" role="img" aria-label="Flowchart of the Stage 5 hallucination audit and single-retry synthesis loop">
    <defs>
      <marker id="hr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-text-3)" />
      </marker>
      <marker id="hr-arrow-brand" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-brand-1)" />
      </marker>
    </defs>
    <rect x="200" y="12" width="300" height="42" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="350" y="38" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)" text-anchor="middle">/api/synthesize (validated briefing)</text>
    <line x1="350" y1="54" x2="350" y2="76" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#hr-arrow)" />
    <rect x="200" y="78" width="300" height="42" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="350" y="104" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)" text-anchor="middle">/api/check-briefing (audit corpus)</text>
    <line x1="350" y1="120" x2="350" y2="142" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#hr-arrow)" />
    <rect x="230" y="144" width="240" height="36" rx="18" fill="var(--vp-c-bg-elv)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="350" y="167" font-family="var(--vp-font-family-mono)" font-size="12.5" font-weight="700" fill="var(--vp-c-text-1)" text-anchor="middle">Audit verdict: YES / MAYBE / NO</text>
    <path d="M 270 180 L 135 208" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#hr-arrow-brand)" />
    <line x1="350" y1="180" x2="350" y2="208" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#hr-arrow-brand)" />
    <path d="M 430 180 L 565 208" fill="none" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#hr-arrow)" />
    <rect x="35" y="210" width="200" height="46" rx="7" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="135" y="231" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-brand-1)" text-anchor="middle">YES (unsupported claims)</text>
    <text x="135" y="248" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)" text-anchor="middle">Check briefingRetryOnYes</text>
    <rect x="250" y="210" width="200" height="46" rx="7" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="350" y="231" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-brand-1)" text-anchor="middle">MAYBE (uncertain claims)</text>
    <text x="350" y="248" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)" text-anchor="middle">Check briefingRetryOnMaybe</text>
    <rect x="465" y="210" width="200" height="46" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="565" y="231" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-text-1)" text-anchor="middle">NO (all claims verified)</text>
    <text x="565" y="248" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)" text-anchor="middle">Keep first synthesis pass</text>
    <path d="M 135 256 L 220 282" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#hr-arrow-brand)" />
    <path d="M 350 256 L 265 282" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#hr-arrow-brand)" />
    <rect x="80" y="284" width="325" height="44" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="242" y="304" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-text-1)" text-anchor="middle">Retry /api/synthesize with flaggedClaims hint</text>
    <text x="242" y="320" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)" text-anchor="middle">Then re-run /api/check-briefing once</text>
    <path d="M 242 328 L 330 348" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#hr-arrow-brand)" />
    <path d="M 565 256 L 420 348" fill="none" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#hr-arrow)" />
    <rect x="190" y="350" width="320" height="32" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="350" y="371" font-family="var(--vp-font-family-mono)" font-size="12.5" font-weight="700" fill="var(--vp-c-text-1)" text-anchor="middle">Save and render final briefing</text>
  </svg>
</div>

Under **Settings → Review & confirmation**, `briefingRetryOnYes` (enabled by default) triggers a retry on confirmed unsupported claims, while `briefingRetryOnMaybe` (disabled by default) also triggers a retry on uncertain verdicts. When a retry executes, the synthesis prompt receives a retry hint listing the flagged claims, and the audit runs a second time on the revised draft. Any claims still flagged on the final pass remain expandable in the briefing view so you can inspect the auditor's reasoning directly.

::: tip Single-retry bound
The hallucination retry loop executes at most once per briefing to bound token expenditure and latency. If the second pass still flags a claim, Aparture saves and renders the second pass alongside the updated audit report.
:::

## The Download Report vs the briefing

A completed run produces two distinct artifacts that serve complementary roles:

- **The briefing**: The synthesized editorial reading view generated in Stage 5, rendered by `components/briefing/BriefingView.jsx`, and archived by `useBriefing` in `reports/briefings/`. It combines an executive summary, priority-ordered thematic arguments, profile-grounded paper cards, and a hallucination audit.
- **The Download Report**: A deterministic Markdown compilation generated by `lib/analyzer/exportReport.js` directly from Stage 4's per-paper deep-analysis objects. It stitches together the complete per-paper technical summaries, scores, and metadata without calling an LLM. Because the Download Report requires only Stage 4 outputs, its download card appears as soon as Stage 4 finishes (including during the Gate 3 pre-briefing pause).

In daily use, the briefing serves as your primary reading and triage surface, while the Download Report provides a self-contained archival Markdown file of every Stage 4 technical report. If you ever want only the raw per-paper technical reports without running Stage 5 synthesis, you can stop the pipeline at Gate 3 and click **Download Report** directly.

## Reading this alongside the UI

- **Progress Timeline**: Displays each stage along the left side of the Pipeline workspace with live status icons and batch progress counters.
- **Review-gate banners**: Appear in the main workspace whenever `pauseAfterFilter`, `pauseBeforeDeepAnalysis`, or `pauseBeforeBriefing` activates, holding the pipeline until you click Continue.
- **Download Report card**: Appears immediately after Stage 4 completes and remains available before and after Stage 5 synthesis.

## Where to tune what

- **Skipping optional stages**: Toggle Stage 3.5 via **Enable Post-Processing** in Settings, or toggle Stage 2 via the `useQuickFilter` configuration flag (see [Tuning the pipeline → Quick filter](/using/tuning-the-pipeline#quick-filter)).
- **Assigning models per stage**: Configure `filterModel`, `scoringModel`, `postProcessingModel`, `pdfModel`, `briefingModel`, and `quickSummaryModel` independently in Settings (see [Model selection](/concepts/model-selection)).
- **Customizing synthesis prose**: Edit `prompts/synthesis.md` on disk; changes take effect on the next run without a rebuild (see [Prompts](/reference/prompts)).
- **Steering synthesis with feedback**: Use stars, dismissals, and comments at Gate 3 to shape thematic framing (see [Giving feedback](/using/giving-feedback)).

## Next

Continue to [Briefing anatomy →](/concepts/briefing-anatomy) for a detailed tour of the Stage 5 synthesis contract, validation rules, and deterministic salvage paths.

Related guides:

- [**Tuning the pipeline**](/using/tuning-the-pipeline): Walkthrough of the Settings panel, setting by setting.
- [**Model selection**](/concepts/model-selection): Recommended models and cost trade-offs for each stage slot.
- [**Review gates**](/using/review-gates): What each interactive pause gate displays and when to disable it.
