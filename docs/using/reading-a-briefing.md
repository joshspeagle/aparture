# Reading a briefing

Once you've produced a briefing, the next question is how to work through it without grinding through every paper. This page walks through what you're looking at and how to read one efficiently.

A briefing is built around a single question: *which one or two papers should you actually open today, and which can you skip without worrying about it?* The layout is designed to answer that in a couple of minutes — if it ever feels like a long ranked list you're working through dutifully, something's wrong.

## What's on the page

From top to bottom, a briefing stacks like this:

```
  ┌────────────────────────────────────┐
  │  Executive summary                 │  200-400 word editorial lead
  ├────────────────────────────────────┤
  │  Theme 1                           │
  │    Argument (2-4 sentences)        │
  │     ├─ Paper card                  │
  │     ├─ Paper card                  │
  │     └─ Paper card                  │
  ├────────────────────────────────────┤
  │  Theme 2 … 5                       │
  ├────────────────────────────────────┤
  │  Hallucination audit               │  verdict + flagged claims
  │  Generation details ▸              │  provenance disclosure
  └────────────────────────────────────┘
```

### Executive summary

The editorial lead at the top — two to four paragraphs of serif prose. If you're short on time, reading just this is usually enough; the whole point of the section is to be skimmable in under two minutes.

The first paragraph carries the headline — what's the most notable thing in today's papers? If you starred papers in previous runs, those tend to anchor the framing. Middle paragraphs surface thematic clusters and the throughline between them, or say honestly that the day was scattered if it was. The final paragraph almost always lands on a reading recommendation along the lines of "*if you read one paper today, make it [arxivId] because…*" — the single sentence that does the most to direct your attention.

### Themes

Underneath come two to five themes, priority-ordered so the most important (containing your highest-scored and most-starred-adjacent papers) comes first. Each theme is a cluster of papers that share an argument, method, problem, or tension; every paper lands in exactly one theme, and no paper is left out.

A theme opens with a numbered heading deliberately written as an argument or observation rather than a category label (e.g. *"1. Interpretability converges on attention heads"*, not *"Interpretability papers"*). A short italic argument — two to four sentences — explains why the papers below belong together and what the takeaway is. Where papers within a theme are in tension or build on each other, the argument says so; debates live inside themes rather than in a separate section.

### Paper cards

Each theme contains one or more paper cards, and this is where individual papers get their actual treatment. A card gives you enough to decide whether to open the PDF:

