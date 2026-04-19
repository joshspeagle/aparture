# Giving feedback

Feedback is how Aparture learns what you actually care about over time. Small signals — stars, dismisses, comments, filter overrides — accumulate into a store that the [Suggest Improvements](/using/refining-over-time) flow reads later to propose profile edits. None of this is required to get usable briefings on day one, but it's the main way the system evolves past your starter profile.

This page covers the five feedback types, where each one lives in the UI, and how their semantics differ.

## The five feedback types

There are five kinds of feedback signal. Each has a specific job.

<div class="landing-cards">

<div class="landing-card">

### ★ Star

*Latest-wins, per paper.* "This paper is important to me." Tied to the paper by arXiv ID. Stars given *before* a briefing's synthesis shape its "why it matters" paragraph; stars given afterwards persist on the paper and feed Suggest-Improvements as aggregate signal.

</div>

<div class="landing-card">

### ⊘ Dismiss

*Latest-wins, per paper.* "This paper is not what I want." Same semantics as star: a dismiss given before synthesis deprioritises the paper in the current briefing; dismisses given afterwards persist, shape future appearances of the same paper, and accumulate as a "profile may be too broad here" signal.

</div>

<div class="landing-card">

### 💬 Paper comment

*Append-only, per paper.* "Here's my thought on this specific paper." Pulled into the synthesis prompt so a future briefing's "why it matters" paragraph can reference your reaction. Every comment is a new entry — old comments never get overwritten.

</div>

<div class="landing-card">

### 💬 General comment

*Append-only, profile-level.* "Here's a note that isn't tied to one paper." Profile-level observations like "I'm shifting focus to Bayesian methods this month." Lives in the Feedback panel under Profile.

</div>

<div class="landing-card">

### ⇄ Filter override

*Latest-wins, per paper.* "The quick filter got this verdict wrong." Only available at Gate 1 (the pause after filtering). Flows into Suggest-Improvements as scope-calibration: *too narrow* (<span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span>) or *too broad* (<span class="verdict is-yes">YES</span> → <span class="verdict is-no">NO</span>).

</div>

</div>

All five feed the same feedback store (persisted to `aparture-feedback` localStorage). Suggest-Improvements reads the entire store when generating a revised profile.

## Where each one appears

### Star and dismiss — paper cards

Stars and dismisses appear on every paper card that shows paper-level controls, in three places:

- **Analysis Results list** (Pipeline view) — as soon as Stage 4 finishes, each card has <span class="ui-action">☆ star</span> and <span class="ui-action">⊘ dismiss</span> buttons. Available as soon as deep analysis completes; you don't need to wait for the briefing.
- **Briefing paper cards** — same two buttons in the rendered briefing. Bear in mind that synthesis only saw the stars and dismisses that existed *at synthesis time*, so toggling here affects future briefings (for recurring papers) and Suggest-Improvements, not the briefing you're on.
- **Filter results list** (when the pipeline pauses at Gate 1) — each paper has the three verdict pills (<span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span>) and, once scoring completes, the star/dismiss affordances.

Clicking <span class="ui-action">☆ star</span> turns it into <span class="ui-action">★ starred</span> (filled, amber). Clicking again unstars. Dismiss works the same way: <span class="ui-action">⊘ dismiss</span> → <span class="ui-action">⊘ dismissed</span> → click to reverse.

### Paper comments — the + comment button on paper cards

Every paper card also has a <span class="ui-action">+ comment</span> button. Clicking it reveals a small textarea ("Your thoughts on this paper…") and a Save/Cancel pair. Type, save, and the comment is stored against that paper.

Paper comments are visible on the paper's card in subsequent briefings and get pulled into the synthesis prompt — the "why it matters" paragraph will often quote or reference them. A comment like "skeptical of the evaluation" gets acknowledged in the framing; "want to compare with last week's approach" shapes how the paper is positioned.

### General comments — the Feedback panel

General comments are notes that aren't tied to one paper: "I'm shifting focus to Bayesian methods this month", or "Stop recommending vision-only papers." They live in the **Feedback panel** under the Profile view.

To add one, navigate to <span class="ui-action">Profile</span> in the sidebar, scroll to the **Feedback** panel, find the **General comment** textarea, type, and save. General comments flow into Suggest-Improvements as profile-level signal rather than per-paper signal.

### Filter overrides — the verdict pills at Gate 1

When the pipeline pauses after the quick filter, each paper in the filter results has three clickable verdict pills: <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, <span class="verdict is-no">NO</span>. The current verdict is highlighted; the others are transparent-bordered.

