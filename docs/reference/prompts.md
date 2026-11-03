# Prompts

Aparture stores its LLM prompts in two locations according to how they are used: editable prompt templates live in `prompts/*.md` and reload from disk on every API request without restarting the server, while short schema-repair templates and programmatic prompt builders live in JavaScript modules under `lib/` and `pages/api/`.

## Prompt storage locations

- **Hot-reloadable prompt files** live in `prompts/` as Markdown files. Each API route reads its template from disk on every request, substitutes its template variables, and dispatches the call, making `prompts/*.md` the primary surface for tuning scoring and synthesis behavior.
- **Embedded prompts** are string templates and functions inside `lib/**/*.js` and `pages/api/*.js` routes. Because they live in JavaScript modules, edits to embedded prompts take effect after restarting `npm run dev`.

Template variables inside `prompts/*.md` use double-curly-brace syntax (`{{variable}}`). The sections below list each file's variable names without braces for readability.

## Hot-reloadable prompts (`prompts/*.md`)

The `prompts/` directory contains ten Markdown template files, each rendered at request time from variables supplied by its calling route.

### `prompts/synthesis.md`

Generates the main daily briefing (executive summary, thematic arguments, and paper cards) via `/api/synthesize` after Stage 4 PDF analysis finishes.

**Variables:** `profile`, `papers`

When applicable, `/api/synthesize` appends the reader's Gate 3 notes (`lib/synthesis/readerNotes.js`) as run-specific editorial instructions alongside a retry hint if the hallucination audit requested a second synthesis pass. Both additions are placed after the cached prompt prefix so Anthropic prompt caching remains valid.

### `prompts/analyze-pdf-quick.md`

Generates a ~300-word per-paper summary for the inline card expansion view via `/api/analyze-pdf-quick` in parallel during briefing preparation. Quick summaries are displayed only to the reader in the UI and are excluded from both synthesis and the hallucination audit.

**Variables:** `title`, `authors`, `arxivId`, `fullReport`, `abstract`, `scoringJustification`

### `prompts/check-briefing.md`

Runs the hallucination audit via `/api/check-briefing` immediately after synthesis to flag any per-paper factual claims that lack support in the source abstracts or full PDF reports.

**Variables:** `briefing`, `papers`

### `prompts/editor-questions.md`

Generates up to two multiple-choice editor's questions after a briefing via `/api/editor-questions` (using `briefingModel` when `editorQuestions` is enabled), asking only when the day's papers expose an ambiguity in the research profile. `lib/editorQuestions/questions.js` retains only questions that end with a question mark, provide two to four short answer options, and cite an arXiv ID from the input set (returning zero questions when none are needed).

**Variables:** `profile`, `feedback`, `papers`, `nearMisses`

### `prompts/suggest-profile.md`

Generates proposed edits to the research profile text and editorial notes (`add`, `revise`, or `retire`) from accumulated reader feedback via `/api/suggest-profile`.

**Variables:** `profile`, `feedback`

### `prompts/notebooklm-discussion-guide.md`

Generates the podcast discussion outline for Gemini Notebook (formerly NotebookLM) via `/api/generate-notebooklm`, scaling theme coverage, paper pruning, and technical depth to the selected length preset (`Short`, `Default`, or `Long`).

**Variables:** `themes`, `papers`, `duration`, `date`

### `prompts/rubric-filter.md`

