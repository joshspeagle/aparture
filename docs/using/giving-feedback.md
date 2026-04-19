# Giving feedback

Aparture is designed to get better the more you use it. The mechanism is **feedback** — small signals you leave on papers and briefings that tell the system what you actually care about. Once you've accumulated a week or two of feedback, you can click **Suggest Improvements** and let an LLM translate those signals into a revised profile (see [Refining over time](/using/refining-over-time)).

This page covers the five feedback types, where each lives in the UI, and how the semantics differ between them.

## The five feedback types

There are five kinds of feedback signal, each with a specific job.

<div class="landing-cards">

<div class="landing-card">

### Star (latest-wins)

"This paper is important to me." Anchors future briefings around related topics and drives the richest "why it matters" treatment in synthesis. Latest state per paper — toggle freely.

</div>

<div class="landing-card">

### Dismiss (latest-wins)

"This paper is not what I want." Deprioritises similar papers in future briefings and feeds Suggest-Improvements as a "profile may be too broad on this dimension" signal. Latest state per paper.

</div>

<div class="landing-card">

### Paper comment (append-only)

"Here's my thought on this specific paper." Gets pulled into the synthesis prompt so the briefing's "why it matters" paragraph can reference your reaction. Every comment is a new entry.

</div>

<div class="landing-card">

### General comment (append-only)

"Here's a note that isn't tied to one paper." Profile-level observations like "I'm shifting focus to Bayesian methods this month." Lives in the Feedback panel under Profile. Every comment is a new entry.

</div>

<div class="landing-card">

### Filter override (latest-wins)

"The quick filter got this verdict wrong." Only available at Gate 1 (the pause after filtering). Flows into Suggest-Improvements as scope-calibration: too-narrow (NO → YES) or too-broad (YES → NO).

</div>

</div>

All five feed the same feedback store (persisted to `aparture-feedback` localStorage). Suggest-Improvements reads the entire store when generating a revised profile.

## Where each one appears

### Star and dismiss — paper cards

Stars and dismisses appear on every paper card that shows paper-level controls. You'll see them in three places:

- **Analysis Results list** (under Pipeline view). As soon as Stage 4 (PDF analysis) finishes, each paper card has `☆ star` and `⊘ dismiss` buttons. You can star or dismiss without waiting for the briefing.
- **Briefing paper cards** (in the rendered briefing). Same two buttons, same behavior — but the briefing's synthesis only used stars and dismisses that existed _at synthesis time_.
- **Filter results list** (when the pipeline pauses at Gate 1). Each paper has the three verdict pills (YES / MAYBE / NO) and, depending on where you are in the flow, the same star/dismiss affordances.

Clicking `☆ star` turns it into `★ starred` (filled, amber). Clicking again un-stars. Same for dismiss: `⊘ dismiss` → `⊘ dismissed` → (click to un-dismiss).

### Paper comments — the "+ comment" button on paper cards

Every paper card also has a `+ comment` button. Clicking it reveals a small textarea ("Your thoughts on this paper…") and a Save/Cancel pair. Type your thought, click **Save**, and the comment is stored against that paper.

Paper comments are visible on the paper's card in subsequent briefings and get pulled into the synthesis prompt — the "why it matters" paragraph will often quote or reference them. If you said "skeptical of the evaluation," the briefing will acknowledge that; if you said "want to compare with last week's approach," it'll frame the paper accordingly.

### General comments — the Feedback panel

General comments are notes that aren't tied to one paper: "I'm shifting focus to Bayesian methods this month," or "Stop recommending vision-only papers." They live in the **Feedback panel** under the Profile view.

To add one: navigate to **Profile** in the sidebar, scroll to the **Feedback** panel, find the **General comment** textarea, type, and save. General comments flow into Suggest-Improvements as profile-level signals rather than paper-level signals.

### Filter overrides — the verdict pills at Gate 1

