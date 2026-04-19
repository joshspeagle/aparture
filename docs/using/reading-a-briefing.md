# Reading a briefing

Once you've produced a briefing, the question becomes how to read one efficiently. This page walks through what's on the page and a few patterns for working through it in a few minutes.

A briefing is built around a single practical question: which of the day's papers should you actually open, and which can you safely skip? The layout reflects that — an editorial lead at the top, a handful of thematic groupings below it, and per-paper cards inside each theme — all scaled so you can triage the day without reading every abstract.

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
  │  Generation details ▸              │  how this briefing was made
  └────────────────────────────────────┘
```

### Executive summary

The editorial lead at the top: two to four paragraphs of serif prose. It's the densest summary of the day in the briefing and often enough on its own if you're short on time.

The first paragraph carries the headline — what's the most notable thing in today's papers? If you starred any papers at Gate 2 (the pre-briefing review), those anchor the framing. Middle paragraphs surface thematic clusters and the throughline between them, or note that the day was scattered if it was. The final paragraph almost always lands on a reading recommendation along the lines of _"if you read one paper today, make it [arxivId] because…"_ — usually the clearest pointer in the whole briefing.

### Themes

Underneath come two to five themes, priority-ordered so the most important one — the one carrying your highest-scored and most-starred papers — comes first. Each theme is a cluster of papers that share an argument, method, problem, or tension; every paper lands in exactly one theme, and no paper is left out.

A theme opens with a numbered heading deliberately written as an argument or observation rather than a category label (e.g. _"1. Interpretability converges on attention heads"_, not _"Interpretability papers"_). A short italic argument — two to four sentences — explains why the papers below belong together and what the takeaway is. Where papers within a theme are in tension or build on each other, the argument says so; debates live inside themes rather than in a separate section.

### Paper cards

Each theme contains one or more paper cards. This is where individual papers are summarised — a card gives you enough to decide whether to open the PDF:

| Part                 | What it shows                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Score badge**      | A 0.0–10.0 relevance score (one decimal place), more brightly highlighted at 9+ — see [how scoring works](/concepts/pipeline#stage-3-score-abstracts)                                                                   |
| **Title + arXiv ID** | Linked to the arXiv abstract page                                                                                                                                                                                       |
| **One-line pitch**   | A 15–25 word italic sell — closer to "what would this paper say if it were selling itself in one sentence" than a summary                                                                                               |
| **Why it matters**   | A 2–4 sentence paragraph grounded in your profile and your prior engagement with this paper                                                                                                                             |
| **Action buttons**   | <span class="ui-action">→ quick summary</span>, <span class="ui-action">→ full report</span>, <span class="ui-action">☆ star</span>, <span class="ui-action">⊘ dismiss</span>, <span class="ui-action">+ comment</span> |

The "why it matters" paragraph is where your feedback shapes the output most visibly. Papers you starred at Gate 2 (before synthesis ran) get more extensive treatment; dismissed ones get a brief note acknowledging why they still showed up; everything else gets a short argument tied to your stated interests.

## Going deeper on a single paper

Paper cards are short by design — they're a triage tool, not a replacement for reading. When one catches your attention, there are two ways to go deeper without leaving the briefing.

**Quick summary** — click <span class="ui-action">→ quick summary</span> and an inline block expands beneath the card, showing a roughly 300-word compression of the paper's contribution, method, and result. These run through the `quickSummaryModel` slot (default `gemini-3.1-flash-lite`) in parallel during briefing synthesis. Click again to collapse.

**Full report** — click <span class="ui-action">→ full report</span> to open a side panel that slides in from the right and covers roughly the right half of the window. This shows the full per-paper technical report from Stage 4, usually around 700–1000 words of key findings, methodology notes, and limitations. Use it when you want to understand a paper deeply without opening the PDF itself. Close with the `X` button or by clicking outside the panel.

::: tip Expansions are free at read time
Both the quick summary and the full report are generated once during the pipeline run and cached. Opening either costs nothing — no API calls, no waiting — so there's no reason to hesitate before clicking.
:::

## Two smaller panels underneath

Below the briefing body sit two small sections that are easy to miss but worth opening at least once.

### Hallucination audit

After synthesis, Aparture runs a second independent LLM pass that audits the briefing's claims against the source papers. The result appears as a verdict badge, with an optional "flagged claim(s) · click to view" link that expands a list of what the auditor questioned:

| Verdict                                     | Meaning                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| <span class="verdict is-yes">NO</span>      | No hallucinations detected. Claims are supported by the source material. What you want to see most of the time.                    |
| <span class="verdict is-maybe">MAYBE</span> | Uncertain. Some claims could be reasonable inferences but the audit couldn't verify confidently. Worth a skim of the flagged list. |
| <span class="verdict is-no">YES</span>      | Claims the audit couldn't find support for. Read the flagged list before trusting the briefing's prose.                            |

If `briefingRetryOnYes` or `briefingRetryOnMaybe` is enabled in Settings (both default on), Aparture automatically retries synthesis with a hint about the failed audit. When that happens, the verdict badge shows "(after retry)" — the briefing you're reading is the second attempt, and the audit ran again on it.

The flagged-claims list shows each excerpt, the paper it's about (by arXiv ID), and what the auditor's concern was. Skimming a flag usually tells you whether it's a genuine hallucination or a paraphrase the auditor was unusually strict about.

::: warning When to worry
A <span class="verdict is-no">YES</span> verdict on a major claim in the executive summary is worth reading carefully — that's the part that shapes your reading decisions. A <span class="verdict is-maybe">MAYBE</span> on a specific paper detail is usually fine. The underlying papers remain the ground truth; the briefing is a reading aid, not a source.
:::

### Generation provenance

Below the audit is a small expandable link: <span class="ui-action">Generation details ▸</span>. Clicking it reveals everything that went into producing this particular briefing:

| Field                   | What it carries                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile snapshot**    | The exact profile text in effect when the briefing was generated (truncated at 200 chars, expandable)                                                            |
| **Models**              | Model IDs used at each stage: filter, scoring, PDF analysis, briefing, quick summary                                                                             |
| **Categories**          | arXiv categories selected for the run, as small badges                                                                                                           |
| **Filter verdicts**     | <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> counts from the quick-filter stage |
| **Settings flags**      | Whether pause gates and retry checks were on or off                                                                                                              |
| **Hallucination audit** | Full verdict, flagged claims, and the auditor's justification prose                                                                                              |
| **Generated at**        | ISO timestamp                                                                                                                                                    |

You rarely need this on a fresh briefing. It matters weeks later, when you come back to an archived briefing and want to reconstruct what setup produced it — which model was on the PDF slot that day, what your profile said at the time, whether the hallucination retry fired. Briefings are archived for 90 days in the sidebar, and this panel is the permanent record of how each one was made.

## A five-minute reading flow

The layout is designed for a few-minute read, not a completionist pass. A pattern that works:

1. **Start with the executive summary.** If it surfaces a specific paper as "if you read one today, make it this", that's your primary target. If it says the day was thin, trust it and skip to theme 1's first card.
2. **Scan theme 1.** That's where the highest-scored papers land, and any papers you pre-starred at Gate 2 have been woven into its framing. Read pitches; for anything that catches you, open the quick summary inline.
3. **If the quick summary holds up, open the full report.** The deeper detail is usually enough to decide whether to open the PDF or move on.
4. **Star anything interesting you won't read now.** Stars are tied to the paper by arXiv ID and persist across runs, but in practice they don't retroactively change the briefing you're reading (that's already been synthesised) and arXiv papers rarely reappear in later runs. Their real job is to accumulate as signal for the refinement flow, which is how feedback on this briefing eventually shapes future ones.
5. **Dismiss deliberately.** A dismiss tells the system "stop bringing me these", so use it when a paper is genuinely not a fit — not when you're just out of time today.
6. **Skip the rest.** Working through every paper isn't the intended use — triage is.

::: info Feedback you give here is the same feedback you give at Gate 2
Stars, dismisses, and comments are all keyed per paper, not per run. The same controls appear on the pre-briefing review gate (Gate 2) and on the paper cards in the briefing itself — the difference is just timing relative to synthesis. Feedback given at Gate 2 shapes the briefing that's about to be written; feedback given while reading mainly accumulates as signal for the refinement flow, which is the actual path by which today's feedback shapes tomorrow's briefings (via a refined profile). [Giving feedback](/using/giving-feedback) covers the full mechanics.
:::

## Next

[Giving feedback →](/using/giving-feedback) — the mechanics of stars, dismisses, comments, and filter overrides, and what each one actually does to the next run.

Also worth reading:

- You want the system view — how the briefing is built from prompts and schema. → [Briefing anatomy](/concepts/briefing-anatomy)
- You want to tune what the briefing prioritises — model choice, thresholds, batch sizes. → [Tuning the pipeline](/using/tuning-the-pipeline)
- The briefing keeps missing things you care about, or including things you don't. → [Writing a good profile](/using/writing-a-profile) and [Refining over time](/using/refining-over-time)