| Part                | What it shows                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Score badge**     | A 0.0–10.0 relevance score (one decimal place), more brightly highlighted at 9+ — see [how scoring works](/concepts/pipeline#stage-3-score-abstracts) |
| **Title + arXiv ID** | Linked to the arXiv abstract page                                                                                        |
| **One-line pitch**  | A 15–25 word italic sell — closer to "what would this paper say if it were selling itself in one sentence" than a summary |
| **Why it matters**  | A 2–4 sentence paragraph grounded in your profile and your engagement history                                             |
| **Action buttons**  | `→ quick summary`, `→ full report`, `☆ star`, `⊘ dismiss`, `+ comment`                                                    |

The "why it matters" paragraph is where your own feedback loop becomes visible: starred papers get the richest treatment, dismissed ones get a short honest acknowledgement that they probably don't belong here, and everything else gets a relevance argument against your stated interests.

## Going deeper on a single paper

Paper cards are deliberately short — they help you triage, not replace reading. When a card catches your attention, there are two ways to go deeper without leaving the briefing.

**Quick summary** — click `→ quick summary` and an inline block expands directly beneath the card, showing a roughly 300-word compression of the paper's contribution, method, and result. These run through the `quickSummaryModel` slot (default `gemini-3.1-flash-lite`) in parallel during briefing synthesis. Click again to collapse.

**Full report** — click `→ full report` to open a side panel sliding in from the right (about 55% of the viewport). This shows the full per-paper technical report from Stage 4, usually around 700–1000 words of key findings, methodology notes, and limitations. Use it when you want to understand a paper deeply without opening the PDF itself. Close with `X` or by clicking outside the panel.

::: tip Expansions are free at read time
Both the quick summary and the full report are generated once during the pipeline run and cached. Clicking either costs nothing — no API calls, no waiting. Open them freely.
:::

## The two disclosure panels

Below the briefing body sit two affordances that are easy to miss but worth knowing about.

### Hallucination audit

After synthesis, Aparture runs a second independent LLM pass that audits the briefing's claims against the source papers. The result appears as a verdict pill with an optional "flagged claim(s) · click to view" disclosure:

| Verdict   | Pill  | Meaning                                                                                                                                  |
| --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **NO**    | Green | No hallucinations detected. Claims are supported by the source material. What you want to see most of the time.                          |
| **MAYBE** | Amber | Uncertain. Some claims could be reasonable inferences but the audit couldn't verify confidently. Worth a skim of the flagged list.       |
| **YES**   | Red   | Claims the audit couldn't find support for. Read the flagged list before trusting the briefing's prose.                                  |

If `briefingRetryOnYes` or `briefingRetryOnMaybe` is enabled in Settings (both default on), Aparture automatically retries synthesis with a hint about the failed audit. When that happens, the verdict pill shows "(after retry)" — the briefing you're reading is the second attempt, and the audit ran again on it.

The flagged-claims list shows each excerpt, the paper it's about (by arXiv ID), and what the auditor's concern was. At a glance you can usually tell whether a flag is a real hallucination or a paraphrase the auditor was too strict about.

::: warning When to worry
A YES verdict on a major claim in the executive summary is worth reading carefully — that's the part that shapes your reading decisions. A MAYBE verdict on a specific paper detail is usually fine. The underlying papers remain the ground truth; the briefing is a reading aid, not a source.
:::

### Generation provenance

Below the audit is a small collapsible link: **Generation details ▸**. Expanding it reveals everything that went into producing this particular briefing:

| Field                     | What it carries                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Profile snapshot**      | The exact profile text in effect when the briefing was generated (truncated at 200 chars, expandable)      |
| **Models**                | Model IDs used at each stage: filter, scoring, PDF analysis, briefing, quick summary                       |
| **Categories**            | arXiv categories selected for the run, as pill badges                                                      |
| **Filter verdicts**       | YES / MAYBE / NO counts from the quick-filter stage                                                        |
| **Settings flags**        | Whether pause gates and retry checks were on or off                                                        |
| **Hallucination audit**   | Full verdict, flagged claims, and the auditor's justification prose                                        |
| **Generated at**          | ISO timestamp                                                                                              |

You rarely need this on a fresh briefing. It comes into its own weeks later when you're looking at an archived briefing and want to reconstruct what setup produced it — which model was on the PDF slot that day, what your profile said at the time, whether the hallucination retry fired. Briefings are archived for 90 days in the sidebar; this panel is the permanent record of how each one was made.

## A five-minute reading flow

The whole layout is designed so you can get most of the value in a few minutes. The pattern that works well:

1. **Start with the executive summary.** If it surfaces a specific paper as "if you read one today, make it this", that's your primary target. If it says the day was thin, trust it and skip to theme 1's first card.
2. **Scan theme 1.** That's where your highest-scored and most-starred-adjacent papers land. Read pitches, and for anything that catches you, open the quick summary inline.
3. **If the quick summary still intrigues you, open the full report.** That's usually enough to commit to opening the PDF or to decide the paper isn't for you today.
4. **Star anything interesting you won't read now.** Stars are cheap and persist across runs — they're the main way the system learns what you actually care about. Err on the side of starring.
5. **Dismiss deliberately.** A dismiss tells the system "stop bringing me these", so use it when a paper is genuinely not what you want — not when you're just out of time today.
6. **Skip everything else.** That's the point. The layout is designed for triage, not completeness; working through every paper defeats the purpose.

Comments and the other feedback types live in the Feedback panel and the filter-review gate — see [Giving feedback](/using/giving-feedback) for what each control actually does to the next run.

## Next

[Giving feedback →](/using/giving-feedback) — the mechanics of stars, dismisses, comments, and filter overrides, and what each one actually does to the next run.

Also worth reading:

- You want the system view — how the briefing is built from prompts and schema. → [Briefing anatomy](/concepts/briefing-anatomy)
- You want to tune what the briefing prioritises — model choice, thresholds, batch sizes. → [Tuning the pipeline](/using/tuning-the-pipeline)
- The briefing keeps missing things you care about, or including things you don't. → [Writing a good profile](/using/writing-a-profile) and [Refining over time](/using/refining-over-time)
