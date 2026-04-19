# Briefing anatomy

A tour of the briefing from the inside — what each section is, what prompt instruction produces it, and the hard constraints the synthesis LLM must honour.

::: info System view, not reading view
This page is the **system view** of the briefing: what produces each part and why. For the **reading view** — what to look for, how to act on stars and dismissals, how to use the inline expansions — see [Reading a briefing](/using/reading-a-briefing) instead.
:::

## Three sections, nothing more

Despite the visual density of a finished briefing, the synthesis LLM only produces three things: an executive summary, a list of themes, and one card per paper. Everything else on the page — the quick-summary expansion, the full-report side panel, the "Generation details" disclosure — is rendered from data generated elsewhere in the pipeline, not from the synthesis call.

Keeping the synthesis contract narrow keeps the LLM's job narrow: produce editorial prose against a small, well-defined shape, and stop.

## Section 1: the executive summary

The editorial lead for the day. The first prose the user reads. Two to four paragraphs, usually 200–400 words.

The synthesis prompt gives the model a three-paragraph template rather than a word count, because the structure is where most of the value lives. From `prompts/synthesis.md`:

> The editorial lead for the day. This is the first thing the user reads, so it should frame the day's papers as a story rather than a list.
>
> **First paragraph:** the headline. What is the single most important thing the user should know from today's papers? Name the thread, name the tension, name what changed. If the user starred papers, those should anchor the framing. Do not list papers by name here — that is the rest of the briefing's job.
>
> **Subsequent paragraphs:** step back and set up the thematic structure. What clusters emerged? What is the throughline that connects otherwise separate papers? If the day is scattered across unrelated topics, say so honestly — not every day has a unified narrative.
>
> **Final paragraph:** a clear reading recommendation. "If you read one paper today, make it [arxivId] because…" This is the most actionable sentence in the briefing.

Rendered as a prose block directly after the briefing header.

## Section 2: themes

The organising spine of the briefing. Two to five priority-ordered groupings, each with a headline, a paragraph of editorial reasoning, and a list of paper references. Every paper must appear in at least one theme.

From `prompts/synthesis.md`:

> Themes are the organizing spine of the briefing. Each theme groups papers that share an argument, method, problem, or tension — and explains why the grouping matters.
>
> Themes should be **priority-ordered**: the most important theme (containing the highest-scored and starred papers) comes first.
>
> Each theme has:
>
> - `title`: a short headline (6–12 words) that reads as an argument or observation, not a label. Good: "Interpretability converges on attention heads." Bad: "Interpretability papers."
> - `argument`: a 2–4 sentence paragraph explaining why these papers belong together and what the user should take away. This is editorial writing, not a section header. If papers within the theme are in tension or build on each other, say so here — **debates belong inside themes, not in a separate section.**
> - `paperIds`: the arxivIds of the papers in this theme. Every paper in `papers` should appear in at least one theme.

The last bullet reflects a design choice worth surfacing. Prior versions of Aparture had separate components for explicitly marked tensions and over-time observations. Those were removed in favour of handling those cases **inside a theme's argument**, where they're naturally grounded in the papers being grouped. A theme that contains two papers disagreeing about the same phenomenon will usually produce better prose when the disagreement is argued through in the theme's own paragraph than when it's lifted out into its own UI block.

Each theme renders as a numbered section with an argument-style title, an italicised argument paragraph, and the paper cards for its papers. Themes appear in the priority order the LLM returned.

## Section 3: papers

One interactive card per paper that made it into the final round. Carries the paper's arXiv ID, title, final relevance score, a one-line pitch, and a paragraph explaining why it matters for the user specifically.

The card's text is produced by the synthesis LLM, but the controls on the card (star, dismiss, comment, expansion buttons) are wired to external state. That split — static text from the model, dynamic state from React — is why paper cards look identical in the briefing view and the Analysis Results list even though the data behind them is different.

From `prompts/synthesis.md`:

