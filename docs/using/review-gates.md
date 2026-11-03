# Review gates

During a default pipeline run, Aparture pauses at three interactive review gates: after the quick filter completes (Gate 1), after abstract scoring and post-processing before any PDFs are downloaded (Gate 2), and after full-text PDF analysis before briefing synthesis begins (Gate 3). Each gate displays the current stage's output and lets you adjust which papers advance or attach feedback before the next stage executes. All three gates are enabled by default, can be bypassed for the remainder of an active run with a single click, and can be disabled persistently in Settings once your profile is calibrated.

## Where they sit in the pipeline

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 680 390" style="width: 100%; height: auto; max-width: 680px; display: block; margin: 0 auto;" role="img" aria-label="Pipeline sequence showing where Gate 1, Gate 2, and Gate 3 sit between the five automated stages">
    <defs>
      <marker id="rg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-text-3)" />
      </marker>
    </defs>
    <rect x="40" y="12" width="600" height="38" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="36" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">1. Fetch papers</text>
    <text x="260" y="36" font-family="var(--vp-font-family-base)" font-size="12.5" fill="var(--vp-c-text-2)">Harvest new arXiv submissions across selected categories</text>
    <line x1="340" y1="50" x2="340" y2="64" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rg-arrow)" />
    <rect x="40" y="66" width="600" height="38" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="90" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">2. Filter papers</text>
    <text x="260" y="90" font-family="var(--vp-font-family-base)" font-size="12.5" fill="var(--vp-c-text-2)">YES / MAYBE / NO abstract triage</text>
    <line x1="340" y1="104" x2="340" y2="118" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rg-arrow)" />
    <rect x="65" y="120" width="550" height="34" rx="17" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="88" y="142" font-family="var(--vp-font-family-mono)" font-size="12.5" font-weight="700" fill="var(--vp-c-brand-1)">Gate 1 (pauseAfterFilter)</text>
    <text x="295" y="142" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-1)">Review buckets and override obvious filter misses</text>
    <line x1="340" y1="154" x2="340" y2="168" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rg-arrow)" />
    <rect x="40" y="170" width="600" height="44" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="190" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">3. Score abstracts + 3.5. Post-process</text>
    <text x="58" y="206" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">0.0 to 10.0 relevance scores with justifications and optional consistency pass</text>
    <line x1="340" y1="214" x2="340" y2="228" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rg-arrow)" />
    <rect x="65" y="230" width="550" height="34" rx="17" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="85" y="252" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="700" fill="var(--vp-c-brand-1)">Gate 2 (pauseBeforeDeepAnalysis)</text>
    <text x="305" y="252" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Review scores and star or dismiss PDF candidates</text>
    <line x1="340" y1="264" x2="340" y2="278" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rg-arrow)" />
    <rect x="40" y="280" width="600" height="38" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="304" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">4. Analyze PDFs</text>
    <text x="260" y="304" font-family="var(--vp-font-family-base)" font-size="12.5" fill="var(--vp-c-text-2)">Full-text PDF read of the top N papers</text>
    <line x1="340" y1="318" x2="340" y2="332" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rg-arrow)" />
    <rect x="65" y="334" width="550" height="34" rx="17" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="85" y="356" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="700" fill="var(--vp-c-brand-1)">Gate 3 (pauseBeforeBriefing)</text>
    <text x="290" y="356" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Star, dismiss, or comment before Stage 5 synthesis</text>
  </svg>
</div>

Each gate pauses the active pipeline run in the browser until you click its <span class="ui-action">Continue →</span> button. The gates themselves consume zero tokens, and they allow you to catch misclassified papers before the pipeline spends tokens on downstream scoring or PDF reading.

Gates 2 and 3 also display the projected token cost of the upcoming stage based on average token counts and the pricing snapshot in the model registry (`utils/models.js`). At Gate 2, the banner reports how many papers will receive a full-text PDF read alongside the estimated cost on your selected `pdfModel`, updating live as you star or dismiss candidates; at Gate 3, the banner reports the estimated synthesis cost on your `briefingModel`. If the registry does not carry pricing for a custom model ID, the cost line is omitted.

