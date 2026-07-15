# Tutorial: a week with the feedback loop

The claim this tool makes is that your briefings get better with use. This tutorial is the shortest honest test of that claim: five runs over a week, with specific feedback to give at each step and specific changes to look for. It assumes you have completed [your first briefing](/using/first-briefing).

The examples below follow the **Focused: Bayesian cosmology** starter template. Substitute your own field throughout — the mechanics are identical.

## Before you start: what the loop actually is

Nothing in Aparture learns silently. The loop has exactly three moving parts:

1. **You react** to what the pipeline shows you — stars, dismissals, comments, verdict overrides, and notes at the review gates.
2. **Suggest improvements** reads all of that and proposes edits to your profile, each with a written rationale. You accept or reject each edit individually.
3. **The next run reads the edited profile.** Every stage — filter, scoring, PDF selection, briefing — uses the same document.

So the loop is only as good as two things: the feedback you give, and the judgment you apply to the proposed edits. This tutorial is practice at both.

## Day 1 — run, then react honestly

Run a briefing on your normal categories. Read it start to finish, then go back and react:

- **Star** (☆) any paper you would have opened from the listings anyway. That is the bar — not "interesting" but "I would have clicked this."
- **Dismiss** (✕) papers that made it into the briefing but shouldn't have. Don't be polite. A dismissed paper is the single clearest signal the profile has a leak.
- **Comment** on one or two papers where star/dismiss can't carry the reason. Comments are where the nuance lives. Compare:

  > _Useless:_ "not relevant"
  >
  > _Useful:_ "I care about hierarchical inference methods, not this specific supernova dataset — the method here is standard MCMC"

  The second one gives the suggest step something to work with: it separates the method (wanted) from the application (incidental).

- At Gate 1, if the filter let through a bucket of clearly off-topic papers — or excluded something you spotted in the NO list — flip the verdict pill. Each override is recorded as a "too broad / too narrow" signal.

Expect the day-1 briefing to be rough. A narrow template profile typically over-includes adjacent work (in the cosmology example: general GW papers that aren't about inference) and under-weights your specific methods vocabulary.

## Day 2 — the first profile edit

Before running again, open **Profile → Suggest improvements**. The dialog shows the feedback it will use — yesterday's stars, dismissals, and comments — and a free-text field for anything the events don't capture ("I keep seeing instrumentation papers; I only care about analysis methods").

![The suggest dialog with accumulated feedback selected](/screenshots/suggest-dialog.png)

Generate the suggestion and read the diff the way you'd read a referee report on your own abstract:

- **Accept** edits that name a real pattern in your feedback. If you dismissed three detector-calibration papers and the edit adds "not instrumentation or calibration work," that's the loop working.
- **Reject** edits that overfit a single event. One dismissed paper about neutrino cosmology does not mean you never want neutrinos; if the edit is that aggressive, reject it and leave a comment on the next such paper instead.
- If it proposes nothing, it says why. A day of thin feedback legitimately yields "no change needed" — that's honesty, not failure.

Accepted edits become the new profile. The old version stays in revision history, so nothing here is destructive.

Run day 2 with the edited profile.

## Days 3–4 — feedback with scope

Individual paper reactions are the fine grain. The gates give you coarser, often more powerful signals:

- **Gate 1 bucket notes** ("+ feedback on this bucket"): when a whole verdict bucket has a pattern — "half the MAYBEs are ML-for-astronomy papers with no statistical content" — one bucket note beats ten dismissals.
- **Gate 2 scoring notes** ("+ feedback on this scoring round"): when scores are systematically off — "survey papers keep scoring 7+ but I never read surveys" — say it here. This is also where the deep-read cost estimate sits; if you're routinely starring papers from the borderline group into the PDF set, that's worth a note too.
- **Run notes** (under the briefing): impressions of the briefing as a whole. "The executive summary keeps leading with the highest-scored paper even when the theme is elsewhere" is run-scope feedback.

Run **Suggest improvements** again on day 4. With two more days of events plus scoped notes, the proposed edits should get more structural — reorganizing the profile's emphasis rather than adding exclusions. Judge them the same way: accept patterns, reject overfitting.

## Day 5 — check for convergence

Signals that the loop is working, in roughly the order they appear:

1. **Fewer verdict overrides at Gate 1.** The filter is reading your profile, so a tightened profile shows up here first.
2. **Fewer dismissals in the briefing.** The papers that reach the page deserve to be there.
3. **The borderline group at Gate 2 stops surprising you.** Papers near the cutoff are genuinely near your interests' edge, not category errors.
4. **The briefing's lead reads like your priorities.** Themes group the way you would group them.

What "done" looks like: you stop editing the profile weekly and start editing it when your research direction actually moves. The profile is memory, not configuration — it should change at the rate your interests change.

## Two ways this goes wrong

**Overfitting.** If you accept every proposed exclusion, the profile converges to "only papers exactly like the ones I starred" and you lose the discovery function — the one paper that matters is often adjacent to your interests, not inside them. Keep at least one sentence of genuine breadth in the profile ("I also want occasional exposure to major results in neighboring areas"), and be suspicious of any suggested edit that deletes it. The scoring rubric explicitly calibrates strictness to the profile's breadth, so that sentence does real work.

**Under-feeding.** The suggest step includes all stars, dismissals, and overrides, but comments are capped at the most recent 30 per type. If you only ever star and never say why, the edits will be blunt. One good comment a day outperforms a week of silent stars.

## Where to go next

- [Giving feedback](/using/giving-feedback) — the full reference for every feedback type and where it flows.
- [Refining over time](/using/refining-over-time) — the suggest flow in detail, including revision history and reverting.
- [Writing a good profile](/using/writing-a-profile) — for when you'd rather edit the document directly than wait for the loop.
