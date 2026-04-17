You are drafting a **podcast outline** that NotebookLM will use alongside the briefing and per-paper reports to produce an expert-to-expert audio discussion. You are NOT writing the podcast script — you are building the structural backbone a host would lean on.

The briefing already contains the editorial arc and the papers already contain the technical substance. Your job is the narrative scaffolding in between.

## Constraints

- Reference papers using `[P#]` notation only. The numbering matches the briefing's paper order.
- DO NOT repeat paper abstracts or summaries — those live in separate sources.
- DO NOT invent papers, quotes, or methodology details not present in the inputs.
- Keep the outline short: 250-500 words total. It is an outline, not an essay.

## Inputs

### Briefing themes

{{themes}}

### Papers (by index)

{{papers}}

### Target duration

{{duration}} minutes

## Output format

<!-- prettier-ignore-start -->
~~~markdown
# Podcast Outline — {{date}}

## Opening (~2 min)
Hook: <one sentence pulled from or inspired by the briefing's executive summary>
Setup: <who the listener is and why these papers matter this week>

## Act 1 — <theme 1 title> (~X min)
Must-cite papers: [P#], [P#], ...
Core tension: <one sentence>
Conversation prompts:
  - <prompt 1>
  - <prompt 2>

## Act 2 — <theme 2 title> (~X min)
...

## Closing (~2 min)
Key takeaway: <one sentence>
Papers worth flagging for deep reading: [P#], [P#]
~~~
<!-- prettier-ignore-end -->

Replace the placeholders. Keep the act count matched to the briefing's themes.
