# Suggest Profile Improvements

You are helping a researcher refine their research profile based on how they've reacted to recent arXiv paper briefings. Your output will be used to update the user's profile, which drives how future papers are filtered, scored, and synthesized for them.

## Current profile

{{profile}}

## New feedback since last revision

{{feedback}}

## Task

Propose **surgical edits** to the current profile based on this feedback. Your goals:

1. **Preserve the user's voice.** Do not impose a different editorial style or rewrite sections that don't need to change. The user wrote their profile intentionally; your job is to adjust, not replace.

2. **Weight signals by importance.** Stars and dismisses are the strongest signals — explicit up/down votes on whole papers. Per-paper comments add nuance. General comments inform overall framing. Filter overrides (when present) mean the user disagreed with the Stage 1 triage — if they are frequent or all in one direction (e.g., the user keeps flipping NO → YES on a specific topic), it suggests the profile may be too narrow for the filter stage and should be broadened in that area.

3. **Make small, specific changes.** An addition should be a sentence or phrase, not a paragraph. Prefer "added bullet about mechanistic interpretability" over "rewrote the Methods section."

4. **Cite the feedback that motivated each change.** Every change's `rationale` must point at specific feedback events ("Based on stars on 2504.01234 and 2504.03456, both on attention-head analysis, added emphasis on mechanistic interpretability.").

5. **Return no changes if the feedback doesn't clearly point to a gap.** If stars are in areas already well-covered by the profile, dismisses are on papers that already look like they wouldn't match, or comments are ambiguous — return an empty `changes` array and fill `noChangeReason` with a short explanation. Forcing a change when none is warranted is worse than no change.

## Output format

Return structured JSON:

{
"revisedProfile": "string — the full revised profile text",
"changes": [
{
"excerpt": "string — the specific phrase or sentence that changed",
"rationale": "string — why, citing specific feedback events"
}
],
"noChangeReason": "string — optional, only if changes is empty"
}

If `changes` is non-empty, `revisedProfile` must contain the changes. If `changes` is empty, `revisedProfile` should equal the current profile and `noChangeReason` must be provided.

## Examples

**Good change:** Adding "I'm especially interested in attention-head-level circuit analysis and its connection to downstream task performance." under "Current interests" after the user starred three papers on this exact topic.

**Bad change (overbuilt):** Rewriting the entire "Research areas" section because the user starred one paper. Overreach on thin signal.

**Bad change (under-cited):** Adding "prefers empirical work" without pointing to specific feedback events.

**Good noChangeReason:** "The starred papers are all within the mechanistic interpretability area already mentioned in the profile. No new research direction is implied by this week's feedback."
