# Tuning the pipeline

Once you've got a working profile and a handful of briefings under your belt, you'll probably want to tune the pipeline itself — which models run at which stages, how many papers survive each filter, and which optional stages run at all. All of this lives in the **Settings** panel (sidebar → Settings).

This page walks through the knobs, what each affects, and how to think about the cost-vs-quality trade-offs.

## The mental model

The pipeline is a 6-stage waterfall. Every stage narrows the set of papers before the next stage runs — cheap stages filter loosely, expensive stages only see the survivors. Cost per paper grows by roughly 10-100x as you go down the stack:

- **Stage 1 (fetch)** — free (arXiv API).
- **Stage 2 (quick filter)** — ~$0.0001-0.0003 per paper.
- **Stage 3 (abstract scoring)** — ~$0.0005-0.002 per paper.
- **Stage 3.5 (post-processing)** — ~$0.001-0.003 per paper, on the top N only.
- **Stage 4 (PDF analysis)** — ~$0.02-0.10 per paper. The real money stage.
- **Stage 5 (briefing synthesis)** — ~$0.05-0.30 per run (not per paper).

So the tuning game is: get the right papers to Stage 4 without spending too much on the stages before it, and without letting the wrong papers through. The settings below are the levers for that.

## Per-stage model slots

Each stage has its own model slot. The defaults (as of April 2026) are all Google models:

| Slot              | Setting label      | Default                           | What it does                                         |
| ----------------- | ------------------ | --------------------------------- | ---------------------------------------------------- |
| `filterModel`       | Filter Model            | `gemini-3.1-flash-lite`           | Stage 2: YES/NO/MAYBE on abstracts                                                |
| `scoringModel`      | Scoring Model           | `gemini-3-flash`                  | Stage 3: 0-10 score with justification                                            |
| `pdfModel`          | PDF Analysis Model      | `gemini-3.1-pro`                  | Stage 4: deep PDF read                                                            |
| `briefingModel`     | Briefing Model          | `gemini-3.1-pro`                  | Stage 5: cross-paper synthesis + hallucination check                              |
| `quickSummaryModel` | Quick-summary Model     | `gemini-3.1-flash-lite`           | Briefing prep: per-paper text compression, parallel fan-out just before synthesis |
| `notebookLMModel`   | NotebookLM Model        | (set when you generate a podcast) | Optional: NotebookLM bundle generation                                            |

The `quickSummaryModel` slot also has a companion `quickSummaryConcurrency` integer (default 5, clamped 1–20) that controls how many of those calls fire in parallel. Lower it if you're on a rate-limited tier; raise it on generous tiers to cut wall-clock time.

If you're running a **single-provider setup** (e.g. all-Anthropic or all-OpenAI), you can leave `quickSummaryModel` pointed at a small model from that same provider — the cheapest Haiku, Nano, or Flash-Lite tier works well. There's no benefit to splitting providers just for this stage; the compression task is short enough that even the smallest model in the family handles it cleanly.

Each dropdown lives in the **Model Slots** section of Settings. All slots are disabled while a pipeline run is in progress.

Three principles for model selection:

### 1. Spend on what reads the most

PDF analysis reads entire papers, often 10,000-25,000 tokens each. That's where a good model pays off: correct scoring, nuanced summaries, fewer hallucinations downstream. Upgrade `pdfModel` before upgrading anything else.

Briefing synthesis reads all the final-round papers plus your profile. It benefits from a capable model too, but it's one call per run — cheaper to upgrade than PDF analysis.

### 2. Don't spend on what filters

The quick filter runs on every fetched paper (often 100-500 per day). A fast, cheap model here is exactly right — it only needs to say "plausibly relevant" or "plausibly not." `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`, `claude-haiku-4.5`, or `gpt-5.4-nano` are all good choices.

Same logic applies to scoring: you're running it on dozens to hundreds of papers and mostly ranking within them. A mid-tier model is usually enough. `gemini-3-flash` or `claude-sonnet-4.6` works well.

### 3. Mixing providers is fine

Nothing in Aparture requires all stages to use the same provider. A common pattern: Gemini Flash-Lite for filtering (speed and price), Claude Sonnet for scoring (strong reasoning on abstracts), Claude Opus for PDF analysis (best-in-class long-context reading), and Gemini for briefing synthesis (good structured-output, fast).

See [Model selection](/concepts/model-selection) for the full model registry and three example configurations (Budget, Balanced, Premium) used as editorial shorthand across these docs.

## Batch sizes

Each stage batches papers into API calls to avoid per-paper overhead. Bigger batches are faster but risk hitting context limits or getting less careful per-paper attention.

| Setting                    | Default | Reasonable range | Notes                                                             |
| -------------------------- | ------- | ---------------- | ----------------------------------------------------------------- |
| Filter batch size          | 3       | 3-10             | Small because filter prompts are short; batching helps throughput |
| Scoring batch size         | 3       | 3-8              | Medium — each paper has a full abstract + justification           |
| Post-processing batch size | 5       | 3-10             | Comparative batches need multiple papers                          |
| PDF analysis batch size    | 1       | (always 1)       | One PDF per call — but see **Parallel PDF analyses** below        |

### Parallel PDF analyses

**Parallel PDF analyses** (default: 3, range 1-20) controls how many Stage 4 PDFs are analysed at once. The arXiv download step is serialised server-side to respect arXiv's rate limits, but the LLM calls themselves run in parallel once the PDFs are in hand.

