# Tuning the pipeline

Once you've produced a few briefings and know what the defaults feel like, you'll usually want to tune the pipeline — which models run where, how many papers get deep-analysed, how many calls fire in parallel, which optional stages run at all. All of those knobs live in the **Settings** panel (sidebar → Settings), and this page walks through them.

Each stage costs roughly 10× more per paper than the one before it, so most of the tuning game is making sure the expensive stages only see the papers worth spending on. The Settings panel is organised around that idea too: the model slots come first, the cheap stages sit in small text boxes under Advanced Options, and the review gates live at the bottom.

## The mental model

The pipeline is a waterfall. Each stage narrows the set of papers before the next stage runs, so cheap models can afford to be loose on hundreds of abstracts while expensive models only ever see the handful that make it through. Rough per-paper costs:

| Stage              | What runs                       | Rough per-paper cost |
| ------------------ | ------------------------------- | -------------------- |
| Stage 1 · fetch    | arXiv API                       | free                 |
| Stage 2 · filter   | YES / MAYBE / NO triage         | fractions of a cent  |
| Stage 3 · scoring  | 0.0–10.0 with justification     | a fraction of a cent |
| Stage 3.5 · post   | consistency pass on top N       | a fraction of a cent |
| Stage 4 · PDFs     | deep read of top-ranked papers  | a few cents each     |
| Stage 5 · briefing | synthesis + hallucination audit | a few cents per run  |

Tuning comes down to: get the right papers into Stage 4, don't overspend on the stages before it, and don't let the wrong papers through. The rest of this page goes through the knobs.

## Per-stage model slots

Each stage has its own model slot. Current defaults are all Google:

| Slot                | Setting label                 | Default                   | What it drives                                                              |
| ------------------- | ----------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `filterModel`       | Quick Filter Model (Stage 1)  | `gemini-3.1-flash-lite`   | Stage 2 YES/MAYBE/NO verdicts                                               |
| `scoringModel`      | Abstract Scoring Model        | `gemini-3-flash`          | Stage 3 scoring (and the optional Stage 3.5 consistency pass)               |
| `pdfModel`          | Deep PDF Analysis Model       | `gemini-3.1-pro`          | Stage 4 full-text read                                                      |
| `briefingModel`     | Briefing Model                | `gemini-3.1-pro`          | Stage 5 synthesis, the hallucination audit, and the profile-refinement flow |
| `quickSummaryModel` | Quick-summary model           | `gemini-3.1-flash-lite`   | ~300-word pre-read per paper, generated in parallel just before synthesis   |
| `notebookLMModel`   | (set when generating podcast) | unset until first podcast | Optional NotebookLM document bundle                                         |

The Settings panel's own stage numbering is a little different from the numbering these docs use (the UI calls the filter "Stage 1"); the labels above are what you'll literally see on screen. All slots are disabled while a run is in progress.

Three rules of thumb for model selection:

### Spend on what reads the most

PDF analysis reads whole papers — typically tens of thousands of tokens each. That's where a stronger model earns its keep: better grounding, more faithful summaries, fewer claims that have to be flagged downstream. Upgrading `pdfModel` tends to move the briefing quality more than upgrading anything else.

Synthesis reads all the final-round papers plus your profile. It benefits from a capable model too, but it's a single call per run, so the bill for upgrading `briefingModel` is much smaller than upgrading `pdfModel`.

### Don't spend on what filters

The quick filter runs on every fetched paper, often a hundred or more per day. A cheap, fast model is exactly right for this — it only has to decide "plausibly relevant" or "plausibly not." `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`, `claude-haiku-4.5`, or `gpt-5.4-nano` all work well.

Scoring is similar: dozens to hundreds of abstracts, and most of what the model is doing is ranking within them. A mid-tier model is usually enough. `gemini-3-flash` or `claude-sonnet-4.6` are good picks.

### Mixing providers is fine

Nothing in Aparture requires one provider per run. A common pattern is Gemini Flash-Lite for filtering (speed and price), Claude Sonnet for scoring, Claude Opus for PDFs, and Gemini for synthesis. As long as every slot has a valid key for the provider it points at, the pipeline doesn't care.

