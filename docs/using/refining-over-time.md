# Refining over time

Aparture is designed to close a loop. You read a briefing, react (stars, dismisses, comments, filter overrides), your feedback accumulates, and eventually you click **Suggest Improvements** — at which point an LLM reads your current profile plus everything you've marked and proposes a revised profile with per-change rationales. You pick which changes to apply and move on.

This page covers that loop: how it works, what the UI looks like, and when to run it versus skip.

## The loop in one sentence

Read the briefing → react (stars, dismisses, comments, filter overrides) → accumulate feedback → click Suggest Improvements → review per-hunk diff → accept some or all changes → next briefing uses the new profile.

That's it. Most of the details below are about the "review per-hunk diff" step, because that's where you actually make decisions.

## What Suggest-Improvements sees

When you click the **Suggest improvements** button (top of the Feedback panel, or in the Your Profile card's "Suggest improvements based on feedback" section), Aparture sends an LLM:

- Your current profile text.
- Every paper you've **starred** or **dismissed** (latest state per paper — if you starred then un-starred, the LLM sees it as un-starred).
- Every paper with a **filter override** (current verdict, and what the override signals: too-narrow or too-broad).
- Your most recent **paper comments** — capped at ~30 per type (so very long comment histories are trimmed with a transparent notice).
- Your most recent **general comments** — same cap.

The LLM's job is to read these signals and propose surgical edits to your profile that bring it into better alignment with what your feedback says you want.

## Suggested changes, not a rewrite

The output isn't a rewrite. It's a list of targeted changes, each with:

- An **anchor** — an exact substring in your current profile that the change targets.
- An **edit type** — `replace`, `insert`, or `delete`.
- New **content** (for replace and insert).
- A **rationale** — why this change was proposed, citing specific feedback.

Changes are guaranteed non-overlapping: if two candidate improvements would touch adjacent text, the LLM merges them into one change. So you can pick any subset of the proposed changes and apply them safely.

## The per-hunk diff UI

When suggestions come back, a dialog opens showing each proposed change as a checkable card. Top to bottom:

### Change cards

Each card shows:

- **A checkbox** (defaults to checked). Uncheck it to exclude this change from the final profile.
- **The edit type** — "Replace," "Insert," or "Delete" — as a small label.
- **A diff preview** — the original text (strikethrough in red) and the proposed text (in green), side by side or transitioned with an arrow.
- **The rationale** — a short italic line explaining why this change was proposed, usually citing specific feedback (e.g. "You starred three papers on mixture-of-experts routing and dismissed two on sparse attention; this change adds MoE to your active topics and removes sparse attention").

Scroll through the cards, read the rationales, uncheck anything you don't like.

### Cumulative preview

Beneath the card list is a live cumulative preview showing the profile that would result from your _current_ selection. Check and uncheck cards; watch the preview update in real time.

::: tip
The cumulative preview is the thing to watch in this dialog — it lets you see exactly what your profile will look like before you commit. If the preview looks weird (a crucial paragraph has disappeared, or an anti-interest line reads oddly), toggle cards until it looks right.
:::

### Apply button

At the bottom, the Apply button reflects your current selection:

- **"Apply 0 of 5"** (disabled) — when nothing is checked.
- **"Apply 3 of 5"** — when 3 of 5 changes are selected.
- **"Apply 5 of 5"** — when all are selected.

There are also **Select all** / **Select none** helpers to quickly toggle.

Clicking Apply commits the cumulative preview as your new profile. The old profile is preserved in history (see below).

## "No clear change" — when feedback is ambiguous

Sometimes the LLM can't find a clear improvement. The response includes a `noChangeReason` field — a short explanation of why it didn't propose any changes.

This typically happens when:

- Your feedback is too sparse. (Two stars and one dismiss doesn't give the LLM much to work with.)
- Your feedback is contradictory. (You starred a paper on X and dismissed another paper on X — the signal is unclear.)
- Your profile already captures the signal. (You dismissed papers that your anti-interests already exclude; there's nothing to change.)

When this happens, the dialog shows the reason and offers no changes to apply. Close the dialog, keep giving feedback, and try again in a few days.

## Versioned history and rollback

Every accepted suggestion creates a new entry in your profile history, labelled "suggested" (to distinguish from manual edits). The previous profile is archived with its own timestamp.

To view history: go to **Profile** in the sidebar, expand the **History** dropdown. You'll see a list of snapshots, each with:

- A timestamp.
- A source tag ("manual" or "suggested").
- A rationale (for suggested revisions, this is the concatenated rationales of the changes you accepted).

Click a snapshot to preview the diff against your current profile. Click again to revert.

Reverting is safe — your current profile is also kept in history, so you can always flip back. There's also a **Clear history** button if your history has gotten long and unwieldy; it wipes all revisions but keeps the current profile intact.

## Cadence: when to run Suggest Improvements

Rough guidance:

- **Weekly.** A week of daily briefings with even casual feedback (a few stars, a few dismisses, an override or two) usually gives the LLM enough signal to propose meaningful changes. This is the sweet spot.
- **When briefings feel off.** If you've just read a briefing that missed papers you care about or included papers you don't, your feedback is fresh and specific — a good time to refine the profile.
- **After a big shift.** Starting a new project? Moving to a new field? Running Suggest Improvements after 3-5 briefings with the new focus helps the profile catch up.

::: warning Don't run it every day
The system works best when feedback accumulates over several briefings — the LLM needs volume and variety to spot patterns. Running Suggest Improvements after a single briefing usually produces "no clear change" or overfits to one day's papers.
:::

## A sanity check before accepting

Before clicking Apply, run the cumulative preview through a quick sanity check:

- Does the profile still describe _you_? Or has it drifted toward describing what the system _gave you_ this week?
- Are the anti-interests still honest? (Anti-interests drift more easily than positive interests, because feedback is usually about what you _did_ like rather than what you didn't.)
- Is the profile still a reasonable length (150-300 words)? Suggest-Improvements can occasionally balloon things.
- Would a collaborator reading this profile recognise your research?

If any of those feel wrong, uncheck the cards that seem responsible, or close the dialog and make the changes manually.

## Limits

A few things Suggest-Improvements won't do:

- **Write your first profile.** If your current profile is very thin or generic, proposed changes will be too. Write a decent profile manually first (see [Writing a good profile](/using/writing-a-profile)), then let Suggest Improvements refine it.
- **Know about papers it hasn't seen.** The LLM only reads your starred/dismissed papers plus comments and overrides. If you star a paper outside Aparture (on arXiv itself, for instance), that signal doesn't reach Suggest Improvements.
- **Re-request just one change.** If you apply 3 of 5, and later want the other 2, there's no "apply the rest" — you'd need to run Suggest Improvements again. Usually that's fine because accumulated feedback has grown in the meantime.

## Next

- You've refined your profile and want to tune the pipeline — models, thresholds, batch sizes. → [Tuning the pipeline](/using/tuning-the-pipeline)
- You want a reminder of what each feedback type does. → [Giving feedback](/using/giving-feedback)
- You're reviewing old briefings and want to see what profile each one used. → [Reading a briefing → Generation provenance](/using/reading-a-briefing#generation-provenance-disclosure)