Defines the Stage 2 quick-filter rubric (<span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-no">NO</span> verdicts, a one-sentence summary, and a one-sentence justification), called for every filter batch via `/api/quick-filter`.

**Variables:** `profile`, `papers`

### `prompts/rubric-scoring.md`

Defines the Stage 3 abstract-scoring rubric (0.0–10.0 composite scale, alignment and quality breakdown, and profile-aware quality calibration), called for every scoring batch via `/api/score-abstracts`.

**Variables:** `profile`, `papers`

### `prompts/rubric-rescoring.md`

Defines the Stage 3.5 post-processing pass, which re-evaluates scored abstracts in comparative batches for cross-batch consistency via `/api/rescore-abstracts` when post-processing is enabled.

**Variables:** `profile`, `papers`

### `prompts/rubric-pdf.md`

Defines the Stage 4 full-PDF analysis rubric (structured technical summary, key findings, methodology, limitations, updated score, and the label and description of the paper's key figure), called for each selected paper via `/api/analyze-pdf`. The route crops the named figure from the PDF automatically.

**Variables:** `profile`, `originalScore`

::: tip Changes take effect immediately
Edits to any file in `prompts/` take effect on the very next API call that reads that file, without rebuilding or restarting the development server.
:::

### Variable conventions

Template variables are substituted by string replacement using these conventions:

- `notes` in `suggest-profile.md` lists the current editorial notes grouped by scope, each labeled with its identifier so proposals can revise or retire specific notes.
- `profile` contains the exact research profile text stored in `scoringCriteria` in your configuration, followed by the active scope's editorial notes when present (`lib/profile/editorialNotes.js`). Because it is inserted verbatim, your Markdown headings and bullet structure carry directly into the prompt.
- `papers` in `synthesis.md` is a JSON-serialized array of the final-round papers containing each paper's arXiv ID, title, abstract, score, scoring justification, full PDF report, and an `engagement` object whenever you starred, dismissed, or commented on the paper (excluding quick summaries).
- `papers` in `check-briefing.md` is rendered plain text formatted with one untruncated block per paper (`lib/synthesis/checkCorpus.js`) containing the exact material the synthesis writer saw: title, relevance score, reader engagement, abstract, scoring justification, and full report. `briefing` is a plain-text rendering of the executive summary, theme arguments, and paper cards.
- `feedback` in `suggest-profile.md` is a structured block assembled by `lib/profile/suggestPrompt.js` that groups selected pending feedback events by type, includes an `ANSWERS TO THE EDITOR'S QUESTIONS` section when answers exist, and ends with `PREVIOUSLY REJECTED SUGGESTIONS` (listing up to 10 recently declined proposals). Because `resolveSuggestionOutcome` marks feedback events as incorporated only when an accepted change's rationale cites the paper's arXiv ID or quotes the comment, preserve the rationale citation instructions in `suggest-profile.md`.
- In `editor-questions.md`, `papers` lists the briefing's paper cards (`id`, `title`, `score`, and `pitch`), `nearMisses` lists the highest-scoring papers that fell below the cutoff, and `feedback` lists recent stars, dismissals, comments, and prior question answers so the model does not repeat answered questions.
- In `notebooklm-discussion-guide.md`, `themes` and `papers` carry briefing-level summaries (theme arguments, paper indices, and scores) because the full Stage 4 reports are uploaded to Gemini Notebook as separate source files.

### The cache-boundary marker

The four `rubric-*.md` files contain a single `{{CACHE_BOUNDARY}}` line that divides each template into a stable prefix (the rubric instructions and your research profile) and a variable tail (the current batch of papers). `lib/llm/loadRubricPrompt.js` substitutes the template variables and splits the string at `{{CACHE_BOUNDARY}}` so the Anthropic adapter can attach `cache_control: {type: 'ephemeral'}` exclusively to the stable prefix. The two halves concatenate directly from the model's perspective, while edits above the marker update the cached prefix and edits below it apply per batch.

Always preserve `{{CACHE_BOUNDARY}}` on its own line surrounded by blank lines; removing it causes `loadRubricPrompt` to throw a load error on the next request.

### Route-enforced output schemas {#output-format-lives-in-the-route-not-the-prompt}

Every LLM route except quick summaries and the podcast discussion guide sends a strict JSON Schema with the provider request so structured decoding enforces the output format. Prompts explain what each field means without restating the JSON shape or including example JSON blocks, ensuring that prompt text never conflicts with the route schema in `pages/api/`.

## Embedded prompts (require server restart)

A smaller set of short repair templates and programmatic prompt builders lives directly in JavaScript source files:

| Location                                                                    | What it controls                                                                                     | When it runs                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `lib/notebooklm/buildFocusPrompt.js`                                        | Focus-prompt generator for Gemini Notebook; per-preset theme and paper budgets in `podcastLength.js` | During podcast bundle generation; output is written to `focus-prompt.txt`         |
| `lib/synthesis/repair.js`                                                   | Synthesis repair template                                                                            | Only when `/api/synthesize` output fails the schema or deterministic checks       |
| `lib/synthesis/readerNotes.js`                                              | The reader's-notes section appended to the synthesis prompt                                          | When you entered a general comment at Gate 3 during that run                      |
| `pages/api/check-briefing.js`                                               | Hallucination-check schema-repair template                                                           | Only when `/api/check-briefing` output fails schema validation                    |
| `pages/api/suggest-profile.js`                                              | Suggest-profile schema-repair template and the overlap-retry hint                                    | Only when `/api/suggest-profile` output fails validation                          |
| `pages/api/{quick-filter,score-abstracts,rescore-abstracts,analyze-pdf}.js` | The `# RETRY NOTICE` hint appended to the rubric prompt                                              | When the initial response fails the route's validation checks                     |
| `lib/analyzer/stages/core.js`                                               | The client-side correction prompt                                                                    | When a route's HTTP 200 response fails to parse in the browser                    |
| `lib/analyzer/briefingClient.js`                                            | The retry hint for a flagged briefing                                                                | When the hallucination audit returns a verdict that triggers a synthesis retry    |
| `lib/profile/suggestPrompt.js`                                              | The `USER GUIDANCE FOR THIS CALL` block and the rejected-suggestions section                         | When you enter custom guidance in the Suggest dialog or have declined suggestions |

`buildFocusPrompt.js` computes paper and theme budgets dynamically from the selected podcast preset, while the repair templates and retry hints are tightly coupled to their corresponding route validators.

## What to tune for which quality setting

Use the mapping below to locate the prompt file that governs a specific behavior:

- **Briefing prose, theme framing, or paper pitches:** Edit `prompts/synthesis.md`, which specifies the structure, tone, and sourcing rules for the executive summary, theme arguments, and paper cards.
- **Quick-summary length, ordering, or tone:** Edit `prompts/analyze-pdf-quick.md`, which governs the ~300-word inline expansion summaries.
- **Hallucination audit sensitivity:** Edit `prompts/check-briefing.md`, which defines the boundary between per-paper factual claims (which require source support) and cross-paper editorial synthesis (which is permitted unless it contradicts a source paper), along with the <span class="verdict is-no">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-yes">NO</span> verdict thresholds (`YES` indicates unsupported claims detected; `NO` indicates a clean audit). Keep `"Sourcing discipline"` in `prompts/synthesis.md` synchronized with `prompts/check-briefing.md`, and use `briefingRetryOnYes` and `briefingRetryOnMaybe` in Settings to control automatic retry behavior.
- **Profile suggestion conservatism or weighting:** Edit `prompts/suggest-profile.md`, which specifies how stars, dismissals, comments, and filter overrides are weighed and when to return zero changes on sparse signal.
- **Frequency or specificity of editor's questions:** Edit `prompts/editor-questions.md` (format validation lives in `lib/editorQuestions/questions.js`).
- **Podcast outline pacing or focus instructions:** Edit `prompts/notebooklm-discussion-guide.md` for the written outline or `lib/notebooklm/buildFocusPrompt.js` (alongside `lib/notebooklm/podcastLength.js`) for `focus-prompt.txt`.
- **Topical relevance and paper ranking:** Edit your research profile first and use the profile refinement flow, because `prompts/rubric-filter.md`, `rubric-scoring.md`, `rubric-rescoring.md`, and `rubric-pdf.md` define the general 0–10 scale rather than your personal topical interests.

::: warning Editing scoring rubrics is a breaking change
The rubric files define what a score of 7.0 versus 9.0 means across runs. Modifying the rubric text shifts the score distribution of subsequent runs and makes new scores non-comparable with historical briefings (whose `generationMetadata` records the model IDs and profile snapshot). Treat rubric edits as explicit recalibrations.
:::

## See also

- [Briefing anatomy](/concepts/briefing-anatomy): Detailed walkthrough of `prompts/synthesis.md` and the deterministic validation checks.
- [The pipeline](/concepts/pipeline): How each stage invokes its corresponding prompt route.
- [Tuning the pipeline](/using/tuning-the-pipeline): Non-prompt settings including thresholds, batch sizes, concurrency, and review gates.
- [Troubleshooting](/reference/troubleshooting): Diagnosing schema repair and audit retry issues.
