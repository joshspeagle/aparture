# Giving feedback

Aparture adapts to your research priorities through explicit feedback signals that you record during and after pipeline runs. Stars, dismissals, paper comments, filter verdict overrides, general briefing comments, scoped stage observations, and answers to editor questions accumulate in a local feedback store. When you run the profile refinement flow, Aparture analyzes these accumulated events and proposes targeted diffs to your research profile and editorial notes for you to accept or reject individually.

Each feedback control appears at specific points in the interface, and its immediate effect depends on whether you record the signal before or after Stage 5 synthesis. For worked examples comparing effective and ineffective feedback on a concrete subfield, see [Feedback in practice](/using/feedback-in-practice); for the diff review dialog itself, see [Refining over time](/using/refining-over-time).

## The seven feedback types

<div class="landing-cards">

<div class="landing-card">

### ★ Star

Starring a paper marks it as high-priority work, with its immediate effect determined by the stage where you click it:

- **At Gate 2 (score review, before PDF analysis)**: Guarantees that the paper advances to Stage 4 full-text PDF analysis regardless of its abstract score, allowing you to pull borderline papers into the deep-read set.
- **At Gate 3 (pre-briefing) or on a rendered briefing**: Signals strong relevance so that Stage 5 synthesis gives the paper deeper coverage and anchors a theme around it.

Both actions record `star` events in the feedback store, and the refinement flow interprets each star in the context of the stage where it was recorded.

</div>

<div class="landing-card">

### ⊘ Dismiss

Dismissing a paper marks it as outside your research interests:

- **Before briefing synthesis**: Removes the paper from Stage 4 PDF analysis when clicked at Gate 2, or instructs the synthesis writer to deprioritize the paper when clicked at Gate 3.
- **On a rendered briefing**: Records a negative relevance signal indicating that your profile or filter boundaries are too permissive in that topic area.

</div>

<div class="landing-card">

### 💬 Paper comment

A paper comment attaches a free-text note to a single paper:

- **At Gate 1 (filter review)**: Clicking the 💬 button opens a comment box on the filter row while leaving the paper in its assigned bucket.
- **Before briefing synthesis**: The synthesis prompt receives your note alongside the paper and weaves your observation into its _why it matters_ paragraph.
- **On a rendered briefing**: Feeds the profile refinement flow as a paper-grounded explanation of what you valued or disliked.

</div>

<div class="landing-card">

### 💭 General comment

A general comment records profile-level guidance in the Feedback panel beneath a briefing:

- **Direct research intent**: Captures shifts in direction such as _"I'm shifting focus to Bayesian methods"_ or _"stop recommending vision-only papers"_.
- **Briefing-level reaction**: Reaches the refinement flow paired with the executive summary, theme titles, and pitches of the briefing you were viewing.
- **At Gate 3 (pre-briefing)**: Acts immediately as an editorial instruction for the current synthesis run (for example, _"Lead with the diffusion-models cluster"_) and is simultaneously saved as a general comment for future profile refinement.

</div>

<div class="landing-card">

### ⇄ Filter override

A filter override corrects the quick filter's verdict on a specific paper at Gate 1 or in the Pipeline view after a run finishes:

- **<span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span>**: Rescues the paper into scoring on the active run and signals to the refinement flow that your profile may be too narrow in that area.
- **<span class="verdict is-yes">YES</span> → <span class="verdict is-no">NO</span>**: Excludes the paper from scoring on the active run and signals that your profile may be too broad in that area.

</div>

<div class="landing-card">

### 📋 Scoped feedback

Scoped feedback attaches a free-text observation to a filter bucket, a scoring round, or an entire run:

- **bucket**: Records a pattern across a Gate 1 <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">NO</span> bucket (for example, _"the MAYBE bucket is full of tangential CV papers"_).
- **score-review**: Records an observation in the Gate 2 _"feedback on this scoring round"_ field about the score distribution or batch calibration.
- **run**: Records a run-wide observation beneath the briefing, distinct from a profile-level general comment.

Each scoped note is deduplicated by `scope + briefingDate` using latest-wins semantics, so entering a second `score-review` note on the same run replaces the first. In the refinement prompt, these notes appear under dedicated date-grouped headings so the model can act on run-level patterns.

</div>

<div class="landing-card">

### ✓ Answer

An answer records your response to one of the editor's clarification questions at the end of a briefing (see [Reading a briefing → Notes from the editor](/using/reading-a-briefing#notes-from-the-editor)):

