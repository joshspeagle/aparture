# Refining over time

Once you've been giving feedback for a week or two, your profile will usually be due for an update. Rather than rewriting it by hand — trying to remember everything you starred, every paper you wished the pipeline had dismissed — you can hand the accumulated feedback to a flow that proposes profile edits. It reads your current profile plus everything you've marked and returns a list of small, targeted changes, each with its own rationale. You pick which ones to apply.

This page covers that flow: what it sees, what the review step looks like, and how often it's worth running.

## The loop in one sentence

Read a briefing → react (stars, dismisses, comments, filter overrides) → let feedback accumulate → click <span class="ui-action">Suggest improvements →</span> → review the proposed changes one at a time → accept any subset → the next briefing uses the revised profile.

Most of the detail below is about the review step, because that's where you actually make decisions.

## What the flow sees

The <span class="ui-action">Suggest improvements →</span> button lives in two places — at the top of the Feedback panel beneath every briefing, and in its own card on the Profile page — and both open the same flow. When you click it, the dialog that opens lists every new feedback event since your last profile revision, with checkboxes so you can include or exclude specific events. All are included by default.

When you click <span class="ui-action">Generate suggestion</span>, the model receives:

- Your current profile text.
- Every paper you've **starred** or **dismissed** — the current state per paper, so if you starred then un-starred a paper, the model only sees that it's un-starred.
- Every paper with a **filter override** — the current verdict plus what the override signals (too-narrow or too-broad).
- Your most recent **paper comments** — capped at the most recent 30, so long comment histories get trimmed. If the cap fires, the dialog shows an amber notice naming how many older comments were dropped.
- Your most recent **general comments** — same 30-comment cap.

The model's job is to read these signals and propose surgical edits that bring your profile into better alignment with what the feedback suggests you actually want.

## Suggested changes, not a rewrite

The output isn't a new profile. It's a list of atomic, non-overlapping changes, each with:

| Field          | What it holds                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| **Edit type**  | `replace`, `insert`, or `delete`.                                                                         |
| **Anchor**     | An exact substring from your current profile that the change targets.                                     |
| **Content**    | The new text (for replace and insert). Empty for delete.                                                  |
| **Rationale**  | A short line explaining why, usually citing specific feedback events by arXiv ID.                         |

Changes are guaranteed non-overlapping — if two candidate edits would touch adjacent text, the model merges them into one — so you can accept any subset and the result is still well-formed. The API validates this server-side and retries once if the model returns overlapping edits.

## The review dialog

When suggestions come back, the dialog swaps to a per-change review. Top to bottom:

### Change cards

Each proposed change renders as a card with a checkbox (checked by default), a small label showing the edit type, a diff preview, and the model's rationale below.