Click a pill to switch the verdict. If you change it from the filter's original verdict, a small `⇄` arrow appears on the active pill to indicate override; hovering reveals a tooltip with the original vs. current state.

Each override is recorded as a `filter-override` feedback event. These are scope-calibration signals: moving <span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span> means the profile may be too narrow on that dimension, and moving <span class="verdict is-yes">YES</span> → <span class="verdict is-no">NO</span> means it may be too broad. Suggest-Improvements treats them that way.

Overrides only make sense before you continue to scoring — once the pipeline moves past Gate 1, the pills disable.

## Latest-wins vs. append-only semantics

There are two semantic models at work, and the distinction matters in practice.

Stars, dismisses, and filter overrides are **latest-wins per paper**. If you star a paper, un-star it, then star it again, only the most recent state matters. Internally the store keeps the event history, but when Suggest-Improvements asks "is this paper starred?", it sees the latest state.

Paper comments and general comments are **append-only**. Every comment is a new entry. If you comment "interesting method" on Monday and "but the evaluation is thin" on Tuesday, the system keeps both — and Suggest-Improvements sees both, in chronological order.

::: tip Practical consequence
Stars and dismisses are cheap: you can toggle them freely because only the current state counts. Comments are durable: they accumulate, so they have a longer shadow on the profile. A useful habit is staying loose with the votes and thoughtful with the comments.
:::

## The Feedback panel

Under the <span class="ui-action">Profile</span> view, you'll find a panel labelled **Feedback** with a count badge (e.g. "12 new / 47 total"). This is your central view of every signal you've ever left. It has four parts.

### Header and Suggest button

The header shows counts of new versus total events. *New* means events since the last time you ran Suggest-Improvements — as you accumulate feedback, the new count grows. The <span class="ui-action">Suggest improvements</span> button opens the SuggestDialog (see [Refining over time](/using/refining-over-time)).

### General comment input

A textarea at the top lets you add a general comment without tying it to a paper. This is where profile-level observations go — "This briefing felt off", "I want more statistics papers", and so on.

### Filters

- **Type filter** — dropdown: All types / Stars / Dismissals / Comments / Overrides. Useful for reviewing just one kind of signal.
- **New feedback only** — checkbox. When checked, shows only events since the last Suggest call.
- **Date range** — All time / Last week / Last 30 days / etc.

### Timeline

A chronological list of every feedback event, most recent first. Each entry shows:

- Timestamp (date + time).
- An icon for the type: ★ star, ⊘ dismiss, 💬 comment, ⇄ override.
- The paper title (for paper-scoped events) or the comment text (for general comments).
- Metadata: paper score, briefing date the event came from.

The timeline is useful both for orienting ("what have I been marking?") and for catching patterns ("I keep dismissing interpretability papers — maybe the profile needs adjusting there").

## How much feedback is enough?

Suggest-Improvements works from the aggregate of all your feedback — filter overrides, stars, dismisses, paper comments, general comments — so what matters is *how much signal* the store holds, not how long you've been using Aparture. A rough guide:

| Aggregate volume                    | What to expect from Suggest-Improvements                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fewer than ~10 events total         | Thin. Proposals tend to be vague or come back with a "no clear change" reason.                                    |
| ~10–30 events across a mix of types | Usually enough for concrete, defensible edits — especially if at least a few comments are in the mix.             |
| 30+ events including comments       | Rich enough that proposals can cite specific reactions you've had and propose targeted additions or exclusions.   |

Volume isn't tied to elapsed time. A heavy first-day session with a dozen filter overrides, half a dozen stars, and a few general comments gives Suggest-Improvements plenty to work with, and proposing profile edits right away is fine. Conversely, two weeks of barely-engaged briefings can still be thin. The Feedback panel header shows total counts — glance at it before running Suggest.

One more factor beyond raw volume: **diversity of signal**. All stars and no dismisses, or all overrides and no comments, leaves Suggest-Improvements with less to reason about than a mix that includes each type. If the panel shows lots of signal but the proposals still feel thin, try adding a general comment or two to the mix before running again.

## Next

[Writing a good profile →](/using/writing-a-profile) — turn everything you've now marked as yes/no feedback into a profile the pipeline can reason about up-front.

Also worth reading:

- You want to use accumulated feedback to refine your profile. → [Refining over time](/using/refining-over-time)
- The two pause gates are slowing your runs and you want to adjust them. → [Review gates](/using/review-gates)
