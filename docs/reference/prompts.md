# Prompts

Aparture's LLM prompts live in two places. The ones meant for tuning sit in `prompts/` as Markdown files and reload on every API call with no restart. The ones baked into route and library code — scoring rubrics, small repair templates — take effect only after a dev-server restart because they're compiled into the JS bundle at startup.

## The two categories

**Hot-reloadable prompt files** live in `prompts/` as Markdown files. Each API route reads its template from disk per request, substitutes its template variables, and dispatches. Edits land on the next call with no rebuild or deploy — this is the primary tuning surface.

**Embedded prompts** are string literals inside `pages/api/*.js` and `lib/**/*.js`. Most of them are scoring rubrics (Stage 2 and Stage 3) kept in code on purpose so the scale doesn't drift between briefings; the rest are short repair templates that fire only on schema validation failure. Tuning either requires editing the source file and restarting the dev server.

Template variables in the Markdown files use double-curly-brace syntax (the literal form in each file is `{` + `{variable}` + `}`). The tables below list variable names without the braces for readability.

## Hot-reloadable prompts (`prompts/*.md`)

Five files. Each renders its template variables at dispatch time from values the route passes in.

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

::: tip Changes land immediately
Edits to any file in `prompts/` take effect on the next API call that reads it. No rebuild, no restart — save the file, trigger the flow, look at the output.
:::

### Variable conventions

Variables are rendered as simple string substitution. A few are worth noting:

- `profile` is the exact profile text stored in `scoringCriteria` in your config. It's inserted verbatim, so the profile's formatting (headings, bullets, section breaks) carries through to the prompt.
- `papers` in `synthesis.md` and `check-briefing.md` is a JSON-serialised list of the per-paper objects — including titles, scores, quick summaries, full reports, and any stars/dismisses/comments attached to the paper.
- `feedback` in `suggest-profile.md` is a pre-formatted block built by `lib/profile/suggestPrompt.js` that groups events by type.
- `themes` and `papers` in `notebooklm-discussion-guide.md` carry only briefing-level information (theme arguments, paper indices, scores) — the prompt deliberately doesn't include full reports because those get uploaded to NotebookLM as separate source files.

## Embedded prompts (require server restart)

These are inline in the route or library code. Editing any of them means restarting `npm run dev` to see the change.