Every gate renders a consistent banner containing a status summary, the primary <span class="ui-action">Continue →</span> button, and a **Skip remaining gates this run** link at the top of the gated section. When a gate activates, the page scrolls the banner into view automatically, the progress timeline marks the held stage with `◐` and an instructional message (such as _"Waiting for you: review the scores below"_), and the browser tab title prepends `⏸ Waiting for your review` to the Aparture window title until you resume the run.

## Gate 1: after the quick filter

### What it does

In Stage 2, the `filterModel` slot (default `gemini-3.5-flash-lite`) assigns a <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">NO</span> triage verdict to every fetched abstract along with a one-sentence summary and brief justification, filtering out clearly unrelated papers before Stage 3 abstract scoring.

When `pauseAfterFilter` is enabled (default: **on**), the pipeline pauses immediately after Stage 2 completes and displays the Gate 1 review banner with a <span class="ui-action">Continue to scoring →</span> button above the three verdict buckets.

![Gate 1 displays the filter-review banner with a Continue to scoring button and Skip remaining gates link above the filtered papers grouped into YES, MAYBE, and NO buckets with per-paper verdict pills.](/screenshots/gate-1-filter.png)

_Gate 1 on a dry run displays the bucket counts in the banner above the YES, MAYBE, and NO paper lists with clickable verdict pills on each row._

### What you see

