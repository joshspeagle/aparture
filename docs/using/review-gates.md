# Review gates

If you're coming from your [first briefing](/using/first-briefing), here's what those two pauses during the run were actually for.

Aparture's pipeline has two review gates — optional pauses where the run halts and shows you intermediate results before committing to the next (more expensive) stage. Both are on by default, both are skippable, and both exist to save you tokens and catch bad runs before they snowball.

This page covers what each gate shows you, what to do there, and when to turn them off (or back on).

## Gate 1 — after the quick filter

### What it does

The quick filter (Stage 2) is cheap: a small model runs YES/NO/MAYBE triage on every paper fetched from arXiv. It takes seconds and costs fractions of a cent per paper. Its job is to reduce volume before you spend real tokens on scoring and deep analysis.

When `pauseAfterFilter` is on (default: **on**), the pipeline halts immediately after the filter stage completes. The progress timeline shows "Filter complete — review results before scoring:" and the main area fills in with the filter results list, with papers grouped into three buckets: YES, MAYBE, NO.

### What you see

Each paper in the list shows:

- **Title and authors** — standard paper metadata.
- **Filter summary** (optional italic line) — a one-sentence compression of the paper's point.
- **Filter justification** — the model's reasoning, prefixed "Verdict reasoning:" and rendered in muted prose.
- **Three verdict pills** — YES (green), MAYBE (amber), NO (red). The current verdict is highlighted; the other two are transparent-bordered.

Above the list is the `Continue to scoring →` button. Clicking it advances the pipeline, using whatever verdicts are in effect at that moment (including any overrides).

### What to do there

If the filter got something right, do nothing. Most verdicts will be correct — the filter is decent at its job.

If the filter got something wrong, click a pill to override. Moving a paper from NO to YES or MAYBE brings it into scoring, which you likely want if you think it's actually relevant. Moving a paper from YES to NO excludes it from scoring, saving you tokens on something you already know isn't a fit.

Every override is recorded as a `filter-override` feedback event. These events feed into Suggest-Improvements as scope-calibration signals: "the profile may be too narrow" (NO → YES overrides) or "too broad" (YES → NO overrides). So overriding isn't just a one-off fix — it shapes future profile refinements too.

See [Giving feedback → filter overrides](/using/giving-feedback#filter-overrides-the-verdict-pills-at-gate-1) for details on the click-cycle and override semantics.

### When to override, practically

A few patterns come up repeatedly:

- **The filter dismisses a paper that's adjacent to your interests but not a direct match.** Override to MAYBE, see if deep analysis supports it. This is the most common case.
- **The filter accepts a paper whose abstract is mostly marketing.** Override to NO to skip spending tokens on a likely dud.
- **The filter is confused by a paper that straddles multiple fields.** Override to match your actual interest, and consider whether your profile needs a tweak.

Don't feel obligated to review every paper. The YES and MAYBE buckets are usually where the overrides happen; the NO bucket can often be left alone unless something specific catches your eye.

## Gate 2 — before briefing synthesis

### What it does

After Stage 4 (PDF analysis) completes, the pipeline has scores, deep-analysis summaries, and a ranked list of papers. The next step is synthesis: the briefing model reads your profile, all the papers, and your feedback, then produces the executive summary + themes + paper cards.

When `pauseBeforeBriefing` is on (default: **on**), the pipeline halts before synthesis runs. The progress timeline shows "Analysis complete — review results and add stars/dismissals before generating your briefing." The main area shows the Analysis Results list — all PDF-analysed papers with their scores and summaries.

### What to do there

Star papers you care about, dismiss ones you don't. Both signals flow into the synthesis prompt. Starred papers anchor themes and get the richest "why it matters" treatment; dismissed papers get deprioritised or explained away; everything else gets treatment based on its relevance score.

You can also leave comments with `+ comment` — these get incorporated into the paper's "why it matters" paragraph in the briefing.

The difference between starring/dismissing at Gate 2 versus starring/dismissing after the briefing renders is timing: at Gate 2, the signals influence the synthesis itself. After the briefing renders, signals are recorded but only affect _future_ briefings.

### When you're done, click `Continue to briefing →`

Synthesis runs (15-60s), the hallucination audit runs (another 10-30s), and the briefing renders. You're free to keep interacting with the results list as it runs; synthesis doesn't block your reading.

## Progression: from on by default to off

Both gates are on by default because they catch bad runs early — especially useful in your first week or two when you're still learning what your profile should say.

After 5-10 successful briefings, you might find the gates more friction than signal. At that point, consider turning one or both off:

- **Turn off `pauseAfterFilter` first.** The filter is usually right enough that override-saving is marginal after a while, and scoring is cheap anyway.
- **Keep `pauseBeforeBriefing` on longer.** This is where your stars and dismisses steer the synthesis. If you're not adding feedback, the briefing gets generic.
- **Once you're confident, turn off both.** Runs become fully unattended: click Start, come back in 5-10 minutes, read the briefing.

There's no harm in leaving both on permanently if you like the workflow. The gates are UI-only — they don't cost tokens.

## When to re-enable a gate you'd disabled

Three signals that a gate is worth turning back on:

- **You made a big profile change.** A new profile may be poorly calibrated; the filter might be over- or under-selecting. Turn on `pauseAfterFilter` for a few runs until things settle.
- **You added new arXiv categories.** Similar reason: you haven't built a mental model of what comes through the filter in those categories yet.
- **You switched to a much cheaper (or much more expensive) model.** Model behavior changes. The first few runs with a new model are worth watching.

The general rule: re-enable gates when you're in learning mode, disable them when you're in harvesting mode.

## Where to toggle them

Both gates live in **Settings** (under the sidebar nav). Scroll to **Review & confirmation** — you'll find two checkboxes:

- ☐ **Pause after filter** — controls Gate 1 (`pauseAfterFilter`).
- ☐ **Pause before briefing** — controls Gate 2 (`pauseBeforeBriefing`).

Toggles are disabled while a pipeline run is in progress (you can't change gate behavior mid-run). Changes take effect on the next run.

::: info
There's no per-run toggle — it's a global setting. For a one-off unattended run, toggle both off, run, then toggle back on.
:::

## Next

[Tuning the pipeline →](/using/tuning-the-pipeline) — past the pause gates, the rest of the knobs sit in Settings: model slots, batch sizes, score thresholds, parallelism, and retry behaviour.

Also worth reading:

- You want the detail on feedback flowing from overrides and stars. → [Giving feedback](/using/giving-feedback)
- You want to understand what's happening at each stage, not just at the gates. → [Pipeline](/concepts/pipeline)
