# The briefing

The briefing is a morning newsletter written for one reader. It should take under ten minutes to read, leave the reader knowing which one to three papers to open today, and make the rest of the day's arXiv safe to ignore. A ranked list can't do that; an editor's argument can.

Read the "Style and voice" and "Sourcing discipline" sections of `prompts/synthesis.md` before writing. They apply here unchanged: write like a serious editor, ground every claim about a paper in its report, and avoid "novel", "breakthrough" and "paradigm-shift".

**Keep the qualifiers when you compress.** On the first live run, most of what the audit flagged was not invented; it was scope lost in shortening. A timing measured on six of eight benchmarks was stated for all eight. "The robustness tests named in the main text" became "the robustness tests". A network shared among blocks of one kind became one network for every block. When a report says which datasets, which experiments, which blocks or which sections a claim covers, the briefing says so too, or drops the claim. Where the report's one-line summary and its method section disagree, trust the method section, and check the paper text when it matters.

## What each part is for

**Headline** (`headline`, 12 words or fewer). The day's argument as a sentence, not a label. "Simulation-based inference stops being a toy" beats "SBI papers".

**Lede** (`lede`, two or three short paragraphs). What changed today and what it means for this reader's work. Name the thread and the tension. If the day is scattered, say so plainly; a scattered day honestly reported is still useful. Don't list papers here.

**Read first** (`readFirst`). The one paper to open if the reader opens one, with a single sentence on why. This is the most useful sentence in the issue.

**Themes** (`themes`, one to four). Each groups papers that share a problem, method, or disagreement, with a two-to-four sentence `argument` saying why they belong together and what the reader should take from the group. Order by importance to the reader. A day with one real theme gets one theme.

**Papers** (`papers`, one per deep-read paper), each with a reading `tier`:

- `read` (one to three): worth this reader's time today. Full treatment.
- `skim` : worth five minutes; the key result is the point.
- `radar`: worth knowing exists; one line is enough.

Each paper has a `pitch` (15–25 words: what the paper would say selling itself), `whyYou` (two or three sentences naming the profile line it serves), `result` (the key finding with the verbatim `quote` from the report that supports it), `method` (one sentence), `caveat` (the skeptic's note from the report, one sentence), `figure` (an id from the report's `keyFigure`, or null), and `readingMinutes`.

`because` is optional and only for memory: when a paper is here partly because of the reader's past feedback, say so in one clause and list the feedback in `becauseRefs` (arXiv IDs of the starred or dismissed papers, or the comment's date). The validator checks those refs against `feedback.jsonl`, so only claim what is there.

**Also worth a look** (`nearMisses`). The papers that almost made the reading set, one line each (20 words or fewer). This is what lets the reader trust that skipping the arXiv is safe.

**Notes from the editor** (`notes`): the feedback loop, made visible.

- `learned`: one or two sentences on what changed because of recent feedback ("Since you dismissed three LLM-evaluation papers last week, those now need a methods contribution to make the cut"). Empty when nothing changed.
- `questions` (zero to two): short questions whose answers would sharpen the profile, each with two to four tap-able `options`. Ask when today's papers exposed a real ambiguity: a high-scoring paper in an area the profile is silent on, or a recurring pattern of dismissals. "Do you want stellar-stream dynamics papers that don't involve Gaia data?" is a good question; "Did you like today's briefing?" is not.
- `proposals` (zero to three): concrete edits to `profile.md` or `learned.md`, built by the procedure in `references/feedback.md`, each with its evidence.

## Format

Write `<run>/briefing.json`. Every field shown is required; use `null` or `[]` where the text says optional.

```json
{
  "version": 2,
  "date": "2026-10-17",
  "headline": "string",
  "lede": "string (paragraphs separated by \\n\\n)",
  "readFirst": { "id": "2610.21205", "why": "string" },
  "themes": [{ "title": "string", "argument": "string", "paperIds": ["2610.21205"] }],
  "papers": [
    {
      "id": "2610.21205",
      "title": "string (exact title)",
      "authors": "First Author, Second Author et al.",
      "tier": "read",
      "score": 7.9,
      "pitch": "string",
      "whyYou": "string",
      "result": { "text": "string", "quote": "verbatim sentence from the paper" },
      "method": "string",
      "caveat": "string",
      "figure": { "id": "S2.F1", "caption": "short caption in your words" },
      "readingMinutes": 35,
      "because": null,
      "becauseRefs": []
    }
  ],
  "nearMisses": [{ "id": "2610.21033", "line": "string" }],
  "notes": {
    "learned": "",
    "questions": [{ "id": "q1", "text": "string", "options": ["Yes", "No", "Only with code"] }],
    "proposals": [
      {
        "id": "p1",
        "target": "profile",
        "edit": {
          "type": "insert",
          "anchor": "verbatim text in profile.md",
          "content": "new text"
        },
        "rationale": "string",
        "evidence": ["2610.21205", "comment 2026-10-15"]
      }
    ]
  }
}
```

Rules the validator enforces:

- Every `papers[].id` is in the reading set, every `nearMisses[].id` is a triaged YES or MAYBE paper, and every id in `themes`, `readFirst` and `becauseRefs` resolves.
- Every paper appears in at least one theme.
- Every `result.quote` appears verbatim (whitespace-normalized) in that paper's text, and every `figure.id` exists in its figure list.
- Every proposal's `anchor` appears verbatim in its target file (insert adds `content` right after the anchor; replace swaps the anchor for `content`; delete removes the anchor).
- `title` matches the arXiv title.

## Audit

After the validator passes, launch one checker worker with: `briefing.json`, every `reports/<id>.json`, the paper texts, and `prompts/check-briefing.md` (apply its definitions of hallucination; ignore its placeholders; return its output schema). It writes `<run>/audit.json`.

- Verdict `NO`: publish.
- `MAYBE` or `YES`: fix or delete every flagged claim (prefer deleting a specific over softening it), re-run the validator, and audit once more if the verdict was `YES` or more than three claims were flagged. One round is not exhaustive: on the first live run the second round found two errors the first had missed. Resume the same checker for the second round (it already has the papers in context) and tell it which fields changed. Before a new round, rename the previous `audit.json` to `audit-round<N>.json` (1, 2, ...) so the run keeps every round; `render` reports the claims flagged and revised across all of them. Record the outcome in the final report.

Cross-paper editorial framing in the lede and theme arguments is the briefing's job and is not a hallucination. Invented specifics about a single paper always are.