| Location                             | What it controls                                                                                                                                                                                                      | When it runs                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pages/api/quick-filter.js`          | Stage 2 quick-filter rubric — <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> verdict, one-sentence summary, one-sentence justification | Every Stage 2 batch call                                             |
| `pages/api/score-abstracts.js`       | Stage 3 abstract-scoring rubric — 0.0–10.0 scale, alignment × quality split, scoring guidance                                                                                                                         | Every Stage 3 batch call                                             |
| `pages/api/rescore-abstracts.js`     | Stage 3.5 post-processing pass — comparative re-scoring across a batch for consistency                                                                                                                                | Every post-processing batch when the stage is enabled                |
| `pages/api/analyze-pdf.js`           | Stage 4 full-PDF analysis — structured summary, key findings, methodology, limitations, updated score                                                                                                                 | Every paper that reaches Stage 4                                     |
| `lib/notebooklm/buildFocusPrompt.js` | Focus-prompt generator for NotebookLM — duration-scaled theme and paper budgets                                                                                                                                       | During podcast bundle generation; output lands in `focus-prompt.txt` |
| `lib/synthesis/repair.js`            | Synthesis schema-repair template                                                                                                                                                                                      | Only when `/api/synthesize` output fails zod validation              |
| `pages/api/check-briefing.js`        | Hallucination-check schema-repair template                                                                                                                                                                            | Only when `/api/check-briefing` output fails validation              |
| `pages/api/suggest-profile.js`       | Suggest-profile schema-repair template                                                                                                                                                                                | Only when `/api/suggest-profile` output fails validation             |

### Where the scoring rubric lives

The Stage 3 and Stage 4 scoring scale — what a 7 means versus a 9, the 50/50 blend of research alignment and paper quality — lives inline in `pages/api/score-abstracts.js` and `pages/api/analyze-pdf.js`, not in any `prompts/*.md` file. The `buildCachePrefix(scoringCriteria)` function in each route assembles the rubric by wrapping your profile text (the variable portion) in the rubric scaffolding (the stable portion). The stable portion is cached under Anthropic prompt caching when the model supports it.

The quick-filter rubric (Stage 2 — <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span>) follows the same pattern in `pages/api/quick-filter.js`, and the post-processing rubric (Stage 3.5) in `pages/api/rescore-abstracts.js`.

## What to tune for which quality knob

Match the symptom to a file.

**Briefings don't feel editorial enough. Themes read as category labels. Pitches are generic.** Edit `prompts/synthesis.md`. This is the largest lever in the system — a detailed prompt specifying what each field should sound like. Reading the whole prompt first is usually worth it; small edits (one more bullet in the pitch guidance, one extra example in the theme-title section) often have visible downstream effects.

**Quick summaries come out too long, too short, or too hedged.** Edit `prompts/analyze-pdf-quick.md`. Controls the compression ratio, the ordering (finding vs. caveats), and the voice.

**The hallucination audit fires too often or misses genuine issues.** Edit `prompts/check-briefing.md`. The prompt has explicit <span class="verdict is-no">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-yes">NO</span> categories describing what counts as each verdict (YES = hallucinations detected, NO = clean); adjusting those boundaries shifts sensitivity. Pair with the `briefingRetryOnYes` and `briefingRetryOnMaybe` checkboxes in Settings, which control what the pipeline does after the audit returns.

**The refinement flow proposes changes that feel off-target or too aggressive.** Edit `prompts/suggest-profile.md`. This is where the weighting across stars, dismisses, comments, and filter overrides is described, along with the "return no changes if signal is thin" guidance.

**Podcasts drift off-topic or cover too many papers shallowly.** Edit `prompts/notebooklm-discussion-guide.md` for the outline itself, or `lib/notebooklm/buildFocusPrompt.js` for the per-duration budget table NotebookLM receives in `focus-prompt.txt`.

**Scoring doesn't match your profile.** This is usually a profile problem, not a prompt problem. The scoring rubrics in `quick-filter.js`, `score-abstracts.js`, and `analyze-pdf.js` describe the 0–10 scale itself; they don't describe what's relevant to you. Edit your profile, then run the refinement flow. Only edit the rubric files if you want to recalibrate the scale — which invalidates score comparisons against older briefings.

## Why scoring rubrics aren't hot-reloadable

The filter, abstract-scoring, and re-scoring prompts sit in JS function bodies instead of `prompts/*.md`. This is deliberate:

- **Consistency across runs.** The rubric defines what a 7 means. Accidental edits during an experiment would bleed into every briefing's provenance metadata and make comparisons across dates meaningless.
- **Caching.** Each route splits its prompt into a stable prefix (rubric + profile) and a variable tail (the current batch of papers). Keeping the rubric in code lets the prefix be shaped for Anthropic prompt caching cleanly — `lib/llm/structured/anthropic.js` emits a `cache_control: {type: 'ephemeral'}` block on the prefix, and `read` tokens from cache hits land in the dispatcher's log line.
- **Low tuning frequency.** Scoring scales get calibrated once and rarely adjusted. A dev-server restart is the right cost for that cadence.

If you do need to change a scoring rubric, edit the `buildCachePrefix` function in the relevant route, restart with `npm run dev`, and run the Minimal API Test to confirm the new scale produces calibrated output before a full run.

## Why repair templates are embedded too

The three repair sites (`lib/synthesis/repair.js` and the `buildRepairPrompt` helpers in `pages/api/check-briefing.js` and `pages/api/suggest-profile.js`) are short by design — a few lines asking the model to fix a specific validation error without re-inferring content. Each one is coupled to the zod schema that produced the error, so keeping them next to the validator is clearer than splitting them into a prompt file.

Repair fires rarely. When it does, tuning it usually means adding context about the schema the first attempt failed — a code change with a cheap restart, not an iterate-and-observe loop.

## `buildFocusPrompt` is generated, not a template

`lib/notebooklm/buildFocusPrompt.js` is a function that builds the focus prompt from a duration input and writes the result to `focus-prompt.txt` in the podcast bundle. It's not a static template — the number of themes, the depth of coverage, and the paper budget scale with the podcast length. If you want to change how time budgets map to depth, that's the file to edit.

## See also

- [Briefing anatomy](/concepts/briefing-anatomy) — the companion page that quotes excerpts from `prompts/synthesis.md` section by section.
- [The pipeline](/concepts/pipeline) — which prompt fires at which stage.
- [Tuning the pipeline](/using/tuning-the-pipeline) — non-prompt settings (thresholds, batch sizes, review gates).
- [Troubleshooting](/reference/troubleshooting) — symptoms that trace back to prompt behaviour.
