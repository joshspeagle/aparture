# Triage: one pass over every harvested paper

Triage decides which of the day's papers deserve a full read. It runs as parallel workers, one per chunk of ~100–150 papers. Its two failure modes are asymmetric: a paper wrongly dropped here never reaches the reader, while a paper wrongly kept costs one deep read. So triage errs toward keeping borderline papers, and the deep read judges strictly.

## Instructions for a triage worker

You will receive the reader's profile, `learned.md`, a few recent feedback highlights, and one chunk file of papers (`## <arxivId>`, title, categories and authors, abstract).

The rubric is shared with the Aparture web app so the two stay consistent. Read these two files from the repository and apply their guidance, ignoring their `{{...}}` placeholders and their "respond only with a JSON array" output instructions (the output format below replaces them):

- `prompts/rubric-filter.md` — the YES / MAYBE / NO verdict rules. Prefer MAYBE over NO when the abstract is ambiguous.
- `prompts/rubric-scoring.md` — the 0–10 score: Research Alignment × 0.5 + Paper Quality × 0.5, with its profile-aware quality calibration. Apply it to YES and MAYBE papers only.

Treat `learned.md` as part of the profile. Treat feedback highlights as evidence of taste: a paper resembling recent stars leans up, one resembling recent dismissals leans down, but neither overrides what the profile says.

Ground every judgment in the abstract. Titles oversell; if the abstract doesn't support the title's claim, score the abstract.

Write `<run>/triage/<chunk-name>.json`:

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

Rules for the file:

- Every paper in your chunk appears exactly once, with its arXiv ID copied exactly.
- YES and MAYBE carry `score`, `alignment`, `quality` (one decimal), 2–4 `tags`, `summary`, and `why`.
- NO carries `score: null` and a `why` of twelve words or fewer. These reasons are how the reader can later ask "why did you skip X?", so make them specific.
- Use the whole scale. If most of your scores sit between 5 and 6, you are not discriminating.

Reply with one line: counts of YES / MAYBE / NO and the three highest-scoring IDs.

## Selection (done by the orchestrator, not the workers)

1. Pool all YES and MAYBE papers across chunks and sort by `score`.
2. Take the top `readCount` (default 12).
3. Promote, even from below the cut, any paper whose authors or text match a `watchlist` entry, and any paper that closely resembles two or more recent stars. Note the reason; the briefing will mention it.
4. Remove any paper the reader dismissed in an earlier run (check `feedback.jsonl`).
5. For a broad profile, check the topic spread using `tags`: if one subtopic holds more than half the set, swap its lowest-scoring member for the best paper from an unrepresented profile area, provided that paper scored within 1.0 of the cut.
6. The next 10–15 papers by score become `nearMisses`: each gets one line in the briefing so the reader sees what almost made it.

Write `<run>/selection.json`:

```json
{
  "read": [
    { "id": "2610.21205", "score": 8.1, "reason": "top score; ML spectroscopy for the ISM" }
  ],
  "nearMisses": [{ "id": "2610.21033", "score": 6.8, "summary": "…" }],
  "stats": { "harvested": 1020, "yes": 41, "maybe": 96, "no": 883 }
}
```
