# Giving feedback

Aparture is designed to get better the more you use it. The way that happens is **feedback** — small signals you leave on papers and briefings that tell the system what you actually care about. After you've accumulated a week or two of feedback, you can click **Suggest Improvements** and let an LLM translate those signals into a revised profile (see [Refining over time](/using/refining-over-time)).

This page covers the five feedback types, where each one lives in the UI, and how the semantics differ between them.

## The five feedback types

| Type                | What it means                                      | Semantics             |
| ------------------- | -------------------------------------------------- | --------------------- |
| **Star**            | "This paper is important to me."                   | Latest-wins per paper |
| **Dismiss**         | "This paper is not what I want."                   | Latest-wins per paper |
| **Paper comment**   | "Here's my thought about this specific paper."     | Append-only           |
| **General comment** | "Here's a note that isn't tied to one paper."      | Append-only           |
| **Filter override** | "The quick filter got this paper's verdict wrong." | Latest-wins per paper |

All five feed into the same feedback store (persisted to `aparture-feedback` localStorage). Suggest-Improvements reads the entire store when generating a revised profile.

## Where each one appears

### Star and dismiss — paper cards

Stars and dismisses appear on every paper card that shows paper-level controls. You'll see them in three places:

- **Analysis Results list** (under Pipeline view). As soon as Stage 4 (PDF analysis) finishes, each paper card has `☆ star` and `⊘ dismiss` buttons. You can star/dismiss without waiting for the briefing.
- **Briefing paper cards** (in the rendered briefing). Same two buttons, same behavior — but the briefing's synthesis will have used any stars/dismisses that existed _at synthesis time_.
- **Filter results list** (when the pipeline pauses at Gate 1). Each paper has the three verdict pills (YES / MAYBE / NO) but also — depending on where you are in the flow — the same star/dismiss affordances.

Clicking `☆ star` turns it into `★ starred` (filled, amber). Clicking it again un-stars. Same for dismiss: `⊘ dismiss` → `⊘ dismissed` → (click to un-dismiss).

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

## Latest-wins vs append-only semantics

Two semantic models here, and the distinction matters:

- **Star, dismiss, and filter-override are latest-wins per paper.** If you star a paper, then un-star it, then star it again, the only thing that matters is the most recent state. Internally the store keeps the event history, but when Suggest-Improvements asks "is this paper starred?", it only sees the latest state.
- **Paper comments and general comments are append-only.** Every comment is a new entry. If you comment "interesting method" on Monday and "but the evaluation is thin" on Tuesday, the system has both — and Suggest-Improvements will see both, in chronological order.

The practical consequence: be liberal with stars and dismisses (you can always reverse them, and there's no cost to changing your mind), and be deliberate with comments (they accumulate, so they shape the profile more permanently).

## The Feedback panel

Under the **Profile** view, you'll find a panel labelled **Feedback** with a count badge (e.g. "12 new / 47 total"). This is your central view of all feedback you've ever left. It has four parts:

### Header and Suggest button

The header shows counts of new versus total events. "New" means events since the last time you ran Suggest-Improvements — so as you accumulate feedback, the new count grows. The **Suggest improvements** button opens the SuggestDialog (see [Refining over time](/using/refining-over-time)).

### General comment input

A textarea at the top lets you add a general comment without tying it to a paper. This is where you drop profile-level observations — "This briefing felt off," "I want more statistics papers," etc.

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

- Your current profile text
- All of your stars and dismisses (latest state per paper)
- All of your filter overrides (latest verdict per paper)
- Your most recent paper comments (capped at ~30 per type to keep prompt size reasonable)
- Your most recent general comments

…to an LLM that proposes a revised profile with per-change rationales. The more (and more varied) signals it has to work with, the better its suggestions will be.

A rough rule: a week of daily briefings with even casual feedback (a few stars, a few dismisses, the occasional comment) gives Suggest-Improvements enough to produce useful proposals. Two weeks is usually enough to see meaningful profile evolution.

## Next

- You've noticed the two pause gates are slowing your runs. → [Review gates](/using/review-gates)
- You want to use accumulated feedback to refine your profile. → [Refining over time](/using/refining-over-time)
- You want to understand what makes a good profile in the first place. → [Writing a good profile](/using/writing-a-profile)