- On **Anthropic** providers, the first worker finishes its call alone before the others begin, so the prompt-cache entry is primed once instead of racing. This costs ~3-6 seconds on the first paper in exchange for cheaper cache reads on every subsequent paper.
- On **Google** and **OpenAI**, all workers start immediately.

Start at 3. Raise to 5-8 on higher provider tiers (Anthropic Tier 3+, Google Tier 2+, OpenAI Tier 3+). Drop to 1 if you start seeing 429s on rate-limit-sensitive tiers.

Most users never touch these. Raise batch sizes when:

- You have a fast provider with high rate limits.
- Your papers have short abstracts.
- You're using a long-context model.

Lower them when:

- You hit rate-limit errors.
- Papers are getting sloppy scores (less attention per paper at larger batch sizes).

## Score thresholds

Three thresholds control which papers advance between stages.

### Filter verdicts to advance

In Settings, under **Quick Filter**, you can choose which verdicts move on to scoring (default: YES + MAYBE). If you set this to YES-only, you save tokens on borderline papers but also risk missing genuinely interesting MAYBE papers.

### Score threshold for PDF analysis

The **Relevance threshold** setting (default: usually 5.0 or higher) determines the minimum score required to advance from Stage 3 (abstract scoring) to Stage 4 (PDF analysis). Papers below this score are never PDF-analysed, so they appear in the briefing as "abstract-only" entries.

Setting this higher (7, 8) means fewer PDFs get read — lower cost, but you might miss papers with boring abstracts and interesting content. Setting it lower (3, 4) means more PDFs get read — higher cost, broader coverage.

### Max deep analysis

**Max Deep Analysis** (default: 30 or similar) caps how many papers get PDF-analysed regardless of score. This is a hard budget. On high-volume days, the top-ranked papers get PDFs; the rest are abstract-only.

Tighten this when costs matter more than comprehensiveness. Raise it when you want to look at more papers in depth (and have the budget for it).

## Post-processing toggle

**Post-processing enabled** (default: **on**) runs an extra consistency pass on the top-N scored papers (default: top 50). It compares papers to each other in small batches and adjusts scores up or down based on relative ranking.

Why it matters: Stage 3 scores each paper _independently_, which sometimes produces inconsistencies ("this paper scored 8.2 and that one scored 7.1, but they're basically the same paper"). Post-processing irons those out.

Turn it off if:

- You're optimising for run-time and can tolerate some rank noise.
- You're testing profile changes (faster iteration).
- Your provider's model is already good at global ranking (rare).

Keep it on for production runs where ranking quality matters.

## Quick filter toggle

**Quick filter mode** (default: **on**) controls whether Stage 2 runs at all. If you turn it off, every fetched paper goes directly to abstract scoring, skipping the cheap pre-filter entirely.

Turn off quick filter when:

- You only fetch a small number of papers per day (under ~30) and the filter is overhead.
- Your scoring model is cheap enough that filtering isn't worth the extra stage.

Leave it on for most users — especially if you're fetching from high-volume categories like `cs.LG` or `cs.CL`. The filter can cut your scoring costs by 30-60%.

## Briefing retry checkboxes

Two checkboxes in **Review & confirmation** control what happens when the hallucination check flags claims in the briefing:

- **Retry briefing on YES verdicts** (default: **on**) — if the audit says "hallucinations detected," rerun synthesis with a retry hint.
- **Retry briefing on MAYBE verdicts** (default: **on**) — same, but for uncertain audits.

Turning these off saves tokens (the retry is a full second synthesis pass, plus a second audit). Turning them on improves briefing quality at the cost of occasional extra synthesis runs.

The retry is capped at one pass — if the retry still produces a flagged briefing, you get the retried version with its audit results.

## Recommended defaults

Out of the box, Aparture ships with a **Balanced** configuration:

- Google Gemini models at every slot.
- Quick filter on, post-processing on.
- Pause gates on, retry-on-YES on, retry-on-MAYBE on.
- Max deep analysis: 30.

This is a good baseline for most users. It prioritises signal quality over cost without being extravagant.

From there, a few common adjustments.

### If you're cost-sensitive

Switch filter and scoring models to the cheapest Flash-Lite or Nano tier. Drop Max Deep Analysis to 10-15. Turn off post-processing. Turn off retry-on-MAYBE. Keep retry-on-YES (rare but worth keeping).

Estimated daily cost: ~$0.50-1.00 for a 100-paper run.

### If you want highest quality

Switch PDF and briefing models to Claude Opus 4.7. Keep scoring on Claude Sonnet or Gemini 3 Flash. Keep post-processing on. Raise Max Deep Analysis to 50+. Keep both retry checkboxes on.

Estimated daily cost: ~$3-6 for a 100-paper run.

### If you're running unattended

Turn off both pause gates. Consider turning off the hallucination-retry checkboxes (an unattended run can't course-correct anyway). Adjust Max Deep Analysis down to something predictable.

## Where to see what a past briefing actually used

Every briefing archives the full configuration in its **Generation details** panel (the collapsible disclosure below the briefing). When you're looking at an old briefing and wondering "was this the one where I used Claude Opus for PDFs?", open Generation details and check the model IDs.

This is also useful when troubleshooting: if a run produced a weird briefing, the Generation details show you exactly which models and settings were in effect. Compare against a good run to isolate the variable.

## Next

- You want to understand each stage in depth, not just tune it. → [Pipeline](/concepts/pipeline)
- You want to compare providers and pick a cost/quality combination. → [Model selection](/concepts/model-selection)
- You want to tune the synthesis prompt itself, not just which model runs it. → [Reference: prompts](/reference/prompts)