- **Single-tap toggle**: Clicking an answer option records it immediately, clicking a different option replaces it, and clicking the active option clears your response.
- **Direct refinement evidence**: Reaches the refinement flow in a dedicated section alongside the question and the papers that prompted it.

</div>

</div>

All seven feedback types write to the same local feedback store, which the refinement flow reads when proposing profile and editorial-note updates.

## Where each one appears

### Paper cards carry star, dismiss, and comment buttons

Every paper card from Gate 2 onward includes <span class="ui-action">☆ star</span>, <span class="ui-action">⊘ dismiss</span>, and <span class="ui-action">+ comment</span> controls. These controls appear in both the Analysis Results list and the rendered briefing cards:

- **Analysis Results list (Pipeline view)**: As soon as Stage 4 PDF analysis finishes, every card in the results list is interactive, allowing you to mark stars, dismissals, and comments at Gate 3 before Stage 5 synthesis begins.
- **Paper cards inside a briefing**: The rendered briefing cards expose the same controls. Because the briefing prose has already been synthesized, marking papers while reading records signals for the next profile refinement pass.

![A briefing paper card displays its action row along the bottom with quick summary, full report, star, dismiss, and comment controls.](/screenshots/feedback-controls.png)

_The action row at the bottom of a briefing paper card (shown on dry-run output) pairs the cached quick-summary and full-report expansions with the star, dismiss, and comment feedback controls._

Briefing paper cards also display a link row directly beneath the title (**abstract · PDF · HTML · alphaXiv**) that opens the arXiv abstract page, the PDF, arXiv's HTML rendering when available, and the paper's alphaXiv page. Gate 1 filter rows instead display the three verdict pills alongside a <span class="ui-action">💬 add comment</span> button, because star and dismiss actions apply only from Gate 2 onward.

Clicking a star toggles its state between <span class="ui-action">☆ star</span> and <span class="ui-action">★ starred</span>, and clicking a second time removes the star; the dismiss button toggles in the same way. Clicking <span class="ui-action">+ comment</span> opens an inline text box labelled _"Your thoughts on this paper…"_ with Save and Cancel buttons.

### The filter-review gate carries override buttons

When the pipeline pauses at Gate 1, each paper row in the filter results displays clickable <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-no">NO</span> verdict pills. The filter model's assigned verdict appears filled while the other two options appear outlined. Clicking a different pill moves the paper to that bucket and adds a `⇄` indicator marking the change as a manual override.

Every override records a directional scope signal for profile refinement: overriding <span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span> indicates that your profile is too restrictive for that class of paper, whereas overriding <span class="verdict is-yes">YES</span> → <span class="verdict is-no">NO</span> indicates that your profile is too permissive, and <span class="verdict is-maybe">MAYBE</span> overrides mark boundary cases.

Clicking a different pill replaces any earlier override on that paper, and returning the paper to the filter's original verdict deletes the override event. While the pipeline is actively running Stages 3 through 5, the Gate 1 pills are locked; once the run finishes, the pills re-enable so you can log post-run filter corrections directly into the feedback store without re-running the briefing.

### The Feedback panel carries the general-comment input

Every briefing view includes a **Feedback** panel beneath the Generation details section (and above the Podcast card on the latest briefing). Near the top of the Feedback panel, the <span class="ui-action">+ Add a comment</span> button expands a text box labelled _"General comment on this week's briefing or your research interests…"_ for profile-wide notes.

General comments pass to the refinement flow paired with the summary metadata of the briefing you were viewing when you wrote them, allowing the model to interpret comparative feedback such as _"this week leaned too heavily on interpretability"_ against that run's actual themes and papers.

## How the different types behave

Stars, dismissals, and filter overrides behave as stateful toggles where only the final state per paper is active. If you star a paper, unstar it, and star it again, the refinement flow receives a single active star for that `arxivId`.

Paper comments and general comments are append-only entries. Adding a second comment on the same paper or briefing preserves both entries in chronological order so that evolving notes (such as _"interesting method"_ followed by _"but the evaluation is thin"_) both reach the refinement prompt.

Answers to editor questions and scoped feedback notes (`bucket`, `score-review`, and `run`) use latest-wins replacement per question or per `scope + briefingDate` key, ensuring that your most recent assessment of a stage or question supersedes earlier drafts from the same run.

::: tip Practical consequence
You can toggle stars, dismissals, and filter overrides freely because only their final state is sent to the refinement prompt. Write paper comments and general comments with specific rationales because each saved comment persists as an independent signal.
:::

