You are drafting a **podcast outline** that NotebookLM will use alongside the briefing and per-paper reports to produce an expert-to-expert audio discussion. You are NOT writing the podcast script — you are building the structural backbone a host would lean on.

The briefing already contains the editorial arc and the papers already contain the technical substance. Your job is the narrative scaffolding and, critically, the **pruning decisions** — which themes to actually cover in the time budget and which papers make the cut.

## Output discipline

- Output ONLY the markdown outline. **Do not wrap it in a code fence** (no triple-backtick ` ```markdown ` block). Your response IS the file contents that will be uploaded to NotebookLM as a source.
- Reference papers using `[P#]` notation only. The numbering matches the briefing's paper order.
- DO NOT repeat paper abstracts or summaries — those live in separate sources.
- DO NOT invent papers, quotes, or methodology details not present in the inputs.
- Keep the outline short: 300-500 words total. It is an outline, not an essay.

## Pruning — the most important job

The input briefing may have 5+ themes and 20+ papers. The podcast has a fixed time budget. You MUST prune aggressively:

| Duration | Themes to cover | Must-cite papers (deep) | Notable mentions (brief) | Drop                |
| -------- | --------------- | ----------------------- | ------------------------ | ------------------- |
| 5 min    | 1               | 2-3                     | 0                        | everything else     |
| 10 min   | 2               | 3-5                     | 1-2                      | everything sub-7/10 |
| 15 min   | 2-3             | 4-6                     | 2-3                      | everything sub-7/10 |
| 20 min   | 3               | 5-7                     | 3                        | everything sub-7/10 |
| 30 min   | 3-4             | 6-9                     | 3-4                      | everything sub-5/10 |

**Selection rules:**

- Prefer themes with the highest-scoring papers and the strongest editorial argument in the briefing.
- Within a theme, prefer the top 2-3 papers by score. Don't force every theme paper into "must-cite".
- Papers that don't fit the selected themes but are high-scoring (≥8/10) can go in a short "Notable mentions" section at the end.
- If multiple themes overlap heavily, merge them into one act rather than spending time on both.

## Inputs

### Briefing themes

{{themes}}

### Papers (by index)

{{papers}}

### Target duration

{{duration}} minutes

## Output format

Emit exactly this structure (substituting the placeholders). The number of Acts must match the pruning table above for the target duration.

# Podcast Outline — {{date}}

## Opening (~30–60 seconds — content-first)

Hook: <one sentence, pulled from or inspired by the briefing's executive summary. A technical observation or argument, NOT a greeting or show introduction>
Setup: <one sentence of context — why today's papers matter, anchored in the hook>

_Note to the podcast model: the opening is a substantive hook, not a preamble. No "welcome back", no "today we're looking at", no format-setting. The first words are about the papers._

## Act 1 — <theme 1 title> (~X min)

Must-cite papers: [P#], [P#]
Core tension: <one sentence>
Conversation prompts:

- <prompt 1>
- <prompt 2>

## Act 2 — <theme 2 title> (~X min)

...

(Repeat for the Act count per the pruning table — NOT one per briefing theme.)

## Notable mentions (~X min, optional)

Brief nods to papers that didn't fit the main arc but deserve a sentence.

- [P#] "<title>" — <one-line reason to mention>

## Closing (~30–60 seconds)

Key takeaway: <one sentence>
Papers worth flagging for deep reading: [P#], [P#]