Each paper row displays its title, author list, one-sentence italic summary, and _"Verdict reasoning:"_ justification alongside three clickable verdict pills (<span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-no">NO</span>). The active verdict pill is filled while the other two are outlined. Clicking an outlined pill moves the paper into that bucket and marks the pill with a `⇄` override indicator.

Clicking <span class="ui-action">Continue to scoring →</span> advances the pipeline to Stage 3 using the updated bucket assignments.

### What to do there

When the filter's bucket assignments look accurate, click <span class="ui-action">Continue to scoring →</span> without making changes. When a paper is misclassified, click the appropriate verdict pill to override it:

- Moving a paper from <span class="verdict is-no">NO</span> to <span class="verdict is-yes">YES</span> or <span class="verdict is-maybe">MAYBE</span> rescues it into Stage 3 scoring on the active run.
- Moving a paper from <span class="verdict is-yes">YES</span> to <span class="verdict is-no">NO</span> drops it before Stage 3 so you do not spend scoring or PDF tokens on an irrelevant submission.

Every click immediately records a `filter-override` feedback event. The verdict pills also remain interactive in the Pipeline view after a run completes so that you can log post-run filter corrections for profile refinement without re-running the pipeline. Repeated <span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span> overrides signal to the refinement flow that your profile is too narrow in that area, whereas repeated <span class="verdict is-yes">YES</span> → <span class="verdict is-no">NO</span> overrides signal that it is too broad (see [Giving feedback → The filter-review gate](/using/giving-feedback#the-filter-review-gate-carries-override-buttons)).

### In practice

Common triage situations at Gate 1 include:

- **The filter excludes an adjacent methods paper framed around an unfamiliar application domain**: Override its verdict to <span class="verdict is-maybe">MAYBE</span> so Stage 3 evaluates the full abstract against your scoring rubric.
- **The filter admits a broad promotional abstract with no substantive methodological contribution**: Override its verdict to <span class="verdict is-no">NO</span> to exclude the low-relevance paper before scoring.
- **The filter misclassifies an entire bucket of cross-listed papers**: Attach a single bucket-level scoped note (`"+ feedback on this bucket"`) rather than clicking fifteen individual overrides.

Most overrides occur while scanning the <span class="verdict is-yes">YES</span> and <span class="verdict is-maybe">MAYBE</span> buckets, plus a quick title scan of <span class="verdict is-no">NO</span> to ensure no core paper was dropped.

## Gate 2: before PDF analysis (score review)

### What it does

After Stage 3 abstract scoring and the optional Stage 3.5 post-processing consistency pass complete, the pipeline has a ranked list of scored abstracts ready for Stage 4 full-text PDF reading. When `pauseBeforeDeepAnalysis` is enabled (default: **on**), the pipeline pauses at Gate 2 and displays a review banner with a <span class="ui-action">Continue to PDF analysis →</span> button above three collapsible score groups.

![Gate 2 displays the score-review banner showing how many papers will be deep-read and the estimated cost above the expanded Will PDF group, where each scored paper row has STAR and DISMISS buttons.](/screenshots/gate-2-score-review.png)

_Gate 2 on a dry run shows the projected Stage 4 PDF analysis cost in the banner above the expanded Will PDF candidate group._

### What you see

Gate 2 organizes the scored abstracts into three collapsible bands:

- **Will PDF (top-N)** (expanded by default): The top `N` papers by score scheduled to advance to Stage 4 under your current **Papers to Analyze** (`maxDeepAnalysis`, default 30) setting.
- **Borderline** (collapsed by default): The next band of papers immediately below the top-N cutoff, containing up to `min(maxDeepAnalysis, 50)` papers. Expanding this band lets you inspect candidates that narrowly missed the automatic cutoff.
- **Low score** (collapsed by default): All remaining scored papers below the borderline band.

Each row displays the paper's title, authors, abstract relevance score, scoring justification, and (when the paper was seen in an earlier run within the last 90 days) a muted _"seen ‹date›"_ duplicate badge. The right side of each row provides three controls:

- **STAR**: Guarantees that this paper advances to Stage 4 full-text PDF analysis regardless of its abstract score.
- **DISMISS**: Excludes this paper from Stage 4 PDF analysis on the current run.
- **💬 add comment**: Attaches a free-text comment to the paper without changing whether its PDF is analyzed.

### The selection logic

The candidate set sent to Stage 4 combines the automatic top-N cutoff with your explicit Gate 2 overrides:

```
PDF set = (top-N by score) ∪ {papers you starred} − {papers you dismissed}
```

Starring papers in the **Borderline** or **Low score** groups pulls them into Stage 4, and dismissing papers in **Will PDF (top-N)** removes them. If you star multiple borderline papers without dismissing top-N papers, the resulting PDF set can exceed `maxDeepAnalysis` because explicit stars override the automatic count cap.

Furthermore, any paper you star carries a downstream guarantee through the rest of the run: even if its post-PDF `finalScore` falls below the `finalOutputCount` cutoff, a starred paper is always retained in `finalRanking` and included in the synthesized briefing.

### Round-level note

Inside the Gate 2 banner beneath the cost estimate sits the free-text **"+ feedback on this scoring round"** field. Use this field to record observations about the scoring distribution as a whole (for example, _"scores feel compressed between 5 and 7"_ or _"the filter let through many tangential ML papers in this batch"_). This note is stored as a `score-review` scoped feedback event for the next profile refinement pass.

### Skip remaining gates this run

Every gate banner (Gate 1, Gate 2, and Gate 3) includes a <span class="ui-action">Skip remaining gates this run</span> link in the top right next to the Continue button. Clicking it advances the pipeline and bypasses all subsequent pause gates for the remainder of the active run without altering your saved Settings checkboxes, so the next run will still pause normally.

Click <span class="ui-action">Continue to PDF analysis →</span> once your candidate list is finalized to start Stage 4.

## Gate 3: before briefing synthesis

### What it does

Once Stage 4 finishes reading the selected PDFs, the pipeline has full technical reports, extracted key figures, and updated relevance scores for every analyzed paper. When `pauseBeforeBriefing` is enabled (default: **on**), the pipeline pauses at Gate 3 with an _"Analysis complete: review before briefing"_ banner and a <span class="ui-action">Continue to briefing →</span> button above the interactive Analysis Results list.

![Gate 3 displays the pre-briefing banner with a Continue to briefing button and briefing cost estimate above the Analysis Results list of PDF-analyzed papers.](/screenshots/gate-3-pre-briefing.png)

_Gate 3 on a dry run lets you star, dismiss, or comment on the analyzed papers before Stage 5 synthesizes the briefing._

### What to do there

Mark stars, dismissals, and comments on the analyzed papers to shape how Stage 5 writes the briefing:

- **Starred papers** anchor the executive summary and top themes and receive the most detailed _"why it matters"_ paragraphs.
- **Dismissed papers** are deprioritized or briefly noted as low-fit in the synthesis.
- **Paper comments** (<span class="ui-action">+ comment</span>) are passed directly to the synthesis writer and woven into that paper's card prose.

To give the briefing writer a run-wide editorial instruction (such as _"Lead with the diffusion-models cluster"_ or _"Emphasize methodological limitations in each card"_), click <span class="ui-action">+ Add a comment</span> inside the Gate 3 banner. Saved banner notes appear under _"Sent to the briefing writer with this run"_, guide the current synthesis call (subject to the hard citation and sourcing rules), and are saved simultaneously as general comments for future profile refinement.

While both Gate 2 and Gate 3 record `star` events, their operational roles differ by stage: starring at Gate 2 instructs the pipeline to _read the paper's PDF_, whereas starring at Gate 3 instructs the synthesis writer to _feature the paper prominently in the briefing_. Similarly, feedback given at Gate 3 shapes the briefing about to be synthesized, whereas feedback recorded later on the finished briefing page accumulates for future profile refinement (see [Refining over time](/using/refining-over-time)).

Click <span class="ui-action">Continue to briefing →</span> to run Stage 5 synthesis and the hallucination audit.

## Stopping a run

Clicking <span class="ui-action">Stop</span> halts the active run at its next checkpoint and immediately unlocks the interface controls so you can start a fresh run. Any API requests already in flight with a provider complete in the background (and are billed by the provider), but their late responses are discarded so they cannot overwrite the new run's state, and a stopped run never saves a briefing.

## Progression: from on by default to off

All three gates default to **on** because inspecting intermediate outputs during your first five to ten runs reveals how your initial profile interacts with the filter, scoring rubric, and synthesis prompt. Once your profile has converged, you can selectively disable gates that no longer justify their pause:

- **Disable `pauseAfterFilter` (Gate 1) first**: Once your profile's positive topics and anti-interests are well specified, Stage 2 filter overrides become rare and Stage 3 abstract scoring is inexpensive.
- **Keep `pauseBeforeDeepAnalysis` (Gate 2) enabled while calibrating scores**: Gate 2 sits directly in front of the most expensive stage (Stage 4 PDF reading), making it the highest-value checkpoint for rescuing borderline papers and excluding obvious low-relevance papers before downloading PDFs.
- **Keep `pauseBeforeBriefing` (Gate 3) enabled when you want active editorial steering**: Starring and commenting at Gate 3 shapes the narrative structure of the current day's briefing before it is written.
- **Disable all three gates for fully unattended runs**: With all three checkboxes off, clicking <span class="ui-action">Start Analysis</span> runs Stages 1 through 5 continuously to a finished briefing without manual intervention.

When you want gates enabled by default but occasionally need an unattended run, click **Skip remaining gates this run** at Gate 1 to let the rest of that run proceed automatically.

## When to re-enable a gate you'd disabled

Re-enabling one or more review gates for a few runs is helpful whenever you change the inputs to the pipeline:

- **After a major profile rewrite**: Re-enabling `pauseAfterFilter` (Gate 1) and `pauseBeforeDeepAnalysis` (Gate 2) for two or three runs verifies that new exclusions or added subfields are not over- or under-filtering.
- **After adding new arXiv categories**: Inspecting Gate 1 and Gate 2 shows what volume and topic mix the new subcategories bring in.
- **After switching stage models**: Different model families calibrate scores slightly differently, so watching the first few runs at Gate 2 confirms that your `maxDeepAnalysis` cutoff still falls in the expected score range.

## Where to toggle them

All three gate checkboxes live in <span class="ui-action">Settings</span> under **Review & confirmation**:

- **Pause after filter to review overrides**: Controls Gate 1 (`pauseAfterFilter`).
- **Pause before deep analysis**: Controls Gate 2 (`pauseBeforeDeepAnalysis`).
- **Pause before briefing to review scores and add feedback**: Controls Gate 3 (`pauseBeforeBriefing`).

Alongside them in the same section sit the two synthesis audit retry toggles: **Auto-retry briefing if hallucination check returns <span class="verdict is-no">YES</span>** (enabled by default) and **…<span class="verdict is-maybe">MAYBE</span>** (disabled by default). All Settings toggles are locked while a pipeline run is in progress and take effect on the next run.

::: info One-off unattended runs
Because Settings checkboxes apply globally across runs, use the **Skip remaining gates this run** link on any gate banner whenever you want a single unattended pass without modifying your saved configuration.
:::

## Next

Continue to [Tuning the pipeline →](/using/tuning-the-pipeline) to configure the remaining stage parameters in Settings, including model slots, batch sizes, concurrency limits, candidate counts, and safety-refusal policies.

Related guides:

- [**Giving feedback**](/using/giving-feedback): How filter overrides, stars, dismissals, and scoped notes propagate into profile refinement.
- [**The pipeline**](/concepts/pipeline): Complete architectural tour of Stages 1 through 5.