### Feedback from test runs

Feedback recorded during a Dry Run or Minimal API Test, or on a test-mode briefing, is tagged automatically as test feedback. Because test runs use mock data or fixed verification papers, test feedback is isolated from production briefings and never enters the profile refinement prompt. The Feedback panel groups test events separately with a one-click clear action.

### Pending and incorporated

Every production feedback event has a status of either **pending** (not yet reflected in your profile) or **incorporated**. An event transitions to incorporated only when the refinement flow proposes a profile or editorial-note diff whose rationale cites that event and you accept that diff. Events that you uncheck before generating suggestions, events tied only to rejected diffs, and all events from a _"no clear change"_ round remain pending so that future refinement calls can combine them with newer signals. Reverting your profile to an earlier revision automatically returns any feedback incorporated since that revision back to pending status (see [Refining over time](/using/refining-over-time#which-feedback-counts-as-used)).

## Reviewing your feedback: the Feedback panel

The Feedback panel at the bottom of every briefing view combines pending-event counts with the Suggest button, a general-comment input, timeline filters, and the chronological event log.

### Counts and the Suggest button

The header bar of the Feedback panel displays the count of _not yet incorporated_ events, the _total_ event count, and (when non-zero) the count of events _from test runs_. Alongside these counters sits the <span class="ui-action">Suggest improvements →</span> button, which displays **Suggest improvements (N new) →** whenever `N` pending events are waiting to be processed. The identical button and counter appear on the Profile page beside the profile editor.

### The general comment input

Clicking <span class="ui-action">+ Add a comment</span> in the Feedback panel opens the text area for recording a general profile-level comment tied to the active briefing.

### Filters

The filter bar narrows the timeline by event type, incorporation status, and date range:

- **Type**: Filter by all types, stars, dismissals, comments, overrides, or scoped notes (`bucket`, `score-review`, and `run`).
- **Not yet incorporated**: Toggle to display only pending events.
- **Date range**: Filter to all time or the past 7, 14, or 30 days.

### The timeline

Below the filter bar, the chronological timeline lists feedback events from newest to oldest across up to three sections: **Not yet incorporated**, **Incorporated into your profile**, and **From test runs (N) · not used for suggestions** (collapsed by default, with <span class="ui-action">Show</span> and <span class="ui-action">Clear test feedback</span> controls).

Each timeline row shows the timestamp, the feedback type icon (`★`, `⊘`, `💬`, `💭`, `⇄`, `📋`, or `✓`), and either the paper title, score, and briefing date (for paper-scoped events) or the note text (for general and scoped events). Every row includes a <span class="ui-action">delete</span> action with a confirmation prompt, and text entries (`paper-comment`, `general-comment`, and scoped notes) also include an <span class="ui-action">edit</span> action. Editing an already-incorporated comment marks it _· edited_ and resets its status to pending so the updated wording is evaluated on the next refinement pass.

Scanning the timeline helps you review recent reactions and spot recurring relevance patterns across runs, such as repeatedly dismissing papers from a tangential subfield.

## How much feedback is enough?

Because the refinement flow synthesizes patterns across all seven feedback types, proposal quality depends on the total volume and diversity of pending events in the store rather than calendar time elapsed:

| Aggregate volume                    | What to expect from the refinement flow                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fewer than ~10 events total         | Insufficient signal for reliable edits; proposals are either broad or return a `"no clear change"` explanation.              |
| ~10–30 events across a mix of types | Sufficient signal for concrete, well-grounded profile diffs, particularly when several comments or scoped notes are present. |
| 30+ events including comments       | Rich signal allowing proposals to cite specific paper reactions and formulate targeted topic additions or exclusions.        |

A single active session containing a dozen filter overrides, several stars and dismissals, and two general comments provides enough signal to run refinement immediately, whereas two weeks of runs with only one or two clicks may still return `"no clear change"`. Mixing stars, dismissals, overrides, and explanatory comments gives the refinement model much clearer scope boundaries than one-click signals alone.

## Next

Continue to [Writing a good profile →](/using/writing-a-profile) to learn how to structure your profile prose so every pipeline stage can act on it directly.

Related guides:

- [**Refining over time**](/using/refining-over-time): How the suggestion dialog, automatic proposal rounds, and revision history work.
- [**Review gates**](/using/review-gates): How to use or disable the three interactive pause gates during a pipeline run.
