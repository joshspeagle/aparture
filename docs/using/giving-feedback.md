# Giving feedback

Feedback is how Aparture learns what you actually care about. Small signals — stars, dismisses, short notes on papers, corrections on filter verdicts — build up quietly as you use the tool. Later on, you can hand them to the flow that proposes edits to your profile: it reads everything you've marked and suggests specific changes, which you accept or reject per-change. None of this is required for usable briefings on day one, but it's the main way the system evolves past your starter profile text.

This page walks through the five kinds of feedback Aparture supports, where each one lives in the interface, how they differ in behaviour, and how much feedback you typically need before the refinement flow is worth running. The related page on [refining over time](/using/refining-over-time) goes deeper on the refinement step itself.

## The five feedback types

<div class="landing-cards">

<div class="landing-card">

### ★ Star

Your way of saying "this one matters to me". Stars you give before a briefing writes make the paper get more attention in the editorial treatment; starring a paper on a briefing you're already reading doesn't retroactively change it, but the star is kept against that paper and becomes input to the refinement flow.

</div>

<div class="landing-card">

### ⊘ Dismiss

The opposite of star: "this one isn't for me". Before a briefing writes, it pushes the paper lower in the treatment. Afterwards, it accumulates as a "my profile might be too broad here" signal for the refinement flow.

</div>

<div class="landing-card">

### 💬 Paper comment

A short note about one specific paper. Comments you leave before a briefing writes get woven into that paper's *why it matters* paragraph; comments you leave afterwards don't change what you're reading, but they're among the strongest inputs the refinement flow has — specific, varied, paper-grounded.

</div>

<div class="landing-card">

### 💬 General comment

A note that isn't about any one paper. Examples: *"I'm shifting focus to Bayesian methods this month"*, or *"stop recommending vision-only papers"*. General comments go to the refinement flow as profile-wide cues rather than paper-level ones.

</div>

<div class="landing-card">

### ⇄ Filter override

A correction on the filter's <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> call for a specific paper. Only available at Gate 1, the pause after the filter runs. Moving a paper from <span class="verdict is-no">NO</span> to <span class="verdict is-yes">YES</span> tells the refinement flow your profile might be too narrow on that kind of work; moving <span class="verdict is-yes">YES</span> to <span class="verdict is-no">NO</span> says it might be too broad.

</div>

</div>

Every signal feeds into one local feedback store. When you trigger the refinement flow, it reads everything in the store when deciding what edits to propose.

## Where each one appears

### Stars and dismisses live on paper cards

Any paper card in Aparture carries a <span class="ui-action">☆ star</span> and a <span class="ui-action">⊘ dismiss</span> button. You'll see them in three places:

- **Analysis Results list** (Pipeline view). As soon as the PDF-analysis stage finishes, each card is fully interactive; you don't have to wait for the briefing to write before marking papers.
- **Paper cards inside a briefing.** Same two buttons in the rendered briefing. The briefing itself was written from whatever signals existed when synthesis ran, so marking papers here doesn't change what you're reading — the feedback feeds the refinement flow instead.
- **Filter results** at Gate 1. Once scoring has run on a given paper, its card gets the star and dismiss buttons too.

Clicking a star toggles it between empty and filled: <span class="ui-action">☆ star</span> → <span class="ui-action">★ starred</span>. Click again to remove. Dismiss works the same way.

### Paper comments live on the + comment button

Every paper card also has a <span class="ui-action">+ comment</span> button. Clicking it opens a small text box labelled *"Your thoughts on this paper…"*, with <span class="ui-action">Save</span> and <span class="ui-action">Cancel</span>. Save, and the comment is attached to that paper from then on.

Comments given before a briefing writes get quoted or paraphrased in that paper's *why it matters* paragraph. A comment like *"skeptical of the evaluation"* usually gets acknowledged in the framing; *"want to compare with last week's approach"* shapes how the paper gets positioned. Comments you leave on a briefing you're reading don't change it, but they feed the refinement flow, where a well-placed comment is one of the clearest signals it has.

### General comments live in the Feedback panel

Every briefing view has a section at the bottom of the main area labelled **Feedback**. Scroll past the briefing itself to find it. Near the top of that section is an <span class="ui-action">+ Add a comment</span> button that opens a larger text box — *"General comment on this week's briefing or your research interests…"* — for notes that aren't tied to any one paper.