When the pipeline pauses after the quick filter (Gate 1), each paper in the filter results has three verdict pills: YES, MAYBE, NO. The current verdict is highlighted (green / amber / red); the other two are transparent-bordered.

Click a pill to switch the verdict. If you change it from the filter's original verdict, a small `⇄` arrow appears on the active pill indicating override. Hover to see a tooltip explaining original vs. current.

Each override is recorded as a `filter-override` feedback event. These are a specific kind of signal: "the profile may be too narrow on this dimension" (if you moved something NO → YES) or "too broad" (YES → NO). Suggest-Improvements reads them as scope-calibration signals.

Overrides only make sense before you continue to scoring — once the pipeline moves past Gate 1, the override pills disable.

## Latest-wins vs. append-only semantics

There are two semantic models at work, and the distinction matters in practice.

Stars, dismisses, and filter overrides are **latest-wins per paper**. If you star a paper, un-star it, then star it again, the only thing that matters is the most recent state. Internally the store keeps the event history, but when Suggest-Improvements asks "is this paper starred?", it only sees the latest state.

Paper comments and general comments are **append-only**. Every comment is a new entry. If you comment "interesting method" on Monday and "but the evaluation is thin" on Tuesday, the system has both — and Suggest-Improvements sees both, in chronological order.

::: tip Practical consequence
Be liberal with stars and dismisses (you can always reverse them, with no cost to changing your mind), and be deliberate with comments (they accumulate, so they shape the profile more permanently).
:::

## The Feedback panel

Under the **Profile** view, you'll find a panel labelled **Feedback** with a count badge (e.g. "12 new / 47 total"). This is your central view of every signal you've ever left. It has four parts.

### Header and Suggest button

The header shows counts of new versus total events. "New" means events since the last time you ran Suggest-Improvements — so as you accumulate feedback, the new count grows. The **Suggest improvements** button opens the SuggestDialog (see [Refining over time](/using/refining-over-time)).

### General comment input

A textarea at the top lets you add a general comment without tying it to a paper. This is where you drop profile-level observations — "This briefing felt off," "I want more statistics papers," and so on.

### Filters

- **Type filter** — dropdown: All types / Stars / Dismissals / Comments / Overrides. Useful for reviewing just one kind of signal.
- **New feedback only** — checkbox. When checked, shows only events since the last Suggest call.
- **Date range** — All time / Last week / Last 30 days / etc.

### Timeline

A chronological list of every feedback event, most recent first. Each entry shows:

- Timestamp (date + time).
- An icon indicating the type: ★ star, ⊘ dismiss, 💬 comment, ⇄ override.
- The paper title (for paper-scoped events) or the comment text (for general comments).
- Metadata: paper score, briefing date the event came from.

The timeline is useful both for orienting ("what have I been marking?") and for catching patterns ("I keep dismissing interpretability papers — maybe I should refine my profile").

## Why any of this matters

Feedback is the raw material for the Suggest-Improvements loop. When you click **Suggest improvements** on the Profile page, Aparture sends:

- Your current profile text.
- All of your stars and dismisses (latest state per paper).
- All of your filter overrides (latest verdict per paper).
- Your most recent paper comments (capped at ~30 per type to keep prompt size reasonable).
- Your most recent general comments.

…to an LLM that proposes a revised profile with per-change rationales. The more and more varied signals it has to work with, the better its suggestions will be.

A rough rule: a week of daily briefings with even casual feedback (a few stars, a few dismisses, the occasional comment) gives Suggest-Improvements enough to produce useful proposals. Two weeks is usually enough to see meaningful profile evolution.

## Next

[Writing a good profile →](/using/writing-a-profile) — turn everything you've now marked as yes/no feedback into a profile the pipeline can reason about up-front.

Also worth reading:

- You want to use accumulated feedback to refine your profile after a few weeks of use. → [Refining over time](/using/refining-over-time)
- The two pause gates are slowing your runs and you want to adjust them. → [Review gates](/using/review-gates)
