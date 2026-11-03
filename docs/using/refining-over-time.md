# Refining over time

As you accumulate stars, dismissals, comments, filter overrides, scoped notes, and answers to editor questions across runs, your research profile can be updated directly from that recorded evidence. The profile refinement flow reads your active profile alongside your pending feedback events and returns a list of atomic, non-overlapping diffs, each paired with a written rationale citing the feedback that motivated it. You inspect the diffs individually and apply whichever subset you approve.

## The closed-loop refinement cycle {#the-loop-in-one-sentence}

Each run forms part of a closed-loop cycle in which your profile guides the daily briefing, your reactions accumulate in the feedback store, the proposal gate generates targeted diffs, and your accepted updates revise the profile for subsequent runs:

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 720 420" style="width: 100%; height: auto; max-width: 720px; display: block; margin: 0 auto;" role="img" aria-label="Closed-loop refinement cycle connecting Research Profile and Editorial Notes, Daily Pipeline and Briefing, Reader Feedback and Editor-Question Answers, Proposal Gate and Suggest Adjustments, and Accepted Diffs and Note Updates">
    <defs>
      <marker id="rot-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-text-3)" />
      </marker>
      <marker id="rot-arrow-brand" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-brand-1)" />
      </marker>
    </defs>
    <rect x="130" y="16" width="540" height="56" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="152" y="40" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">1. Research Profile + Editorial Notes</text>
    <text x="152" y="59" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Prose research agenda plus Selection, Writing, and Podcast notes</text>
    <line x1="400" y1="72" x2="400" y2="92" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rot-arrow)" />
    <rect x="130" y="94" width="540" height="56" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="152" y="118" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">2. Daily Pipeline &amp; Briefing</text>
    <text x="152" y="137" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Stages 1 to 5 triage, score, read PDFs, and synthesize the briefing</text>
    <line x1="400" y1="150" x2="400" y2="170" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#rot-arrow)" />
    <rect x="130" y="172" width="540" height="56" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="152" y="196" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">3. Reader Feedback &amp; Editor-Question Answers</text>
    <text x="152" y="215" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Stars, dismissals, overrides, paper/general/scoped comments, and answers</text>
    <line x1="400" y1="228" x2="400" y2="248" stroke="var(--vp-c-brand-1)" stroke-width="1.6" marker-end="url(#rot-arrow-brand)" />
    <rect x="130" y="250" width="540" height="62" rx="10" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.8" />
    <text x="152" y="275" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-brand-1)">4. Proposal Gate / Suggest Adjustments</text>
    <text x="152" y="296" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-1)">Manual Suggest improvements call or automatic trigger (&gt;= 4 pts across &gt;= 2 runs)</text>
    <line x1="400" y1="312" x2="400" y2="332" stroke="var(--vp-c-brand-1)" stroke-width="1.6" marker-end="url(#rot-arrow-brand)" />
    <rect x="130" y="334" width="540" height="62" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-brand-1)" stroke-width="1.4" />
    <text x="152" y="359" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">5. Accepted Diffs &amp; Note Updates</text>
    <text x="152" y="380" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Per-change diff selection, live cumulative preview, and versioned snapshot</text>
    <path d="M 130 365 L 56 365 Q 38 365 38 347 L 38 62 Q 38 44 56 44 L 126 44" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.8" stroke-dasharray="5,4" marker-end="url(#rot-arrow-brand)" />
    <text x="24" y="210" font-family="var(--vp-font-family-mono)" font-size="11" font-weight="600" fill="var(--vp-c-brand-1)" transform="rotate(-90 24 210)" text-anchor="middle">Updated profile feeds next run</text>
  </svg>
</div>

## What the flow sees

The <span class="ui-action">Suggest improvements →</span> button appears both at the top of the Feedback panel beneath every briefing and inside its own card on the Profile page. Clicking either button opens the suggestion dialog, which lists all pending feedback events (every event not yet incorporated into your profile) with individual checkboxes enabled by default. Events recorded during test runs are excluded automatically.

![The Suggest profile improvements dialog displays a checklist of recent feedback events with checkboxes, an optional guidance text box, and Cancel and Generate suggestion buttons.](/screenshots/suggest-dialog.png)

_The suggestion dialog displays all pending feedback events with checkboxes alongside the optional per-call guidance field._

When you click <span class="ui-action">Generate suggestion</span>, the refinement prompt assembles the following inputs for the `briefingModel`:

- **Current profile text and editorial notes**: Your active research profile and scoped editorial notes serve as the baseline document.
- **Starred and dismissed papers**: The current toggle state per `arxivId` (so starring and later unstarring a paper leaves no star signal).
- **Filter overrides**: Each overridden paper's current verdict and directional scope signal (too narrow or too broad). When a paper has both a filter override and a paper comment from the same run, the prompt combines them into a single block (_"overrode NO → YES, with comment: [your rationale]"_) so the model sees the action and explanation together.
- **Recent paper comments**: Up to the 30 most recent paper comments. When more than 30 pending paper comments exist, the dialog displays an amber notice reporting how many older comments were omitted.
- **Recent general comments**: Up to the 30 most recent general comments, each paired with the executive summary, theme titles, theme arguments, and paper pitches of the briefing where it was written so that comparative comments have full context.
- **Scoped feedback notes**: Bucket-level, score-review, and run-level observations grouped by `briefingDate` under three dedicated prompt sections (`BUCKET-LEVEL OBSERVATIONS`, `SCORE-REVIEW NOTES`, and `RUN-LEVEL OBSERVATIONS`). Both filter overrides and scoped notes pass through uncapped because they use latest-wins replacement per key.
- **Answers to editor questions**: All pending answers in a dedicated `ANSWERS TO THE EDITOR'S QUESTIONS` section, each paired with the question text and the cited papers that prompted it.
- **Recently rejected diffs**: Up to the 10 most recent changes you rejected in earlier refinement rounds, accompanied by an instruction not to propose them again unless newer feedback justifies reconsidering them.
- **Per-call guidance**: Any one-time steering instruction you enter at the top of the dialog.

## Automatic proposals

In addition to manual refinement calls, Aparture checks after every completed production briefing (excluding Dry Runs and Minimal API Tests) whether your unweighed pending feedback has reached the threshold for a background proposal round. When the threshold is met, Aparture calls the `briefingModel` in the background; if the model returns candidate edits, a notification card appears beneath the briefing with a <span class="ui-action">Review proposals</span> button that opens the standard review dialog.

The threshold weights pending events by specificity: each star, dismissal, or filter override counts as 1 point, each comment or scoped note counts as 2 points, and each answer to an editor question counts as 4 points. An automatic round triggers whenever unweighed feedback reaches at least 4 points across at least two distinct briefings, or whenever you record an answer to an editor question (which carries 4 points and resolves an explicit profile gap immediately). Requiring at least two briefings for non-answer signals prevents a single atypical submission day from driving profile edits. No new background round runs while existing proposals await your review, and a round that returns `"no clear change"` marks those events as weighed so it does not repeatedly query the model on the same set.

Each automatic proposal round makes one call to `briefingModel`. You can disable automatic proposals under **Settings → Review & confirmation** by unchecking _"Propose profile changes after a briefing…"_ (`autoProposals`).

## Per-call guidance

Above the <span class="ui-action">Generate suggestion</span> button sits an optional text field labelled _"Guidance for this suggestion (optional)"_. Entering a short directive here steers the current suggestion call directly:

- _"Focus on narrowing my astrophysics interests to galactic dynamics specifically."_
- _"Keep the NLP methodology language and drop computer-vision applications."_
- _"Add a sentence stating that I prefer methodological papers over pure applications."_

When populated, per-call guidance acts as the highest-priority instruction in the refinement prompt, directing the model to ground your requested adjustment in the checked feedback events below. Per-call guidance applies only to that single generation call and is discarded when the dialog closes; to record persistent intent across runs, add a general comment in the Feedback panel instead.

## Atomic suggested changes {#suggested-changes-not-a-rewrite}

The refinement endpoint returns a structured array of atomic, non-overlapping diffs against your existing profile text:

| Field         | What it holds                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **Edit type** | `replace`, `insert`, or `delete`                                                               |
| **Anchor**    | The exact substring in your current profile targeted by the edit                               |
| **Content**   | The replacement or inserted text (`replace` and `insert`), or an empty string (`delete`)       |
| **Rationale** | A brief explanation justifying the edit and citing the supporting feedback events by `arxivId` |

Because candidate edits are constrained to be non-overlapping (if two edits touch adjacent text, the model merges them into one diff), you can accept any combination of checkboxes and produce a valid profile document. The server validates non-overlap deterministically and retries once if the model returns overlapping anchors.

## The review dialog

Once suggestions are generated, the dialog switches to the interactive review view containing per-change cards, a live cumulative preview, and apply controls.

### Change cards

Each proposed profile diff renders as an individual card with a checkbox (checked by default), an edit-type badge, an inline diff preview, and the model's rationale.

The inline diff highlights anchor text being removed or replaced in red with a strikethrough and new text in green. For `insert` operations, the anchor substring renders in neutral grey as _"after: …"_ context because the inserted clause is placed immediately following the anchor without deleting it.

Proposed changes to your [editorial notes](/using/writing-a-profile#editorial-notes) render alongside profile diffs as dedicated cards labelled _Add a writing note_, _Revise a note_ (showing the previous note struck through above the replacement), or _Retire a note_. Examine the rationale on every card and uncheck any proposal whose reasoning overgeneralizes from a single paper.

### Cumulative preview

Below the change cards, a live preview renders the complete profile prose that results from your currently checked cards. Toggling any checkbox updates the preview immediately.

::: tip
Always read the cumulative preview before applying changes, because it shows how the individual diffs compose across the full document. If toggling a subset of diffs leaves an awkward transition or removes a breadth statement you want to keep, adjust the checkboxes until the complete preview reads cleanly.
:::

### Apply

The primary action button at the bottom of the dialog updates dynamically to reflect your selection (for example, <span class="ui-action">Apply 3 of 5 changes</span>) alongside <span class="ui-action">Select all</span> and <span class="ui-action">Select none</span> shortcuts. Clicking Apply saves the cumulative preview as your active profile and records a revision history snapshot whose rationale concatenates the rationales of the accepted diffs.

Any diff left unchecked when you click Apply is logged as rejected. Aparture passes your 10 most recent rejected diffs into subsequent refinement calls so the model does not re-propose edits you have already declined. If you uncheck every card, the button changes to <span class="ui-action">Reject all N changes</span> so you can log the rejections explicitly, while <span class="ui-action">Cancel</span> closes the dialog without recording a decision.

The Suggest improvements card on the Profile page tracks your cumulative acceptance rate (for example, _"Suggested changes so far: 7 accepted, 3 rejected (70% accepted)"_). If you find yourself rejecting most proposals, supply a specific per-call guidance string or record a general comment stating your intent before running the flow again.

## Which feedback counts as used

When you apply a set of diffs, Aparture transitions only the feedback events that backed your _accepted_ changes from **pending** to **incorporated**:

- A **star**, **dismissal**, **paper comment**, or **filter override** is marked incorporated when an accepted diff's rationale cites that paper by `arxivId` or full title.
- A **general comment** or **scoped note** is marked incorporated when an accepted diff's rationale quotes it, or when you accept at least one change and no rejected change quoted that note.
- An **answer** to an editor question is marked incorporated whenever you accept at least one change in that round.

All other feedback events (items you unchecked prior to generation, items cited only by rejected diffs, and all items from a _"no clear change"_ round) remain **pending** so that future refinement calls can combine them with newer signals.

## "No clear change": when feedback is ambiguous

When the refinement model concludes that your pending feedback does not support a defensible edit, the dialog displays a _"No profile changes suggested"_ notice accompanied by a `noChangeReason` explanation. Common causes include:

- **Sparse signal**: Only a few pending events have accumulated since your last refinement pass.
- **Conflicting reactions**: You starred one paper and dismissed another within the same narrow topic without leaving explanatory comments to distinguish them.
- **Already covered by the profile**: The papers you dismissed are already excluded by your profile's anti-interests, so tightening the profile text further would be redundant.

Close the dialog and allow additional feedback to accumulate; all pending events remain in the store for the next round.

## Versioned history and rollback

Every accepted suggestion round records a `suggested` entry in your profile history containing the prior profile text, prior editorial notes, timestamp, line-diff counts, and combined rationale (such as _"3 of 5 changes accepted"_).

To inspect or roll back a refinement pass, open the <span class="ui-action">Profile</span> view and expand <span class="ui-action">History</span> beneath the editor. Clicking any entry reveals its line-by-line diff and full prior text, and clicking <span class="ui-action">Revert</span> restores that snapshot. Reverting archives your current profile before restoring the earlier text and automatically resets any feedback events incorporated by the reverted revisions back to **pending** status. The history retains up to 20 revisions, and <span class="ui-action">Clear history</span> purges old snapshots without altering your active profile (see [Writing a good profile → Versioned history and rollback](/using/writing-a-profile#versioned-history-and-rollback)).

## When to run it

Trigger refinement based on the volume and diversity of _not yet incorporated_ events shown at the top of the Feedback panel:

| Aggregate volume                      | What to expect                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Fewer than ~10 pending events         | Sparse signal; often returns _"no clear change"_ or overly broad edits.                             |
| ~10–30 pending events, mixed types    | Sufficient signal for concrete, well-supported diffs, especially when several comments are present. |
| 30+ pending events including comments | Rich signal enabling targeted topic refinements grounded in specific paper reactions.               |

Running refinement is also effective right after reading a briefing whose selection felt miscalibrated (while your paper comments and scoped notes are fresh), or after three to five briefings in a new research direction paired with a direct per-call guidance note.

## A sanity check before accepting

Before clicking Apply, verify the cumulative preview against four criteria:

- **Agenda alignment**: Confirm that the updated text still describes your ongoing research program rather than overfitting to the specific papers that happened to appear in the latest run.
- **Balanced anti-interests**: Check that new negative exclusions have not inadvertently ruled out adjacent methodological work you still want to discover.
- **Compact length**: Keep the total profile between roughly 150 and 300 words so that every clause carries weight in the Stage 2 and Stage 3 prompts.
- **Collaborator readability**: Confirm that a colleague in your field reading the preview would immediately recognize your research focus.

If any proposed card distorts the preview, uncheck that card or edit the profile text manually.

## Limits

Keep the structural boundaries of the refinement flow in mind:

- **Requires a substantive baseline profile**: If your starting profile is a single vague sentence, atomic diffs cannot build a coherent structure on their own; draft a complete initial profile first (see [Writing a good profile](/using/writing-a-profile)).
- **Operates only on in-app feedback**: The refinement prompt sees only signals recorded inside Aparture (`star`, `dismiss`, `paper-comment`, `general-comment`, `filter-override`, scoped notes, and editor answers).
- **Remembers rejected diffs**: If you accept 3 of 5 proposed diffs, the 2 unchecked diffs are recorded as rejected and will not be re-offered automatically unless new feedback supports them; apply them manually in the editor if you later decide you want them.

## Next

Continue to [Review gates →](/using/review-gates) to decide which of the three interactive pause gates continue to provide clear value for your workflow as your profile matures.

Related guides:

- [**Tuning the pipeline**](/using/tuning-the-pipeline): How to adjust model slots, concurrency, batch sizes, and candidate caps.
- [**Giving feedback**](/using/giving-feedback): Complete reference for the seven feedback signals that feed this workflow.
- [**Reading a briefing → Generation provenance**](/using/reading-a-briefing#generation-provenance): How to inspect which profile snapshot produced an archived briefing.