> Each paper card has:
>
> - `arxivId`: the paper's arXiv identifier (must match one from the input list)
> - `title`: the full paper title
> - `score`: the relevance score from the input data
> - `onelinePitch`: a 15–25 word pitch that captures the paper's argument or contribution. Not a summary — a pitch. What would this paper say if it were selling itself in one sentence?
> - `whyMatters`: a 2–4 sentence paragraph grounded in the user's profile and engagement signals.
>   - For **starred** papers: give the richest treatment. Reference the user's stated interests by name. Explain what makes this paper worth the user's time.
>   - For **high-score papers without engagement**: recommend clearly, grounded in profile alignment.
>   - For **medium-score papers**: be honest about the relevance. "This is adjacent to your work on X, but the core contribution is in Y."
>   - For **dismissed** papers: keep brief. Acknowledge the dismissal and explain only if there is a genuine reason to include it despite the user's signal.
>   - When **comments** exist: integrate them. The user's own words should shape your framing.

Each card renders inside its parent theme with a colour-coded score badge (brightened at 9+), the title as a link to the arXiv page, the italicised one-line pitch, the "why it matters" paragraph, and action buttons for quick summary, full report, star, dismiss, and comment.

## Everything else on the page

Three features look like they're part of the briefing but come from elsewhere in the pipeline. They exist because they're useful for reading and for provenance, but they don't need to be part of the synthesis LLM's output.

### Quick summaries

~300-word per-paper summaries, generated in parallel during Stage 5 of the pipeline. Render as an inline bordered block directly below each paper card when the user clicks the quick-summary button.

### Full reports

The verbatim deep-analysis text produced by Stage 4 (PDF analysis). Render as a right-side panel triggered by the full-report button on any paper card.

### Generation metadata

Everything you see in the expandable "Generation details" section below the briefing:

- Profile snapshot at generation time
- Model IDs for every stage (`filterModel`, `scoringModel`, `pdfModel`, `briefingModel`, `quickSummaryModel`)
- Categories selected for the run
- Filter verdict counts
- Retry policy flags (`briefingRetryOnYes`, `briefingRetryOnMaybe`)
- **Hallucination audit result** — verdict (<span class="verdict is-yes">NO</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">YES</span>), justification, list of flagged claims, and whether a retry was triggered
- Generation timestamp

This data is attached to the saved briefing entry separately from the briefing object itself, so new provenance fields can be added over time without changing the synthesis contract.

## Hard constraints (from the prompt)

A few invariants the synthesis LLM must honour. If any fail, validation rejects the briefing and a repair pass runs.

> - Every `arxivId` you emit in `papers` or `themes.paperIds` must be from the input list.
> - `executiveSummary` is required and must be non-empty.
> - `themes` is required and must contain at least one theme.
> - `papers` is required and must contain one entry per final-round paper from the input list.
> - Do not emit any field not defined in the schema.

And the sourcing discipline the prompt enforces separately:

> - Every claim you make about a specific paper must be grounded in that paper's abstract, quickSummary, or fullReport as provided in the input. Do not invent findings, methodology details, author opinions, numbers, or conclusions that are not explicitly supported by the source material.
> - If you are uncertain whether a claim is supported, omit it rather than state it. The briefing is better short and accurate than long and embellished.
> - Cross-paper claims in `themes.argument` must be supported by content in at least two of the cited papers.

Those constraints are a big part of why Aparture's briefings are worth trusting — the prompt is explicit about not inventing, and the hallucination audit (run as a separate LLM pass after synthesis) exists to catch the cases where the model does it anyway.

## Where to tune what

- **Change how the briefing is structured or written.** Edit `prompts/synthesis.md`. This prompt is the biggest quality lever in the system — changes take effect on the next briefing with no rebuild. See [Prompts](/reference/prompts).
- **Change how it looks.** Edit `styles/briefing.css`. Palette tokens (`--aparture-*`) are referenced by class name in the components, so colour changes propagate without touching any JavaScript.
- **Change the hallucination audit's sensitivity.** Edit `prompts/check-briefing.md`. Also hot-reloadable.

## Next

[Reading a briefing →](/using/reading-a-briefing) — the UX view: how to work through a briefing as a researcher.

Also worth reading:

- [**The pipeline**](/concepts/pipeline) — how papers become the inputs the synthesis prompt sees.
- [**Prompts**](/reference/prompts) — every hot-reloadable prompt file, with sanity-check recipes.
