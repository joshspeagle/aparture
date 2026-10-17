You are drafting a **podcast outline** that Gemini Notebook will use alongside the briefing and per-paper reports to produce an expert-to-expert audio discussion. You are not writing the podcast script. You are building the structural backbone a host would lean on.

The briefing already contains the editorial arc and the papers already contain the technical substance. Your job is the narrative scaffolding and the **pruning decisions**: which themes to cover in the time budget and which papers make the cut.

## Output discipline

- Output only the markdown outline, without a code fence around it (no triple-backtick ` ```markdown ` block). Your response is the file that will be uploaded to the notebook as a source.
- Reference papers using `[P#]` notation only. The numbering matches the briefing's paper order.
- Don't repeat paper abstracts or summaries; those live in separate sources.
- Don't invent papers, quotes, or methodology details that aren't in the inputs.
- Avoid promotional adjectives such as "novel," "breakthrough," and "paradigm-shift": name what changed instead. The hosts tend to repeat the outline's wording.
- Keep the outline short: 300-500 words total. It is an outline, not an essay.

## Pruning

The input briefing may have 5+ themes and 20+ papers. The podcast has a fixed time budget, so prune hard:

| Length                  | Themes to cover | Must-cite papers (deep) | Notable mentions (brief) | Drop                |
| ----------------------- | --------------- | ----------------------- | ------------------------ | ------------------- |
| Short (5–8 minutes)     | 1-2             | 2-3                     | 0-1                      | everything sub-8/10 |
| Default (10–15 minutes) | 2-3             | 4-6                     | 2-3                      | everything sub-7/10 |
| Long (20–30 minutes)    | 3-4             | 6-9                     | 3-4                      | everything sub-5/10 |

**Selection rules:**

- Prefer themes with the highest-scoring papers and the strongest editorial argument in the briefing.
- Within a theme, prefer the top 2-3 papers by score. Don't force every theme paper into "must-cite".
- Papers that don't fit the selected themes but are high-scoring (≥8/10) can go in a short "Notable mentions" section at the end.
- If multiple themes overlap heavily, merge them into one act rather than spending time on both.
- Within each theme you cover, always keep the paper the briefing places first, even if its score is below the cutoff. The briefing has already weighed engagement signals (stars, comments), so its editorial choices are the signal, not the raw score. The theme count in the table still wins: this rule decides which papers stay inside a theme you cover, not how many themes you cover.

## Inputs

### Briefing themes

{{themes}}

### Papers (by index)

{{papers}}

### Target length

{{length}}

## Output format

Emit exactly this structure (substituting the placeholders). The number of Acts must match the pruning table above for the target length.

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

(Repeat for the Act count in the pruning table, not once per briefing theme.)

## Notable mentions (~X min, optional)

Brief nods to papers that didn't fit the main arc but deserve a sentence.

- [P#] "<title>" — <one-line reason to mention>

## Closing (~30–60 seconds)

Key takeaway: <one sentence>
Papers worth flagging for deep reading: [P#], [P#]
