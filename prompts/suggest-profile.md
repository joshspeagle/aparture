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

## Output granularity — ATOMIC, NON-OVERLAPPING CHANGES

Each entry in your `changes` array must be:

1. **Semantically atomic.** One logical edit per entry. If two improvements would affect the same sentence or clause, merge them into a single entry with a combined rationale.
2. **Non-overlapping with every other entry.** The text range each change modifies (identified by its `anchor`) must not overlap with any other change's anchor range. Sort your changes top-to-bottom by position in the profile to verify.
3. **Anchor-resolvable.** The `anchor` must appear **verbatim**, character-for-character, in the current profile. Do not paraphrase or normalize whitespace.

Edit types:

- `replace` — the `anchor` text is replaced wholesale by `content`.
- `insert` — `content` is inserted **immediately after** `anchor` (anchor itself is preserved).
- `delete` — the `anchor` text is removed. `content` should be empty.

Example of BAD (overlapping):

- Change 1: replace "I am interested in X and Y" with "I am interested in X, Y, and Z"
- Change 2: replace "interested in X and Y" with "interested in X and Y and Z"

Example of GOOD (merged):

- Single change: replace "I am interested in X and Y" with "I am interested in X, Y, and Z"

## Output format

Return structured JSON:

{
"changes": [
{
"id": "string — short stable identifier unique within this response (e.g. \"c1\", \"c2\")",
"rationale": "string — one sentence explaining why, citing specific feedback events",
"edit": {
"type": "replace" | "insert" | "delete",
"anchor": "string — verbatim substring of the current profile",
"content": "string — new text for replace/insert; empty string for delete"
}
}
],
"noChangeReason": "string — optional, only if changes is empty"
}

If `changes` is empty, `noChangeReason` must be provided.

## Examples

**Good change:** Adding "I'm especially interested in attention-head-level circuit analysis and its connection to downstream task performance." under "Current interests" after the user starred three papers on this exact topic.

**Bad change (overbuilt):** Rewriting the entire "Research areas" section because the user starred one paper. Overreach on thin signal.

**Bad change (under-cited):** Adding "prefers empirical work" without pointing to specific feedback events.

**Good noChangeReason:** "The starred papers are all within the mechanistic interpretability area already mentioned in the profile. No new research direction is implied by this week's feedback."
