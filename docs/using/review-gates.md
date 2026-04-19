# Review gates

If you've gone through a run or two, you've already seen both gates in action — the pipeline halts after the filter completes and again before briefing synthesis, each time showing you intermediate results. Both are on by default, both are skippable per click, and both can be turned off entirely once you stop catching things at them.

This page covers what each gate shows, what to do there, and when it's worth turning one or the other off.

## Where they sit in the pipeline

```
  1. Fetch papers
      │
  2. Filter papers      (YES / MAYBE / NO triage)
      │
      ⏸   Gate 1 — review the buckets, fix obvious errors
      │
  3. Score abstracts    (0–10 + justification)
  3.5. Post-process     (optional consistency pass)
  4. Analyze PDFs       (full-text read of the top N)
      │
      ⏸   Gate 2 — star / dismiss / comment before synthesis
      │
  5. Briefing           (editorial synthesis + hallucination audit)
```

Both gates pause a running pipeline until you click a <span class="ui-action">Continue →</span> button. They don't cost tokens — skipping them doesn't save money, only time — but they do catch bad runs early.

## Gate 1 — after the quick filter

### What it does

The quick filter (Stage 2) is cheap: the `filterModel` slot (default `gemini-3.1-flash-lite`) runs YES / MAYBE / NO triage on every paper fetched from arXiv, along with a one-sentence summary and a short justification per paper. Its job is to cut the volume before you spend real tokens on scoring and deep analysis.

When `pauseAfterFilter` is on (default: **on**), the pipeline halts immediately after the filter stage. The progress timeline shows *"Filter complete — review results before scoring"* and the main area fills in with the filter results, grouped into three buckets.

### What you see

Each paper in the list shows its title and authors, the filter's one-sentence summary (italic), and a *"Verdict reasoning:"* line with the model's justification. On the right are three verdict buttons — <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, <span class="verdict is-no">NO</span>. The current verdict is filled; the other two are outlined. Clicking a different one moves the paper to that bucket and marks the choice with a small `⇄` to indicate it was overridden.

Above the buckets sits <span class="ui-action">Continue to scoring →</span>, which advances the pipeline with whatever verdicts are in effect at that moment, overrides included.

### What to do there

If the filter got something right, do nothing. Most verdicts will be fine — the filter model is decent at its job.

When the filter gets something wrong, click a verdict to override. Moving a paper from <span class="verdict is-no">NO</span> to <span class="verdict is-yes">YES</span> or <span class="verdict is-maybe">MAYBE</span> brings it into scoring — do this when you think the filter missed something relevant. Moving a paper from <span class="verdict is-yes">YES</span> to <span class="verdict is-no">NO</span> excludes it from scoring, which saves you tokens on something you already know isn't a fit.

Every override is logged as a `filter-override` feedback event. These events act as scope signals downstream: a pattern of <span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span> overrides suggests your profile is too narrow in that area; the reverse suggests it's too broad. The refinement flow sees them. See [Giving feedback → The filter-review gate](/using/giving-feedback#the-filter-review-gate-carries-override-buttons) for the full mechanics.

### In practice

A few patterns come up repeatedly:

- **The filter dismisses a paper adjacent to your interests but not a direct match.** Override to <span class="verdict is-maybe">MAYBE</span> and see what deep analysis makes of it. This is the most common case.
- **The filter accepts a paper whose abstract is mostly marketing.** Override to <span class="verdict is-no">NO</span> to skip spending tokens on a likely dud.
- **The filter is confused by a paper straddling multiple fields.** Override to match your actual interest and note whether it's a symptom your profile could address.

You don't have to review every paper. Overrides usually happen in the <span class="verdict is-yes">YES</span> and <span class="verdict is-maybe">MAYBE</span> buckets; the <span class="verdict is-no">NO</span> bucket can often be left alone unless something specific catches your eye.

## Gate 2 — before briefing synthesis

### What it does

