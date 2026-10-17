# Hallucination check: briefing audit

You are auditing a generated research briefing against its source material. Decide whether the briefing's claims about the papers are supported by the sources, or whether it contains hallucinations: invented findings, fabricated numbers, unsupported paraphrases, or claims that sound plausible but aren't in the sources.

Return a verdict, a one-paragraph justification, and a list of the specific claims you flagged.

## The briefing

{{briefing}}

## Source material (the papers the briefing was built from)

{{papers}}

## Which sources to trust

For each paper, the evidence is its abstract, which is the authors' own text, and its full report, which an earlier model pass wrote from the whole paper. These are the same sources the briefing's writer was told to ground per-paper claims in. The full report can contain its own errors: when it disagrees with the abstract, trust the abstract. A paper may also list its relevance score, the scoring justification, and the user's stars, dismissals, or comments. Those describe how the paper relates to the user, not what the paper says, so they can't support a factual claim about it.

## What counts as a hallucination

The briefing holds two kinds of sentence, and they meet different standards.

A **factual claim** says something specific about a paper: a number, a named method, dataset, or model, a comparative result ("outperforms X"), or a view attributed to the authors. Every factual claim must be supported by the source material of the paper it is about. This holds wherever the claim appears, including inside a sentence that connects several papers.

**Editorial synthesis** connects papers or judges them for this reader: the thread several papers share, a tension between them, or why a result matters given the user's profile. It needs no single source passage, as long as it contradicts none of the papers it cites and carries no unsupported factual claim.

**Definitely a hallucination (verdict YES):**

- A number about a paper that its source material does not contain (e.g., "Smith et al. achieved 94.3% accuracy" when the source says only "Smith et al. improved over the baseline")
- A methodology detail (e.g., "they used a transformer with 12 layers") that the source does not support
- An opinion, recommendation, or conclusion attributed to the authors that is not in the source
- A paper described with the wrong subject (wrong field, wrong dataset, wrong methodology) compared to the source
- A specific paper, author, or result from outside the input set that the source material does not mention
- Editorial synthesis that contradicts what one of its cited papers says

**Possibly a hallucination (verdict MAYBE):**

- A paraphrase that is loosely consistent with the source but goes beyond what it states
- A framing claim ("this paper is a major advance in ...") that the source doesn't quite support but doesn't contradict
- A claim about a paper's significance or reception that the source doesn't comment on

**Not a hallucination (verdict NO):**

- Direct quotes, close paraphrases, and faithful compressions of the source
- Editorial synthesis, as defined above, in the executive summary or a theme's argument
- Value judgments ("this matters for the user") based on the profile rather than on a specific claim about a paper

## Instructions

1. Read the briefing's executive summary, each theme's argument, and each paper's pitch and why-it-matters paragraph.
2. For each factual claim, find the supporting passage in that paper's source material.
3. Record each claim you can't support: the briefing excerpt, the arXiv ID of the paper it is about, and a short concern.
4. Assign an overall verdict:
   - **YES** if you found at least one item from the "Definitely" list
   - **MAYBE** if you found only items from the "Possibly" list, or couldn't tell whether a factual claim is supported
   - **NO** if every factual claim you checked is supported
5. Write a one-paragraph justification of the verdict.

Check every factual claim, so that NO means you looked and found support. Reserve YES for claims you can show are unsupported.

## Output schema

- `verdict`: "YES", "MAYBE", or "NO"
- `justification`: one paragraph explaining the verdict
- `flaggedClaims`: one entry per flagged claim, each with `excerpt` (the briefing text that is unsupported), `paperArxivId` (the paper it is about, or an empty string for a claim that spans papers), and `concern` (why it is flagged)

`flaggedClaims` is empty when the verdict is NO, and lists the specific items you found when the verdict is MAYBE or YES.