See [Model selection](/concepts/model-selection) for the full registry, the per-stage recommendations, and example lineups (including a free-tier-only setup and a three-provider mix).

## Parallelism

Two concurrency knobs control how much Stage 4 and the briefing prep do at once.

### Parallel PDF analyses

**Papers to Analyze** caps how many PDFs get read per run (default 30, range 1–100). **Parallel PDF Analyses** controls how many of those PDF analyses fire concurrently (default 3, range 1–20). The arXiv download step is serialised server-side with a ~5-second spacing to respect arXiv's rate limits, but once the PDFs are in hand the LLM calls themselves run in parallel.

- On **Anthropic** providers, the first worker finishes its call alone before the others begin, so the prompt-cache entry is primed once instead of racing. This costs a few extra seconds on the first paper in exchange for cache reads on every subsequent paper.
- On **Google** and **OpenAI**, all workers start immediately.

Three is a conservative default that works across provider tiers. Raising it to 5–8 is usually fine on higher provider tiers (Anthropic Tier 3+, Google Tier 2+, OpenAI Tier 3+); drop to 1 if you start seeing 429s on a rate-limit-sensitive tier.

### Parallel quick-summaries

**Parallel calls** under the Quick-summary model sets how many `/api/analyze-pdf-quick` calls fan out at once during briefing prep (default 5, range 1–20). These produce the ~300-word pre-read summaries that expand inline on paper cards. The task is short enough that this knob is mostly a rate-limit hedge — lower it if you hit 429s on a large run, raise it on a generous tier if you want to shave seconds off wall-clock.

## Batch sizes

Each stage batches papers into API calls to avoid per-paper overhead. Bigger batches are faster but risk hitting context limits or giving each paper less careful attention.

| Setting            | Default | Reasonable range | Notes                                                  |
| ------------------ | ------- | ---------------- | ------------------------------------------------------ |
| Filter Batch Size  | 3       | 3–10             | Short prompts; batching mostly helps throughput        |
| Scoring Batch Size | 3       | 3–8              | Each paper carries a full abstract + justification     |
| Review Batch Size  | 5       | 3–10             | Post-processing compares multiple papers at once       |
| PDF analysis batch | 1       | (always 1)       | One PDF per call — see **Parallel PDF Analyses** above |

Most users never touch these. Raising batch sizes tends to help when you're on a fast provider with generous rate limits, your abstracts are short, or you're using a long-context model. Lowering them tends to help when you're hitting rate-limit errors or noticing sloppier scoring at larger batch sizes.

## Which papers advance where

Two settings govern which papers move through the waterfall.

### Filter verdicts to advance

Under **Categories to Process** (Advanced Options → Filter Options), three checkboxes control which filter verdicts move on to scoring. Default is YES + MAYBE. Dropping MAYBE saves tokens on borderline papers but also skips anything the filter wasn't sure about, which tends to include the most interesting edge cases. Dropping YES is rarely what you want.

### Papers to Analyze

**Papers to Analyze** (default 30, range 1–100) is a hard cap on how many papers get PDF-analysed. Stage 3 ranks every scored paper; Stage 4 takes the top N by score. If the filter lets through 200 papers and this is set to 30, the bottom 170 will appear in the scored list but won't be deep-analysed.

Tighten it when cost matters more than comprehensiveness. Raise it when you want more papers read in depth and have the budget for it. The per-paper cost at Stage 4 is roughly 10× everything upstream, so this is the most cost-sensitive single knob in the panel.

::: info No separate score threshold
Aparture doesn't currently expose a "minimum score to advance" setting — the cutoff is just "top N by score," controlled by **Papers to Analyze**. A paper with a 3.5 will get PDF-analysed if it's in the top 30 on a thin day, and a 6.5 will be skipped if it's position 31 on a busy one.
:::

## Optional stages

### Post-processing

**Enable Post-Processing** (default on) runs an extra consistency pass on the top N scored papers (default 50) after Stage 3. Papers are compared head-to-head in small batches and their scores adjusted up or down to bring outliers into line with the broader ranking.

The reason it exists: Stage 3 scores each paper independently, which sometimes produces inconsistencies — two papers of similar quality can land a point apart just because they were in different batches. The post-processing pass irons that out.

