# Triage: one pass over every harvested paper

The triage stage evaluates every harvested abstract to determine which papers merit a full-text read, running across parallel workers that each process a chunk of roughly 100–150 papers. Because false negatives and false positives have asymmetric costs at this stage (a relevant paper dropped during triage never reaches the reader, whereas a borderline paper kept here costs only one deep-read slot), triage errs toward retaining borderline candidates as `MAYBE` and leaves strict filtering to the full-text deep read.

## Instructions for a triage worker

You receive the reader's research profile, the selection notes from `learned.md`, recent feedback highlights, and one chunk file of harvested papers (`## <arxivId>`, title, categories, authors, and abstract).

To keep triage aligned with the Aparture web application, read both rubric files below from the repository and apply their scoring criteria, ignoring their `{{...}}` template placeholders and closing schema line in favor of the chunk output format below:

- `prompts/rubric-filter.md`: Defines the `YES / MAYBE / NO` verdict rules; assign `MAYBE` whenever an abstract is ambiguous.
- `prompts/rubric-scoring.md`: Defines the 0–10 composite score `(Research Alignment × 0.5) + (Paper Quality × 0.5)` and its `profile-aware quality calibration`, applied to all `YES` and `MAYBE` papers.

Treat the selection notes as part of the profile (with `profile.md` taking precedence if the two ever conflict), and use recent feedback highlights as calibration signals: papers closely matching recent stars lean higher and papers matching recent dismissals lean lower, within the boundaries set by the profile.

Base every score and verdict strictly on the abstract text rather than an ambitious title.

Write `<run>/triage/<chunk-name>.json` in the following format:

```json
{
  "chunk": "chunk-01",
  "papers": [
    {
      "id": "2610.21033",
      "verdict": "YES",
      "score": 6.8,
      "alignment": 7.5,
      "quality": 6.0,
      "tags": ["differential privacy", "density estimation"],
      "summary": "One sentence on what the paper actually does.",
      "why": "One sentence tying the verdict to a specific line of the profile."
    },
    {
      "id": "2610.21040",
      "verdict": "NO",
      "score": null,
      "why": "Robot grasping benchmark; outside every profile area."
    }
  ]
}
```

Enforce these rules when writing the chunk file:

- Every paper in your input chunk appears exactly once with its exact arXiv ID.
- Every `YES` and `MAYBE` entry includes `score`, `alignment`, and `quality` (rounded to one decimal place), 2–4 topical `tags`, a one-sentence factual `summary`, and a one-sentence `why` linking the paper to a specific part of the profile.
- Every `NO` entry sets `score: null` and includes a specific `why` of twelve words or fewer so the orchestrator can answer reader questions about skipped papers.
- Spread scores across the full 0–10 scale rather than clustering every paper between 5 and 6.

Conclude your worker response with a single line reporting the counts of `YES / MAYBE / NO` verdicts and the three highest-scoring arXiv IDs in your chunk.

## Selection (orchestrator step)

1. Pool all `YES` and `MAYBE` papers across all chunk files and sort them in descending order by `score`.
2. Select the top `readCount` papers (default `12`).
3. Promote into the selected set any paper from below the cutoff whose authors or text match a `watchlist` entry, or that closely matches two or more recently starred papers, recording that promotion reason for the briefing.
4. Exclude any paper the reader dismissed in a previous run (`feedback.jsonl`).
5. For a multi-area profile, inspect the topical distribution across `tags`: if a single subtopic accounts for more than half of the selected set, replace its lowest-scoring member with the highest-scoring paper from an unrepresented profile area, provided that replacement paper scored within `1.0` point of the cutoff.
6. Record the next 10–15 highest-scoring papers as `nearMisses` so each receives a one-line summary in the briefing.

Write `<run>/selection.json` in the following format:

```json
{
  "read": [
    { "id": "2610.21205", "score": 8.1, "reason": "top score; ML spectroscopy for the ISM" }
  ],
  "nearMisses": [{ "id": "2610.21033", "score": 6.8, "summary": "…" }],
  "stats": { "harvested": 1020, "yes": 41, "maybe": 96, "no": 883 }
}
```
