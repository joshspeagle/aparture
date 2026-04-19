# Prompts

Aparture's LLM prompts live in two places. The ones meant for tuning sit in `prompts/` as Markdown files and reload on every API call with no restart — this is where the main briefing prompt, the scoring rubrics, and the hallucination audit all live. A smaller set stays embedded in source code, because the content is either too short (repair templates) or too programmatic (the podcast focus-prompt builder).

## The two categories

**Hot-reloadable prompt files** live in `prompts/` as Markdown files. Each API route reads its template from disk per request, substitutes its template variables, and dispatches. Edits land on the next call with no rebuild or deploy — this is the primary tuning surface.

**Embedded prompts** are string literals inside `lib/**/*.js` and a few `pages/api/*.js` routes. They're short and rarely tuned — editing any of them means restarting `npm run dev` to see the change.

Template variables in the Markdown files use double-curly-brace syntax (the literal form in each file is `{` + `{variable}` + `}`). The sections below list variable names without the braces for readability.

## Hot-reloadable prompts (`prompts/*.md`)

Nine files. Each renders its template variables at dispatch time from values the route passes in.

### `prompts/synthesis.md`

Main briefing generation — executive summary, themes, paper cards. Fires after PDF analysis via `/api/synthesize`.

**Variables:** `profile`, `papers`

### `prompts/analyze-pdf-quick.md`

~300-word per-paper compression used for the inline expansion view. Fires in parallel during briefing prep via `/api/analyze-pdf-quick`, once per paper.

**Variables:** `title`, `authors`, `arxivId`, `fullReport`, `abstract`, `scoringJustification`

### `prompts/check-briefing.md`

Hallucination audit — flags unsupported claims in a generated briefing. Fires after synthesis via `/api/check-briefing`.

**Variables:** `briefing`, `papers`

### `prompts/suggest-profile.md`

Profile refinement proposals from accumulated feedback. Fires when the user clicks Suggest improvements via `/api/suggest-profile`.

**Variables:** `profile`, `feedback`

### `prompts/notebooklm-discussion-guide.md`

Podcast outline for NotebookLM — themes, pruning, duration-scaled depth. Fires when the user clicks Generate podcast via `/api/generate-notebooklm`.

**Variables:** `themes`, `papers`, `duration`, `date`

### `prompts/rubric-filter.md`

Stage 2 quick-filter rubric — <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> verdict, one-sentence summary, one-sentence justification. Fires every filter batch via `/api/quick-filter`.

**Variables:** `profile`, `papers`

### `prompts/rubric-scoring.md`

Stage 3 abstract-scoring rubric — 0.0–10.0 scale, alignment × quality split, scoring guidance. Fires every scoring batch via `/api/score-abstracts`.

**Variables:** `profile`, `papers`

### `prompts/rubric-rescoring.md`

Stage 3.5 post-processing pass — comparative re-scoring across a batch for consistency. Fires every post-processing batch when the stage is enabled, via `/api/rescore-abstracts`.

**Variables:** `profile`, `papers`

### `prompts/rubric-pdf.md`

Stage 4 full-PDF analysis — structured summary, key findings, methodology, limitations, updated score. Fires for every paper that reaches Stage 4, via `/api/analyze-pdf`.

**Variables:** `profile`, `originalScore`

::: tip Changes land immediately
Edits to any file in `prompts/` take effect on the next API call that reads it. No rebuild, no restart — save the file, trigger the flow, look at the output.
:::

### Variable conventions

Variables are rendered as simple string substitution. A few are worth noting:

- `profile` is the exact profile text stored in `scoringCriteria` in your config. It's inserted verbatim, so the profile's formatting (headings, bullets, section breaks) carries through to the prompt.
- `papers` in `synthesis.md` and `check-briefing.md` is a JSON-serialised list of the per-paper objects — including titles, scores, quick summaries, full reports, and any stars/dismisses/comments attached to the paper.
- `feedback` in `suggest-profile.md` is a pre-formatted block built by `lib/profile/suggestPrompt.js` that groups events by type.
- `themes` and `papers` in `notebooklm-discussion-guide.md` carry only briefing-level information (theme arguments, paper indices, scores) — the prompt deliberately doesn't include full reports because those get uploaded to NotebookLM as separate source files.

### The cache-boundary marker

