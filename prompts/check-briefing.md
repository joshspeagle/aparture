# Hallucination check — briefing audit

You are auditing a generated research briefing against its source material. A previous model pass produced the briefing below from a corpus of arXiv paper abstracts, quick summaries, and full reports. Your job is to decide whether the briefing's claims about the papers are supported by the source material, or whether they contain hallucinations (invented findings, fabricated numbers, unsupported paraphrases, or claims that sound plausible but aren't actually in the provided sources).

You must return a structured verdict plus justification plus a list of specific flagged claims.

## The briefing

{{briefing}}

## Source material (the papers the briefing was built from)

{{papers}}

## What counts as a hallucination

**Definitely a hallucination (return verdict: YES):**

- A specific numerical claim about a paper that does not appear in that paper's source material (e.g., "Smith et al. achieved 94.3% accuracy" when the source says "Smith et al. improved over the baseline" with no number)
- A cited author opinion, recommendation, or conclusion that is not in the source
- A methodology detail (e.g., "they used a transformer with 12 layers") not supported by the source
- A cross-paper claim in a theme or debate argument that isn't supported by at least one of the cited papers
- A paper citation where the briefing describes the wrong subject (wrong field, wrong dataset, wrong methodology) compared to the source

**Possibly a hallucination (return verdict: MAYBE):**

- A paraphrase that is loosely consistent with the source but goes beyond what's explicitly stated
- A framing claim ("this paper is a major advance in ...") that the source doesn't quite support but isn't flatly contradicted
- A theme synthesis that is plausible given the papers but isn't directly grounded in specific source passages
- A claim about a paper's significance or reception that the source doesn't comment on

**Not a hallucination (return verdict: NO):**

- Direct quotes or close paraphrases of the source
- Framing statements in the executive summary that are supported by the themes and per-paper pitches
- Value judgments ("this matters for the user") that are based on the profile context, not on specific paper claims
- Minor rewording or compression of source text

## Instructions

1. Read the briefing's executive summary, each theme, each paper pitch, and any debate or longitudinal section.
2. For each specific claim about a paper, locate the relevant source material in the `papers` section.
3. Ask: is this claim grounded in the source, or is the model filling in plausible-sounding details?
4. Accumulate a list of flagged claims. For each one, note the briefing excerpt, the paper arxivId it's about, and a short concern.
5. Assign an overall verdict:
   - **YES** if you find one or more definite hallucinations (items from the "Definitely" list above)
   - **MAYBE** if you find only items from the "Possibly" list, or if you're uncertain about the support for some claims
   - **NO** if every claim you checked is grounded in the source material

6. Write a one-paragraph justification explaining your verdict.

## Output schema

Return structured JSON matching this shape:

```
{
  "verdict": "YES" | "MAYBE" | "NO",
  "justification": "string — one paragraph explaining the verdict",
  "flaggedClaims": [
    {
      "excerpt": "string — the briefing text that is unsupported",
      "paperArxivId": "string — which paper it is supposedly about, or empty string for cross-paper claims",
      "concern": "string — why it is flagged"
    }
  ]
}
```

If the verdict is NO, `flaggedClaims` should be an empty array. If the verdict is MAYBE or YES, `flaggedClaims` should contain the specific items you found.

Be strict but fair. False positives waste model calls on unnecessary retries. False negatives let hallucinations through. When uncertain, prefer MAYBE over YES.
