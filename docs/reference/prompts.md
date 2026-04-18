# Prompts

Every prompt Aparture sends to an LLM lives in one of two places. Knowing which is which is the difference between a 5-second tuning cycle and a 5-minute server-restart cycle.

## The two categories

**Hot-reloadable prompt files** live in `prompts/` as Markdown. Aparture re-reads them from disk on every API call, so edits take effect on the **next run** with no restart, no rebuild, and no deploy. This is the primary tuning surface.

**Embedded prompts** are string literals inside API route and library code. Changes require a **server restart** to take effect (the prompt is part of the compiled JS bundle at server start). These are the structural scoring pipelines and small repair/fix-up prompts — rarely tuned, kept in code deliberately.

## Hot-reloadable prompts (`prompts/*.md`)

Five files. All of them accept `{{placeholder}}` substitutions, rendered by the calling API route before dispatch.

| File                                     | What it controls                                                       | Placeholders                                                                                            | When it's called                                                                             | Sanity check                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `prompts/synthesis.md`                   | Main briefing generation — executive summary, themes, paper cards      | `{{profile}}`, `{{papers}}`, `{{history}}`                                                              | End of stage 5 via `/api/synthesize`                                                         | Generate a briefing; inspect theme titles, executive-summary tone, pitches              |
| `prompts/analyze-pdf-quick.md`           | ~300-word per-paper compression summary for the inline-expansion view  | `{{title}}`, `{{authors}}`, `{{arxivId}}`, `{{fullReport}}`, `{{abstract}}`, `{{scoringJustification}}` | Stage 5 quick-summary fan-out via `/api/analyze-pdf-quick` (also on-demand from paper cards) | POST to `/api/analyze-pdf-quick` with a paper; inspect word count + accuracy            |
| `prompts/check-briefing.md`              | Hallucination audit — flags unsupported claims in a generated briefing | `{{briefing}}`, `{{papers}}`                                                                            | Stage 5 after synthesis via `/api/check-briefing`                                            | Generate a briefing; verify flagged claims are real hallucinations, not false positives |
| `prompts/suggest-profile.md`             | Suggest Improvements — profile refinement from feedback events         | `{{profile}}`, `{{feedback}}`                                                                           | User clicks "Suggest Improvements" via `/api/suggest-profile`                                | Add varied feedback; click Suggest; check whether proposals feel on-target              |
| `prompts/notebooklm-discussion-guide.md` | NotebookLM podcast outline — themes/papers/duration-scaled depth       | `{{themes}}`, `{{papers}}`, `{{duration}}`, `{{date}}`                                                  | User clicks "Generate Podcast" via `/api/generate-notebooklm`                                | Generate a podcast; listen for theme balance + transition smoothness                    |

::: tip Changes land immediately
Edits to any file in `prompts/` land on the next API call that reads them. No rebuild, no restart, no deploy — just save the file and run the relevant flow. This is the fastest iteration loop in the codebase.
:::

## Embedded prompts (require server restart)

Eight locations. These are either structural scoring rubrics that shape the pipeline's numeric outputs (kept in JS because they're quality-sensitive and rarely tuned) or lightweight repair/fix-up prompts that fire only on validation failure.