These are often the most useful kind of signal for the refinement flow because they describe intent directly. They're also how you tell the system about a shift in focus, a frustration with a recent briefing's emphasis, or a direction you want your reading to go.

### Filter overrides live on the verdict buttons at Gate 1

When the pipeline pauses at Gate 1, each paper in the filter results has three clickable buttons for the filter's verdict: <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, <span class="verdict is-no">NO</span>. The current verdict is filled in; the other two are outlined. Clicking a different one switches the paper to that bucket, and a small `⇄` appears on the new choice to mark it as an override.

Every override is recorded as a scope signal. Moving a paper from <span class="verdict is-no">NO</span> to <span class="verdict is-yes">YES</span> tells the refinement flow your profile is probably too narrow in that area; <span class="verdict is-yes">YES</span> to <span class="verdict is-no">NO</span> suggests it's too broad. <span class="verdict is-maybe">MAYBE</span> overrides tell it where the line is ambiguous.

Overrides only work at this stage. Once you continue to scoring, the buttons deactivate.

## How the different types behave

Stars, dismisses, and filter overrides are togglable: only the most recent state matters. If you star a paper, unstar it, then star it again, the refinement flow sees that it's currently starred. The intermediate states are kept in history but don't count as signal on their own.

Comments are different — each one is a separate entry. A second comment doesn't replace the first. If you leave *"interesting method"* on Monday and *"but the evaluation is thin"* on Tuesday, the flow sees both, in order.

::: tip Practical consequence
Toggle stars and dismisses freely; only the current state counts, so there's no cost to changing your mind. Leave comments a bit more deliberately — they accumulate, so their effect on the profile over time is longer-lasting.
:::

## The Feedback panel

The Feedback panel is the central view for everything you've marked across all runs. It sits at the bottom of every briefing, just below the NotebookLM card. It has four parts.

### Counts and the Suggest button

The top of the panel shows two counts: *new* events since the last time you ran the refinement flow, and *total* events ever recorded. *New* grows as you feed back and resets when you run the flow. Next to the counts is a <span class="ui-action">Suggest improvements →</span> button that opens the refinement dialog.

The same button also appears on the Profile page in its own card, right next to your profile text. Either trigger opens the same flow.

### The general comment field

The <span class="ui-action">+ Add a comment</span> button expands a larger text box for adding a general comment from the briefing view. This is the only place in the app where general comments can be added.

### Filters

Three controls for narrowing the timeline below:

- A **Type** menu: all types, stars, dismisses, comments, or overrides.
- A **New only** toggle: show only events since the last time you ran the refinement flow.
- A **Date range** menu: all time, last week, last 30 days, and so on.

### The timeline

A chronological list of every feedback event, most recent first. Each entry shows when you gave it, a small icon for the type (★, ⊘, 💬, ⇄), and either the paper's title (for paper-scoped events) or the comment text (for general ones). Paper-scoped entries also show the paper's score and which briefing they came from.

The timeline is useful for two things: reminding yourself what you've been marking, and spotting patterns you hadn't noticed. *"I keep dismissing interpretability papers"* is often a hint the profile is a little off in that area.

## How much feedback is enough?

The refinement flow works from the aggregate of everything you've given it — all five types — so what matters is how much total signal the store holds, not how long you've been using Aparture. A rough guide:

| Aggregate volume                    | What to expect from the refinement flow                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fewer than ~10 events total         | Thin. Proposals tend to be vague, or the flow comes back with a "no clear change" reason.                        |
| ~10–30 events across a mix of types | Usually enough for concrete, defensible edits — especially if a few comments are in the mix.                     |
| 30+ events including comments       | Rich enough that proposals can cite specific reactions and recommend targeted additions or exclusions.           |

This isn't a time thing. A heavy first-day session — say a dozen filter overrides, half a dozen stars, and a couple of general comments — gives the flow plenty to work with, so running it that day is fine. Two quiet weeks of barely-engaged briefings might still be too thin.

Diversity matters as much as raw volume. All stars and no dismisses, or all overrides and no comments, leaves the flow with less to reason about than a mix across types. If the store is full but the proposals feel light, adding a general comment or two before running the flow again often helps.

## Next

[Writing a good profile →](/using/writing-a-profile) — turn the signals you've been marking into a profile the pipeline can reason about more directly.

Also worth reading:

- Go deeper on the refinement flow itself. → [Refining over time](/using/refining-over-time)
- The two pause gates are slowing your runs and you want to adjust them. → [Review gates](/using/review-gates)