After Stage 4 (PDF analysis) completes, the pipeline has scores, deep-analysis summaries, and a ranked list of papers. The next step is synthesis: the briefing model reads your profile, the analysed papers, and your feedback, then writes the executive summary, themes, and paper cards.

When `pauseBeforeBriefing` is on (default: **on**), the pipeline halts before synthesis runs. The timeline shows *"Analysis complete — review results and add stars/dismissals before generating your briefing"*, and the main area shows the Analysis Results list with every PDF-analysed paper, score, and summary.

### What to do there

Star the papers you care about and dismiss the ones you don't. Both signals feed directly into the synthesis prompt: starred papers anchor themes and get the richest *"why it matters"* treatment; dismissed papers get deprioritised or explained away; everything else is handled according to its relevance score. Leave a <span class="ui-action">+ comment</span> on a paper to have your note woven into its paragraph in the briefing.

The crucial difference between Gate 2 and the same controls on the rendered briefing is timing. Feedback given here shapes the briefing that's about to be written. Feedback given while reading the briefing is recorded against the paper but only affects future briefings — via the [refinement flow](/using/refining-over-time), where paper-grounded signals are among the strongest the profile revision sees.

Click <span class="ui-action">Continue to briefing →</span> when you're done. Synthesis runs, then the hallucination audit runs, then the briefing renders on its own page. The results list stays interactive while synthesis is in flight.

## Progression: from on by default to off

Both gates start on because they catch bad runs early — especially useful in the first week or two, when you're still developing a sense of what your profile should say and what the pipeline does with it.

After five or ten successful briefings, the gates can start feeling like more friction than signal. At that point it's worth considering which ones still earn their keep:

- **Turn off `pauseAfterFilter` first.** The filter is usually right enough that override-saving is marginal after a while, and scoring is cheap to over-run.
- **Keep `pauseBeforeBriefing` on longer.** This is where your stars, dismisses, and comments actively steer the synthesis. If you're not giving feedback at this gate, the briefing tends to drift toward generic.
- **Both off once you trust the setup.** Runs become fully unattended: click <span class="ui-action">Start Analysis</span>, come back later, read the briefing.

There's no harm in leaving both on permanently if the workflow suits you. The gates are UI-only — they don't cost tokens, and skipping them doesn't save money.

## When to re-enable a gate you'd disabled

Three situations in which flipping a gate back on tends to pay off:

- **You made a big profile change.** A freshly rewritten profile may be poorly calibrated, so the filter may be over- or under-selecting. Turning `pauseAfterFilter` back on for a few runs catches this early.
- **You added new arXiv categories.** You haven't built a mental model of what comes through the filter in those categories yet.
- **You switched to a much cheaper (or much more capable) model.** Model behaviour changes, and the first few runs with a new model are worth watching.

The general rule: re-enable gates when you're in learning mode, disable them when you're in harvesting mode.

## Where to toggle them

Both gates live in <span class="ui-action">Settings</span> under **Review & confirmation**, as two checkboxes:

- **Pause after filter to review overrides** — controls Gate 1 (`pauseAfterFilter`).
- **Pause before briefing to review scores and add feedback** — controls Gate 2 (`pauseBeforeBriefing`).

Two sibling checkboxes nearby — **Auto-retry briefing if hallucination check returns YES** (on by default) and **…MAYBE** (off by default) — govern the briefing retry loop, not the pause gates.

Toggles are disabled while a pipeline run is in progress (you can't change gate behaviour mid-run), and changes take effect on the next run.

::: info No per-run toggle
The setting is global, not per-run. For a one-off unattended run, toggle both off, start the run, toggle back on afterwards.
:::

## Next

[Tuning the pipeline →](/using/tuning-the-pipeline) — past the gates, the rest of the knobs sit in Settings: model slots, batch sizes, concurrency, score thresholds, and retry behaviour.

Also worth reading:

- The feedback detail behind overrides, stars, and dismisses. → [Giving feedback](/using/giving-feedback)
- What happens at each stage, not just at the gates. → [Pipeline](/concepts/pipeline)
