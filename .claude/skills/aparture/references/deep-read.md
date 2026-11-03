# Deep read: one worker per selected paper

The deep-read stage converts each selected paper into a structured technical report covering what the authors did, what they measured, where the limitations lie, and how the work connects to the reader's profile. Because every specific claim in the final briefing traces to this report, the report must represent the paper's scope accurately and pair key findings with verbatim source quotes.

## Instructions for a deep-read worker

You receive the reader's profile (including its selection notes), the paper's triage entry (score and one-line rationale), and one of two full-text formats:

- `<run>/papers/<id>.md`: The full paper text extracted from arXiv's HTML rendering, with math formatted as `$LaTeX$`, a figure list with captions, and appendices omitted.
- `<run>/papers/<id>.pdf`: Provided when arXiv has no HTML rendering for the paper. Read it with the Read tool, using the `pages` parameter on long manuscripts to focus on the introduction, methods, results, and conclusions. Its extracted figure list in `<run>/papers/<id>.json` comes from the PDF captions (using identifiers such as `Figure 3`), and `render` crops the selected figure directly from the PDF using the same cropping pipeline as the web application.

Read the introduction for the central claim, the methods section for the actual implementation, the results section for the empirical or theoretical evidence, and the conclusion for the authors' interpretation, because abstracts frequently overstate generality.

Because the briefing writer works directly from your report, preserve the exact scope of every finding (naming the specific datasets, experimental regimes, or assumptions) and describe the architecture or estimator accurately (for example, distinguishing a two-pass network from a single-pass network, or a per-block estimator from a global one).

Re-score the paper after reading the full text using the rubric in `prompts/rubric-pdf.md` (Research Alignment × 0.5 + Paper Quality × 0.5, with profile-aware quality calibration), ignoring that file's `{{...}}` placeholders and writing the JSON structure below.

### Quotes are the audit trail

Several output fields require a `quote` string copied **character-for-character** from `<id>.md` (or from the PDF text when reading from PDF). Each quote should be a single unambiguous sentence or clause of at least eight words. Because `node bin/aparture.mjs validate` checks every quote against the source text and rejects the briefing on any mismatch, copy the exact characters without retyping or editing punctuation. If you cannot locate a sentence in the paper that supports a claim, omit the claim.

### Output

Write `<run>/reports/<id>.json` using the following schema:

```json
{
  "id": "2610.21205",
  "readFrom": "html",
  "score": 7.9,
  "alignment": 8.0,
  "quality": 7.5,
  "oneLine": "A plain statement of what the paper does, 25 words or fewer.",
  "summary": "Three to five paragraphs covering the problem, the approach, the evidence, and the conclusion, separated by \\n\\n.",
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
  "limitations": "One paragraph covering what the authors acknowledge and what they leave unaddressed.",
  "skeptic": "The most important reason to doubt, qualify, or wait on the headline claim, in one or two sentences. If the work is solid, state what follow-up test would strengthen it further.",
  "relevance": "One paragraph tying the paper to specific lines of the reader's profile, naming the relevant line.",
  "keyFigure": {
    "id": "S2.F1",
    "why": "One sentence on what this figure shows that the text alone does not."
  },
  "code": { "url": "https://github.com/…", "quote": "The sentence where the paper gives it." },
  "audience": "Who outside the reader's subfield would want this paper.",
  "readingMinutes": 35
}
```

Apply these rules to the fields above:

- `numbers`: Include up to four quantitative values that carry the paper's core argument (such as sample sizes, benchmark accuracies, or parameter constraints with uncertainties), each paired with its own verbatim quote. Omit internal hyperparameter values that matter only inside the paper.
- `keyFigure`: Select a figure by its `id` from the paper's figure list, or set `null` when no figure adds clarity (such as purely theoretical or algorithmic papers). Prefer an architecture overview or headline result plot over a supplementary detail panel.
- `code`: Set to `null` unless the paper explicitly provides a code or data repository URL.
- `readingMinutes`: Estimate how many minutes a careful reading of the main text would take this reader.

Conclude your worker response with a single status line stating the arXiv ID, the updated score, and the key result in ten words or fewer.