| Location                                         | What it controls                                                                                      | When it runs                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pages/api/quick-filter.js` (lines ~52–94)       | Stage 2 quick-filter rubric — YES/MAYBE/NO heuristic + one-sentence justification                     | Every stage 2 batch call                                               |
| `pages/api/score-abstracts.js` (lines ~48–94)    | Stage 3 abstract-scoring rubric — 0–10 scale definitions, score-vs-relevance mapping                  | Every stage 3 batch call                                               |
| `pages/api/rescore-abstracts.js` (lines ~58–109) | Stage 3.5 comparative re-scoring — batch-consistency adjustment logic                                 | Every stage 3.5 batch when post-processing is enabled                  |
| `pages/api/analyze-pdf.js` (lines ~128–162)      | Stage 4 full-PDF analysis — structured summary + methodology + limitations + re-score                 | Every paper that reaches stage 4                                       |
| `lib/notebooklm/buildFocusPrompt.js`             | NotebookLM audio-customization focus prompt — duration-scaled theme/paper budgeting                   | Podcast generation; output written to `focus-prompt.txt` in the bundle |
| `lib/synthesis/repair.js` (lines ~44–59)         | Synthesis schema-error repair — asks the LLM to fix a validation failure without re-inferring content | Only when the initial synthesis output fails zod validation            |
| `pages/api/check-briefing.js` (lines ~110–121)   | Hallucination-check schema-error repair                                                               | Only when the initial check-briefing output fails validation           |
| `pages/api/suggest-profile.js` (lines ~45–56)    | Suggest-profile schema-error repair                                                                   | Only when the initial suggest-profile output fails validation          |

## What to tune for which quality knob

If you want to change a user-visible behaviour, here's which file to reach for.

**"The briefings don't feel editorial enough / themes are bland / pitches are weak."**
Edit `prompts/synthesis.md`. This is the largest lever in the entire system. Start by reading the full prompt — it's ~150 lines and very specific about what each field should sound like. Small edits (one extra bullet in the `onelinePitch` guidance, one extra example in the theme-title section) often have visible effects.

**"The podcasts drift off-topic / cover too many papers shallowly / feel rushed."**
Edit `prompts/notebooklm-discussion-guide.md`. This controls theme structure, pruning rules, and the conversation scaffolding NotebookLM reads. Duration-scaled depth (how many papers get deep-dives vs. brief mentions) is encoded here.

**"Suggest Improvements feels off-target / too aggressive / too conservative."**
Edit `prompts/suggest-profile.md`. This controls how the LLM interprets stars, dismissals, comments, and filter-overrides to propose profile edits. Changing the "what counts as a clear signal" language here changes what suggestions get surfaced.

**"The hallucination check flags too many false positives / misses real hallucinations."**
Edit `prompts/check-briefing.md`. Controls sensitivity and the categories of claims that get flagged. Pair this with the `briefingRetryOnYes` / `briefingRetryOnMaybe` settings in the UI, which decide what the pipeline does with the verdict.

**"Quick summaries are too long / too short / too dry."**
Edit `prompts/analyze-pdf-quick.md`. Controls compression ratio, tone, and whether to lead with findings or caveats.

**"The scoring doesn't match my research profile."**
This is **not a prompt-tuning problem** — it's a profile problem. Edit your profile (the big textarea in Your Profile panel) and use Suggest Improvements to refine it over time. The scoring prompts in `pages/api/score-abstracts.js` and `pages/api/quick-filter.js` describe the scoring rubric itself, not your criteria. You almost never want to change those.

## Why the scoring rubrics aren't hot-reloadable

The quick-filter, abstract-scoring, and re-scoring prompts are baked into JS function bodies rather than pulled from disk. This is deliberate:

- **Consistency across runs.** Scoring rubrics are quality-sensitive and affect every paper ever processed. Accidental edits from a local experiment would bleed into every briefing's provenance metadata.
- **They're rarely adjusted.** The rubrics define "what does a 7 mean vs. a 9" — once calibrated, changing them invalidates comparisons against past briefings.
- **Restart-cost is negligible.** Updating a scoring rubric is an intentional pipeline change, not a tuning cycle. A dev-server restart is the right UX for that frequency.

If you do need to change a scoring rubric, edit the prompt in its `pages/api/*.js` file, restart the dev server (`npm run dev`), and run a small test batch to verify the new scale produces calibrated output.

## Why repair prompts are embedded too

The three repair sites (`lib/synthesis/repair.js`, the repair blocks in `pages/api/check-briefing.js` and `pages/api/suggest-profile.js`) are minimal by design — a few lines asking the model to fix a specific validation error without re-inferring content. They're rarely tuned, they're context-specific (each one knows its own schema), and they're coupled to the validator code that produced the error. Keeping them co-located with the validator is clearer than splitting them into a separate prompt file.

If you need to tune how Aparture handles repair (e.g., repair more aggressively, give the model more context), the code change is small and the restart is cheap.

## One prompt is neither file nor string literal

`lib/notebooklm/buildFocusPrompt.js` is a function that **generates** the focus prompt from a duration input. It's not a static template — the number of themes, number of deep-dive papers, and number of brief mentions scale with how long you want the podcast to be. If you want to change how time budgets map to coverage depth, that's where to look.

## Next steps

- [Briefing anatomy →](/concepts/briefing-anatomy) — the system-view companion that quotes excerpts from `prompts/synthesis.md` section-by-section.
- [The pipeline →](/concepts/pipeline) — which prompt fires at which stage.
- [Tuning the pipeline →](/using/tuning-the-pipeline) — non-prompt settings (thresholds, batch sizes, review gates).