The four `rubric-*.md` files contain a single `{{CACHE_BOUNDARY}}` line that splits each file into the stable prefix (rubric scaffolding + your profile) and the variable tail (the batch of papers). `lib/llm/loadRubricPrompt.js` reads the file, substitutes the variables, and returns both halves so the Anthropic prompt-cache block can be placed on the stable portion only. The split point is invisible to the LLM — the two halves concatenate with no separator — but it's the reason edits to the rubric prose above the marker are cache-aware while edits below the marker are per-batch variable content.

Keep the marker as a single `{{CACHE_BOUNDARY}}` line with blank lines before and after. Removing it will raise a load error on the next call.

## Embedded prompts (require server restart)

A smaller set of prompts still lives in the source code. Each is either too short or too programmatic to move cleanly to a template file.

| Location                             | What it controls                                                                | When it runs                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `lib/notebooklm/buildFocusPrompt.js` | Focus-prompt generator for NotebookLM — duration-scaled theme and paper budgets | During podcast bundle generation; output lands in `focus-prompt.txt` |
| `lib/synthesis/repair.js`            | Synthesis schema-repair template                                                | Only when `/api/synthesize` output fails zod validation              |
| `pages/api/check-briefing.js`        | Hallucination-check schema-repair template                                      | Only when `/api/check-briefing` output fails validation              |
| `pages/api/suggest-profile.js`       | Suggest-profile schema-repair template                                          | Only when `/api/suggest-profile` output fails validation             |

The focus-prompt builder is a JavaScript function that computes paper and theme budgets from the podcast duration (not a static template). The three repair templates are short and tightly coupled to the zod schema they're repairing — moving them to files would gain nothing since they're only rarely tuned.

## What to tune for which quality knob

Match the symptom to a file.

**Briefings don't feel editorial enough. Themes read as category labels. Pitches are generic.** Edit `prompts/synthesis.md`. This is the largest lever in the system — a detailed prompt specifying what each field should sound like. Reading the whole prompt first is usually worth it; small edits (one more bullet in the pitch guidance, one extra example in the theme-title section) often have visible downstream effects.

**Quick summaries come out too long, too short, or too hedged.** Edit `prompts/analyze-pdf-quick.md`. Controls the compression ratio, the ordering (finding vs. caveats), and the voice.

**The hallucination audit fires too often or misses genuine issues.** Edit `prompts/check-briefing.md`. The prompt has explicit <span class="verdict is-no">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-yes">NO</span> categories describing what counts as each verdict (YES = hallucinations detected, NO = clean); adjusting those boundaries shifts sensitivity. Pair with the `briefingRetryOnYes` and `briefingRetryOnMaybe` checkboxes in Settings, which control what the pipeline does after the audit returns.

**The refinement flow proposes changes that feel off-target or too aggressive.** Edit `prompts/suggest-profile.md`. This is where the weighting across stars, dismisses, comments, and filter overrides is described, along with the "return no changes if signal is thin" guidance.

**Podcasts drift off-topic or cover too many papers shallowly.** Edit `prompts/notebooklm-discussion-guide.md` for the outline itself, or `lib/notebooklm/buildFocusPrompt.js` for the per-duration budget table NotebookLM receives in `focus-prompt.txt`.

**Scoring doesn't match your profile.** This is usually a profile problem, not a prompt problem. The scoring rubrics in `prompts/rubric-filter.md`, `rubric-scoring.md`, and `rubric-pdf.md` describe the 0–10 scale itself; they don't describe what's relevant to you. Edit your profile, then run the refinement flow. Only edit the rubric files if you want to recalibrate the scale — which invalidates score comparisons against older briefings.

::: warning Editing scoring rubrics is a breaking change
The rubric defines what a 7 means versus a 9. Edits change the score distribution of every subsequent briefing, which invalidates cross-date comparisons. Generation metadata captures the prompt filename but not its contents, so an old briefing with "score 8.2" and a new briefing with "score 8.2" aren't automatically comparable if the rubric changed in between. Treat rubric edits as calibration events worth noting separately.
:::

## See also

- [Briefing anatomy](/concepts/briefing-anatomy) — the companion page that quotes excerpts from `prompts/synthesis.md` section by section.
- [The pipeline](/concepts/pipeline) — which prompt fires at which stage.
- [Tuning the pipeline](/using/tuning-the-pipeline) — non-prompt settings (thresholds, batch sizes, review gates).
- [Troubleshooting](/reference/troubleshooting) — symptoms that trace back to prompt behaviour.
