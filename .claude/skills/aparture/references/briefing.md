# The briefing

The briefing is a single morning reading document tailored to one researcher. It is designed to take under ten minutes to read, identify which one to three papers deserve a full read today, and explain enough of the remaining papers that the reader can skip the raw arXiv listings with confidence.

Read the "Style and voice" and "Sourcing discipline" sections of `prompts/synthesis.md` before writing. Those rules apply directly here: write in a clear, direct editorial register, ground every specific claim about a paper in its report, and avoid promotional terms such as `'novel'`, `'breakthrough'`, and `'paradigm-shift'`.

Apply the reader's writing notes as well (`node bin/aparture.mjs notes --state <state> --scope writing`), which record how this reader wants the briefing structured and phrased. Whenever a writing note conflicts with `profile.md`, `profile.md` takes precedence.

**Preserve scope qualifiers when compressing.** Audit failures in live briefings most often come from dropping experimental qualifiers during summarization rather than inventing facts outright (for example, stating a speedup measured on six of eight benchmarks as holding across all eight, broadening `"the robustness tests named in the main text"` to `"the robustness tests"`, or describing a block-specific network as shared across all blocks). Whenever a report specifies which datasets, experiments, blocks, or sections a result covers, retain that qualifier in the briefing or omit the claim. When a report's one-line summary and its method section disagree, follow the method section and verify against the full paper text.

## What each part is for

- **Headline** (`headline`, 12 words or fewer): State the day's central takeaway as a complete declarative sentence or substantive phrase (for example, `"Simulation-based inference scales to full-sky survey catalogs"` rather than `"SBI papers"`).
- **Lede** (`lede`, two or three short paragraphs): Explain what shifted across the day's submissions and how it connects to the reader's active work, naming the shared methodological thread or tension across the set. When the day's papers span unrelated topics without a single unifying theme, state that directly without forcing an artificial narrative, and save individual paper listings for the theme sections below.
- **Read first** (`readFirst`): Identify the single highest-priority paper to open today, paired with one sentence explaining why it takes priority for this reader.
- **Themes** (`themes`, one to four): Group papers that address a common problem, share a method, or take contrasting approaches to the same question. Each theme includes a two-to-four-sentence `argument` explaining how the grouped papers relate and what the reader should take away from the comparison, ordered by importance to the reader's profile.
- **Papers** (`papers`, one entry per deep-read paper): Assign each paper a reading `tier`:
  - `read` (one to three papers): Papers that merit a full read today and receive complete card coverage.
  - `skim`: Papers worth a five-minute look focused on the core result.
  - `radar`: Papers worth noting for awareness in a single sentence.

Each paper entry carries a `pitch` (15–25 words stating the paper's core contribution), `whyYou` (two or three sentences connecting the paper to a specific line of the reader's profile), `result` (the main finding paired with the verbatim `quote` from the report that supports it), `method` (one sentence), `caveat` (the methodological limitation from the report's skeptic field in one sentence), `figure` (an identifier from the report's `keyFigure`, or `null`), and `readingMinutes`.

The optional `because` field surfaces profile memory: when a paper was selected partly in response to past reader feedback, explain that link in one clause and list the supporting feedback identifiers in `becauseRefs` (arXiv IDs of starred or dismissed papers, or `"comment YYYY-MM-DD"`). Because the validator checks `becauseRefs` against `feedback.jsonl`, cite only recorded feedback events.

- **Also worth a look** (`nearMisses`): List the runner-up papers that fell just below the deep-read cutoff, with one sentence (20 words or fewer) per paper so the reader can see what was filtered out at the boundary.
- **Notes from the editor** (`notes`): Surface the feedback loop explicitly through its `learned`, `questions`, and `proposals` subfields:
  - `learned`: One or two sentences describing how recent accepted edits affected today's selection (for example, `"Because you dismissed three LLM-evaluation papers last week, benchmark papers now require a methodological contribution to make the reading set"`), or an empty string when nothing changed.
  - `questions` (zero to two): Short disambiguation questions with two to four selectable `options`, asked when today's papers expose an unaddressed boundary in the profile (such as a high-scoring paper in an adjacent subfield or a recurring pattern of dismissals). Ask specific scope questions (such as `"Do you want stellar-stream dynamics papers that do not use Gaia data?"`) rather than generic satisfaction polls.
  - `proposals` (zero to three): Concrete edits to `profile.md` or `learned.md` constructed via the procedure in `references/feedback.md`, each paired with its supporting evidence.

## Format

Write `<run>/briefing.json` with every required key present (using `null` or `[]` for optional values):

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

The deterministic validator enforces the following structural invariants:

- Every `papers[].id` belongs to the selected reading set, every `nearMisses[].id` is a triaged `YES` or `MAYBE` paper, and every identifier in `themes`, `readFirst`, and `becauseRefs` resolves.
- Every selected paper appears in at least one theme.
- Every `result.quote` matches the paper's full text verbatim after whitespace normalization, and every `figure.id` exists in that paper's extracted figure list.
- Every proposal's `anchor` string appears verbatim in its target file (`insert` places `content` immediately after `anchor`, `replace` substitutes `content` for `anchor`, and `delete` removes `anchor`).
- Every card's `title` matches the harvested arXiv title.

## Audit

Once deterministic validation passes, launch one checker worker with `briefing.json`, every `reports/<id>.json` file, the extracted paper texts, and `prompts/check-briefing.md` (applying its hallucination criteria and output schema while ignoring template placeholders). The worker writes `<run>/audit.json`:

- **Verdict `NO`:** Proceed directly to rendering and publication.
- **Verdict `MAYBE` or `YES`:** Revise or remove every flagged claim (removing an unsupported detail is preferable to hedging it), re-run deterministic validation, and run a second audit pass whenever the initial verdict was `YES` or more than three claims were flagged. Because a second pass often catches scope errors that survived the first edit, resume the same checker worker so it retains the paper texts in context and list which fields changed. Before running a new audit round, rename the existing `audit.json` to `audit-round<N>.json` (`1`, `2`, and so on) so `render` can report total claims flagged and revised across all rounds.

Cross-paper synthesis and thematic framing in the lede and theme arguments are core editorial functions, whereas unverified factual claims about an individual paper are always treated as hallucinations.