The diff preview uses the same colour conventions throughout the app: the anchor text in red (with a strikethrough if it's being deleted or replaced), the new text in green. For inserts, the anchor is shown as grey *"after: …"* context because the anchor itself isn't being touched — the new content is going in right after it.

Rationales tend to look like *"You starred three papers on mixture-of-experts routing and dismissed two on sparse attention; this adds MoE to your active topics and removes sparse attention."* Read them. Uncheck anything whose reasoning you don't buy.

### Cumulative preview

Below the cards sits a live preview showing the profile you'd end up with from your current selection, in serif prose the way the LLM will read it. Check and uncheck cards and the preview updates in real time.

::: tip
The cumulative preview is the thing to watch here — it's the only place that shows the final profile as a whole. If it looks wrong as you toggle changes (a paragraph has disappeared, an anti-interest line reads oddly, the structure has drifted), adjust the checkboxes until it reads the way you want.
:::

### Apply

The Apply button at the bottom reflects your current selection — <span class="ui-action">Apply 3 of 5 changes</span>, and so on. <span class="ui-action">Select all</span> and <span class="ui-action">Select none</span> helpers sit next to it. Clicking Apply commits the cumulative preview as your new profile and archives the previous version in history with a rationale composed from the accepted changes' rationales.

## "No clear change" — when feedback is ambiguous

Sometimes the model can't find a clear improvement. When that happens, the dialog shows a single *"No profile changes suggested"* panel with a short explanation — a `noChangeReason` — rather than a change list.

This usually comes up when:

- Your feedback is too sparse. A handful of events don't give the model much to work with.
- Your feedback is contradictory. You starred one paper on a topic and dismissed another on the same topic, so the signal is unclear.
- Your profile already captures the signal. The papers you dismissed were already excluded by your anti-interests; there's nothing to change.

Close the dialog, keep giving feedback, and try again after a few more briefings. The tool's refusal to invent a change it can't justify is the right default.

## Versioned history and rollback

Every accepted suggestion creates a new entry in your profile history, tagged **suggested** to distinguish it from a manual edit. The previous profile is archived with its own timestamp.

To browse history, expand the <span class="ui-action">History</span> control under the profile text box on the Profile page. Each revision shows a timestamp, a source tag (manual or suggested), and — for suggested revisions — the concatenated rationales of the changes that were accepted. Click a revision to expand its full content, then <span class="ui-action">Revert</span> to restore it.

Reverting is safe: your current profile is itself archived before the target revision is restored, so you can always flip back. The history keeps the last 20 revisions; a <span class="ui-action">Clear history</span> button wipes old revisions without touching the current profile. See [Writing a good profile → Versioned history and rollback](/using/writing-a-profile#versioned-history-and-rollback) for the full mechanics.

## When to run it

Rough guidance, not rules:

- **Weekly, roughly.** A week of daily briefings with casual feedback — a few stars, a few dismisses, an override or two — usually gives the flow enough signal to propose meaningful edits. This is the sweet spot.
- **When a briefing feels off.** If you've just read one that missed papers you care about or included papers you don't, your reactions are fresh and specific — a good time to refine.
- **After a shift in research focus.** Starting a new project or moving to a new field usually needs 3–5 briefings of feedback on the new focus before the flow has enough to work with.

::: warning Avoid running it every day
The flow works best when feedback accumulates across several briefings — it needs both volume and variety to spot patterns. Running it after a single briefing tends to produce *"no clear change"* or to overfit to the one day's papers.
:::

## A sanity check before accepting

Before you click Apply, run the cumulative preview through a quick pass:

- Does the profile still describe *you*, or has it drifted toward describing what the tool happened to surface this week?
- Are the anti-interests still honest? Anti-interests tend to drift faster than positive interests because feedback is mostly about what you liked, not what you didn't.
- Is the profile still a reasonable length (150–300 words)? Occasionally the flow will balloon the profile if the feedback is heavy on comments.
- Would a collaborator reading this profile recognise your research?

If any of those feel off, uncheck the responsible cards — or close the dialog and make the edit by hand.

## Limits

A few things the flow won't do:

- **Write your first profile.** If the current profile is very thin, proposed changes will be too. Write a real profile manually first (see [Writing a good profile](/using/writing-a-profile)), then run refinement once you've given feedback on it.
- **Know about papers it hasn't seen.** The flow only reads the papers you've reacted to inside Aparture plus your comments and overrides. Stars on arXiv itself don't reach it.
- **Re-request specific changes later.** If you apply 3 of 5 and then want the other 2 the next day, there's no "apply the rest" — you'd need to run the flow again. Usually that's fine, because accumulated feedback has grown in the meantime.

## Next

[Review gates →](/using/review-gates) — with a sense of how feedback flows back into the profile, you can decide whether the two pause gates during a run still earn their keep for you.

Also worth reading:

- You've refined your profile and want to tune the rest of the pipeline. → [Tuning the pipeline](/using/tuning-the-pipeline)
- A reminder of what each feedback type contributes. → [Giving feedback](/using/giving-feedback)
- You're reading an old briefing and want to see which profile produced it. → [Reading a briefing → Generation provenance](/using/reading-a-briefing#generation-provenance)