Turn it off if run-time matters more than ranking quality, or if you're rapidly iterating on profile changes and want faster feedback. Leave it on for most production runs.

### Quick filter

Whether Stage 2 runs at all is governed by the `useQuickFilter` config flag (default on). It's not currently exposed in the Settings UI — the flag lives in the app's saved state and would need to be edited there to turn off — but it exists. Skipping the filter is reasonable when your categories are narrow enough that the day's volume is already manageable (under ~30 papers) and the filter is just overhead. For most users, especially on high-volume categories like `cs.LG` or `cs.CL`, the filter cuts scoring costs by a meaningful margin and is worth leaving on.

## Review & confirmation

Four checkboxes under **Review & confirmation** govern when the pipeline pauses and when it retries.

| Checkbox                                                                                       | Default | What it does                                                               |
| ---------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| Pause after filter to review overrides                                                         | on      | Stops at Gate 1 so you can move papers between YES / MAYBE / NO buckets    |
| Pause before briefing to review scores and add feedback                                        | on      | Stops at Gate 2 so you can star, dismiss, or comment before synthesis runs |
| Auto-retry briefing if hallucination check returns <span class="verdict is-no">YES</span>      | on      | Reruns synthesis once with a retry hint when the audit flags claims        |
| Auto-retry briefing if hallucination check returns <span class="verdict is-maybe">MAYBE</span> | off     | Same, but for the more ambiguous verdict                                   |

The two pause gates are the training wheels. Leaving them on is the right starting point; turning them off is something you'll usually do deliberately once you've seen enough runs to know the filter and the scores are landing well for your profile. [Review gates](/using/review-gates) goes deeper on what each gate shows and when to skip which.

The retry checkboxes trade tokens for quality. A retry is a full second synthesis pass plus a second audit — cheap compared to Stage 4, but not free. Retry-on-<span class="verdict is-no">YES</span> is usually worth keeping on (a confident "hallucinations detected" verdict is rare but worth fixing). Retry-on-<span class="verdict is-maybe">MAYBE</span> is more defensible to turn off — the <span class="verdict is-maybe">MAYBE</span> verdict often catches paraphrases the auditor is unusually strict about rather than genuine hallucinations. The retry path fires at most once per briefing either way.

## A few common configurations

The defaults ship tuned sensibly — all-Google models, both pause gates on, retry-on-<span class="verdict is-no">YES</span> on, retry-on-<span class="verdict is-maybe">MAYBE</span> off, Papers to Analyze at 30. From there:

**Cost-sensitive.** Switch filter and scoring to the cheapest Flash-Lite or Nano tier. Drop Papers to Analyze to 10–15. Turn off post-processing. Turn off retry-on-<span class="verdict is-maybe">MAYBE</span> if it isn't already.

**Highest quality.** Switch `pdfModel` and `briefingModel` to Claude Opus 4.7. Keep `scoringModel` on Claude Sonnet or Gemini 3 Flash. Keep post-processing on. Raise Papers to Analyze to 50+. Turn both retry checkboxes on.

**Unattended.** Turn off both pause gates (nobody's there to click through them). Consider turning off both retry checkboxes — an unattended run can't weigh the trade-off when the audit flags something, and a retry ties up an extra few minutes. Tighten Papers to Analyze to something predictable so cost doesn't swing with daily paper volume.

## Where to see what a past briefing used

Every briefing archives its full configuration in the **Generation details** panel — the small expandable section below the briefing itself. When you're looking at an old briefing and wondering which model was on the PDF slot that day, or whether the hallucination retry fired, open Generation details and check the fields there. This is also useful when a run produces a weird briefing and you want to compare against a known-good run to isolate what changed. See [Reading a briefing → Generation provenance](/using/reading-a-briefing#generation-provenance) for what the panel shows.

## Next

[Review gates →](/using/review-gates) — what each pause gate shows and when to turn it off.

Also worth reading:

- You want the system view of each stage, not just the knobs. → [The pipeline](/concepts/pipeline)
- You want to compare providers and pick a cost/quality combination. → [Model selection](/concepts/model-selection)
- You want to tune the synthesis prompt itself, not just which model runs it. → [Prompts](/reference/prompts)
