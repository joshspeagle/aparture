# Deep read: one worker per selected paper

The deep read turns a paper into material an editor can write from: what it does, what it found, how far to trust it, and why this reader should care. Everything the briefing later says about the paper comes from this report, so the report has to be faithful to the paper and say where each claim came from.

## Instructions for a deep-read worker

You will receive the reader's profile (plus its selection notes), the paper's triage entry (score and one-line reason), and either:

- `<run>/papers/<id>.md` — the full text from arXiv's HTML rendering, with math as `$LaTeX$`, a figure list with captions, and appendices omitted; or
- `<run>/papers/<id>.pdf` — when arXiv has no HTML version. Read it with the Read tool, using the `pages` parameter for long papers (methods, results and conclusions matter most). Its figure list in `<run>/papers/<id>.json` comes from the PDF's captions (ids like `Figure 3`); `render` crops the one you pick out of the PDF, the same crop the app uses.

Read the paper properly: the introduction for the claim, the method for what was actually done, the results for what was actually shown, and the conclusion for what the authors think it means. Abstracts oversell; a report that only paraphrases the abstract has failed.

Your report is what the briefing writer works from, so imprecision here travels. State the scope of every result (which datasets, experiments or regimes it was measured on) and describe the method as the paper does, not as a simplified gloss: "a two-pass network" is not "one pass", and "one estimator per kind of block" is not "one estimator for all blocks".

Score the paper again with the rubric in `prompts/rubric-pdf.md` (Research Alignment × 0.5 + Paper Quality × 0.5, profile-aware quality calibration). Ignore that file's `{{...}}` placeholders and its output format; use the format below.

### Quotes are the audit trail

Several fields ask for a `quote`. A quote is a sentence or clause copied **character-for-character** from `<id>.md` (or from the PDF text when that is your source), long enough to be unambiguous (at least eight words) and short enough to be specific (one sentence). A validation script later checks every quote against the paper text and rejects the briefing if one doesn't match, so copy, don't retype or tidy. If you can't find a sentence that supports a claim, drop the claim.

### Output

Write `<run>/reports/<id>.json`:

```json
{
  "id": "2610.21205",
  "readFrom": "html",
  "score": 7.9,
  "alignment": 8.0,
  "quality": 7.5,
  "oneLine": "A plain statement of what the paper does, 25 words or fewer.",
  "summary": "Three to five paragraphs: the problem, the approach, the evidence, the conclusion. Separate paragraphs with \\n\\n.",
  "keyResult": {
    "claim": "The single most important finding, in your words.",
    "quote": "The sentence from the paper that states it, copied exactly."
  },
  "numbers": [
    {
      "value": "144,111",
      "meaning": "infrared spectra in the released dataset",
      "quote": "A verbatim sentence from the paper that contains this number."
    }
  ],
  "method": "One paragraph on what was actually done, at the level a researcher in an adjacent field would need.",
  "limitations": "One paragraph: what the authors acknowledge, and what they don't.",
  "skeptic": "The most important reason to doubt, qualify, or wait on the headline claim. One or two sentences. If the work is solid, say what would make it more convincing.",
  "relevance": "One paragraph tying the paper to specific lines of the reader's profile. Name the line.",
  "keyFigure": {
    "id": "S2.F1",
    "why": "One sentence on what this figure shows that the text alone doesn't."
  },
  "code": { "url": "https://github.com/…", "quote": "The sentence where the paper gives it." },
  "audience": "Who outside the reader's subfield would want this paper.",
  "readingMinutes": 35
}
```

Field rules:

- `numbers`: up to four that carry the paper's argument (sample sizes, accuracies, constraints with error bars). Each needs its own quote. Skip numbers that only matter inside the paper.
- `keyFigure`: pick from the figure list by `id`, or `null` when no figure helps (all-algorithm papers, pure theory). Prefer an overview diagram or the headline result over a detail panel.
- `code`: `null` unless the paper itself gives a repository or data link.
- `readingMinutes`: how long a careful read of the main text would take this reader, not a skim.

Reply with one line: the id, the new score, and the key result in ten words.
