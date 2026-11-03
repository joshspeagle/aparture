# Feedback in practice

The [Giving feedback](/using/giving-feedback) guide catalogs the seven feedback types and where each control lives in the interface. Putting those signals to work effectively requires matching the granularity of your reaction to the right mechanism, from single-click stars and dismissals up to scoped stage observations and profile diffs.

The examples below follow the **Focused: Bayesian cosmology** starter template; the same principles apply directly to any research domain.

## The loop, in one paragraph

Every profile change in Aparture is explicit and reviewable. Feedback events accumulate locally as you interact with runs and briefings; when you trigger **Suggest improvements**, the refinement model reads your accumulated events and proposes atomic profile diffs with written rationales that you accept or reject individually, and the next pipeline run reads the updated profile. Convergence therefore depends on both the specificity of the feedback you record and the editorial judgment you apply when reviewing proposed diffs (see [Turning feedback into profile edits](#turning-feedback-into-profile-edits)).

## Stars and dismissals: the one-click signals

Star and dismiss toggles appear on every paper card from Gate 2 onward, including inside rendered briefings. Because both controls store only the current toggle state per `arxivId`, you can change your mind without accumulating redundant history.

Reserve a **star** for papers meeting the threshold _"I would have opened this PDF directly from the daily arXiv listings"_:

- ✓ **Effective star**: Starring a paper that applies simulation-based inference to gravitational-wave population parameters confirms that the pipeline identified a core match to your profile.
- ✗ **Ineffective star**: Starring eight out of ten papers in a briefing because they are broadly on topic dilutes the positive contrast that the refinement model uses to distinguish core work from peripheral papers.

Reserve a **dismissal** for papers meeting the threshold _"this topic does not belong in my briefing"_:

- ✓ **Effective dismissal**: Dismissing a detector-characterization hardware paper that scored high on technical execution but involves no statistical inference marks an explicit profile boundary leak.
- ✗ **Ineffective dismissal**: Dismissing a relevant paper simply because you already read the preprint on Slack teaches the refinement flow to exclude a topic you actively follow, because the suggest step interprets dismissals as negative topical relevance.

## Paper comments: when a click can't carry the reason

Clicking the <span class="ui-action">+ comment</span> button on any paper card (or the 💬 button on a Gate 1 filter row) lets you explain _why_ a paper succeeded or missed. Paper-anchored comments carry the highest per-event weight in the refinement prompt because they separate methodological interest from incidental domain details:

> ✗ _"not relevant"_
>
> ✓ _"I care about hierarchical inference methods rather than this specific supernova dataset; the inference here uses standard off-the-shelf MCMC"_

While the first note provides no actionable distinction beyond a dismissal click, the second isolates the methodological requirement (novel hierarchical inference) from the observational domain, giving the refinement model a concrete distinction to encode in your profile.

Comments are equally valuable on starred papers to explain why an adjacent application transfers to your work:

> ✓ _"more of this: the likelihood-reweighting trick in §3 is the kind of methodological transfer I want to see even when the application is outside cosmology"_

Because paper comments accumulate as separate entries (with the 30 most recent included in each refinement call), a single specific comment carries more information than a week of silent one-click toggles.

## Gate 1 verdict overrides: correcting the filter

At Gate 1, clicking a different verdict pill moves the paper between buckets and logs a `filter-override` event, where <span class="verdict is-no">NO</span> → <span class="verdict is-yes">YES</span> indicates that the profile was too narrow and <span class="verdict is-yes">YES</span> → <span class="verdict is-no">NO</span> indicates that the profile was too broad:

- ✓ **Effective override**: When the filter assigns <span class="verdict is-no">NO</span> to a nested-sampling methodology paper because its abstract frames the problem around exoplanet transit timing, overriding to <span class="verdict is-yes">YES</span> both rescues the paper for scoring on the current run and teaches the refinement loop to retain statistical methods papers framed around neighboring astrophysical domains.
- ✗ **Ineffective override**: Manually overriding fifteen papers one by one when the entire <span class="verdict is-maybe">MAYBE</span> bucket suffers from the same systematic issue creates repetitive per-paper noise where a single bucket-level scoped note expresses the pattern directly.

The verdict pills remain active in the Pipeline view after a run finishes, allowing you to record post-run filter overrides for profile refinement without re-running the briefing.

Because a Gate 1 override is recorded as a permanent relevance correction for profile refinement, avoid overriding a <span class="verdict is-no">NO</span> verdict when you only want to read an off-topic paper out of one-time curiosity. Instead, star the paper at Gate 2 (score review), which guarantees a full-text PDF analysis for the current run without logging a filter-boundary correction.

## Scoped notes: when the pattern is bigger than a paper

Scoped notes attach free-text observations to a filter bucket, a scoring round, or an entire run so that you can state a batch-wide pattern in a single sentence:

- **Bucket notes** (Gate 1, `"+ feedback on this bucket"`):

> ✓ _"half the MAYBEs are ML-for-astronomy papers with no statistical content"_

- **Scoring-round notes** (Gate 2, `"feedback on this scoring round"`):

> ✓ _"survey and white papers keep scoring 7+ but I never read surveys"_

- **Run notes** (beneath the briefing):

> ✓ _"the executive summary keeps leading with the highest-scored paper even when the real theme is elsewhere"_

Conversely, avoid vague or mis-scoped notes:

- ✗ **Vague direction**: Writing _"scores seem off"_ leaves the refinement model unable to tell whether scores are inflated or compressed, or which topic cluster is affected.
- ✗ **Single-paper complaint in a run note**: Using a run-wide note to critique a single paper detaches the comment from that paper's abstract and metadata; attach the note directly to the paper card instead.

Because scoped notes use latest-wins replacement per `scope + briefingDate`, editing your note for a stage updates your current assessment of that scope rather than appending duplicate entries.

## General comments: stating intent directly

The <span class="ui-action">+ Add a comment</span> box in the Feedback panel records profile-level directions that are independent of any single paper or pipeline stage:

> ✓ _"I'm shifting toward field-level inference for large-scale structure for the next few months; weight LSS papers accordingly"_

The refinement prompt treats general comments as explicit author intent, making them the fastest way to steer your profile when you start a new project before paper-level stars and dismissals have accumulated.

- ✗ **Ineffective general comment**: Writing _"the third paper in theme two was bad"_ inside a general comment loses its referent once you run refinement days later; record paper-specific critiques on the paper card itself.

## Turning feedback into profile edits

Clicking **Suggest improvements** (on the Profile page or in the Feedback panel) translates your accumulated feedback into proposed profile and editorial-note diffs. As detailed in the [feedback volume guide](/using/giving-feedback#how-much-feedback-is-enough), accumulating roughly 10 to 30 events across a mix of clicks and written comments provides a solid basis for concrete edits.

![The Suggest profile improvements dialog displays accumulated feedback events with individual checkboxes selected.](/screenshots/suggest-dialog.png)

_The Suggest profile improvements dialog lists pending feedback events with checkboxes above the optional per-call guidance field._

Evaluate each proposed diff with the same care you would apply to revisions on a manuscript abstract:

- **Accept edits that capture a genuine multi-event pattern**: If you dismissed three detector-calibration papers and the proposed diff appends _"not instrumentation or calibration work"_, accept the change.
- **Reject edits that overfit a single paper**: Dismissing one neutrino-cosmology paper does not imply that you want to exclude neutrino cosmology altogether; reject an overly broad exclusion and leave a clarifying paper comment the next time a similar paper appears.
- **Treat a `"no clear change"` result as informative**: When pending feedback is sparse or internally contradictory, returning no diffs with a `noChangeReason` explanation prevents profile drift.

Accepted diffs update the active profile while archiving the prior version in your revision history. Rejected diffs are recorded so the refinement model avoids re-proposing the same edit on later calls unless new feedback supports it, and the feedback events behind rejected diffs remain pending.

## What improvement looks like

As your profile converges across several refinement cycles, improvements appear sequentially across the pipeline stages:

1. **Fewer verdict overrides at Gate 1**: Because the quick filter evaluates abstracts directly against your profile, tighter positive and negative scope boundaries reduce misclassified papers immediately.
2. **Fewer dismissals in the finished briefing**: Papers advancing to Stage 4 and Stage 5 consistently match your research areas.
3. **Well-calibrated borderline candidates at Gate 2**: Papers falling just below the top-N cutoff represent genuine boundary cases at the edge of your interests rather than unrelated subfields.
4. **Thematic synthesis aligned with your priorities**: The executive summary and Theme 1 cluster papers along the methodological distinctions that matter for your work.

Once the loop has converged, you will rarely need weekly profile edits, updating the profile mainly when your research agenda shifts to a new problem.

## Overfitting and under-feeding {#two-ways-this-goes-wrong}

**Overfitting**: Accepting every proposed negative exclusion can narrow your profile until it matches only papers identical to ones you have already starred, eliminating serendipitous discovery across adjacent fields. Preserve at least one explicit breadth statement in your profile (for example, _"I also want occasional exposure to major methodological results in neighboring areas"_) and reject suggested diffs that remove it, because the Stage 3 scoring rubric calibrates strictness directly against your profile's stated breadth.

**Under-feeding**: Although stars, dismissals, and overrides pass into the refinement prompt uncapped until incorporated, one-click signals carry no explanation of _why_ you reacted. If proposed diffs feel blunt or overly literal, adding one or two specific paper comments or scoped stage notes before re-running **Suggest improvements** provides the missing causal context.

## Related pages

- [Giving feedback](/using/giving-feedback): Complete reference for all seven feedback types and how they are stored.
- [Refining over time](/using/refining-over-time): Detailed walkthrough of the suggestion dialog, automatic proposals, and revision rollback.
- [Writing a good profile](/using/writing-a-profile): Guide to editing your profile prose and editorial notes directly.
