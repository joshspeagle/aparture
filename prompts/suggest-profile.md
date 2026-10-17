# Suggest Profile Improvements

You are helping a researcher refine their research profile based on how they've reacted to recent arXiv paper briefings. Your output will be used to update the user's profile, which drives how future papers are filtered, scored, and synthesized for them.

## Current profile

{{profile}}

## New feedback since last revision

{{feedback}}

## Task

Propose **surgical edits** to the current profile based on this feedback. Your goals:

1. **Preserve the user's voice.** Do not impose a different editorial style or rewrite sections that don't need to change. The user wrote their profile intentionally; your job is to adjust, not replace.

2. **Weight signals by section.**
   - **Stars and dismisses** are explicit up and down votes on whole papers: strong, direct signal.
   - **Per-paper comments** add nuance to those votes.
   - **Filter overrides** mean the user disagreed with the quick filter (Stage 2). When they are frequent or all in one direction (for example, the user keeps flipping NO → YES on one topic), the profile is probably too narrow for the filter in that area and should be broadened there. When an override appears with comments inline, treat the comments as the rationale for that verdict change.
   - **Bucket-level observations** describe aggregate filter behavior in one bucket (YES, MAYBE, or NO). Use them to adjust how broad or specific the criteria are in that direction.
   - **Score-review notes** are calibration concerns about scoring. Use them to adjust strictness or scoring criteria.
   - **Run-level observations** describe pipeline behavior at scale (filter aggressiveness, subcategory mix, scoring distribution). Use them as background for the changes you propose.
   - **General comments** are editorial reactions to specific briefings. Use them to adjust framing and synthesis preferences. When the briefing a comment was written against is shown beneath it, read the comment against that briefing, not in isolation.

   **If a USER GUIDANCE block appears at the top of this prompt, it is the highest-priority signal.** Let it shape the direction and emphasis of your proposed edits, and use the feedback events to ground concrete, cited changes that implement it.

3. **Make small, specific changes.** An addition should be a sentence or phrase, not a paragraph. Prefer "added bullet about mechanistic interpretability" over "rewrote the Methods section."

4. **Cite the feedback that motivated each change.** Every change's `rationale` must point at specific feedback events ("Based on stars on 2504.01234 and 2504.03456, both on attention-head analysis, added emphasis on mechanistic interpretability.").

5. **Return no changes if the feedback doesn't clearly point to a gap.** If stars are in areas the profile already covers well, dismisses are on papers that already look like they wouldn't match, or comments are ambiguous, return an empty `changes` list and explain why in `noChangeReason`. Forcing a change when none is warranted is worse than no change.

## Output granularity: atomic, non-overlapping changes

Each entry in your `changes` list must be:

1. **Semantically atomic.** One logical edit per entry. If two improvements would affect the same sentence or clause, merge them into a single entry with a combined rationale.
2. **Non-overlapping with every other entry.** The text range each change modifies (identified by its `anchor`) must not overlap with any other change's anchor range. Sort your changes top-to-bottom by position in the profile to verify.
3. **Anchor-resolvable.** The `anchor` must appear **verbatim**, character-for-character, in the current profile. Do not paraphrase or normalize whitespace.

Edit types:

- `replace`: the `anchor` text is replaced wholesale by `content`.
- `insert`: `content` is inserted **immediately after** `anchor` (the anchor itself is preserved).
- `delete`: the `anchor` text is removed, and `content` is empty.

Example of BAD (overlapping):

- Change 1: replace "I am interested in X and Y" with "I am interested in X, Y, and Z"
- Change 2: replace "interested in X and Y" with "interested in X and Y and Z"

Example of GOOD (merged):

- Single change: replace "I am interested in X and Y" with "I am interested in X, Y, and Z"

## Output fields

- `changes`: the list of proposed edits, each with:
  - `id`: a short identifier, unique within this response (e.g. "c1", "c2")
  - `rationale`: one sentence explaining why, citing specific feedback events
  - `edit`: the edit itself, with `type` (`replace`, `insert`, or `delete`), `anchor` (a verbatim substring of the current profile), and `content` (the new text for `replace` or `insert`; empty for `delete`)
- `noChangeReason`: null unless `changes` is empty; when it is empty, a short explanation of why the feedback doesn't call for an edit

## Examples

**Good change:** Adding "I'm especially interested in attention-head-level circuit analysis and its connection to downstream task performance." under "Current interests" after the user starred three papers on this exact topic.

**Bad change (overbuilt):** Rewriting the entire "Research areas" section because the user starred one paper. Overreach on thin signal.

**Bad change (under-cited):** Adding "prefers empirical work" without pointing to specific feedback events.

**Good noChangeReason:** "The starred papers are all within the mechanistic interpretability area already mentioned in the profile. No new research direction is implied by this week's feedback."
