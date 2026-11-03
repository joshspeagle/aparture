# Generating a podcast

Aparture builds a structured ZIP bundle of Markdown sources and a custom focus prompt that you upload to [Gemini Notebook](https://notebooklm.google.com) (Google's hosted notebook service, formerly NotebookLM) to generate a two-host audio conversation covering the day's papers. Creating and uploading the bundle takes two to three minutes of interactive setup before Gemini Notebook renders the audio, and both the discussion outline (`prompts/notebooklm-discussion-guide.md`) and focus prompt (`lib/notebooklm/buildFocusPrompt.js`) can be customized for your workflow.

## Is this worth setting up?

The podcast workflow is an optional add-on, and many researchers rely solely on the written briefing. Generating audio provides value when you want to review the day's papers while commuting or exercising, when spoken dialogue helps you retain high-level structure before opening a PDF, or when you want to share a digestible overview with a collaborator. If you prefer reading directly at your desk, you can skip this workflow entirely.

## What's in the bundle

Once a briefing has been generated, a <span class="ui-action">Podcast</span> card appears below it in the main area. Clicking <span class="ui-action">Generate podcast bundle</span> downloads a ZIP archive containing `INSTRUCTIONS.md`, `briefing.md`, `discussion-guide.md`, per-paper Stage 4 reports (`papers/<arxivId>.md`), and `focus-prompt.txt`:

| File                  | Purpose                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTRUCTIONS.md`     | Step-by-step upload instructions for Gemini Notebook. Keep this file locally for reference and do not upload it as a notebook source.                                      |
| `briefing.md`         | The complete written briefing (executive summary, thematic arguments, and paper cards) formatted as a single Markdown source.                                              |
| `discussion-guide.md` | A structured podcast outline generated from the briefing (theme weighting, talking points, and pacing scaled to your chosen length preset) that guides the notebook hosts. |
| `papers/<arxivId>.md` | One file per analyzed paper containing its Stage 4 full-PDF technical report so the hosts can draw on specific methods and numbers.                                        |
| `focus-prompt.txt`    | The customization prompt that you paste into Gemini Notebook's audio-overview instructions box to control emphasis, technical depth, and pacing.                           |

Because every file in the archive is plain Markdown or text, you can inspect or edit the bundle before uploading it.

## Generating the bundle

Configure and build the bundle inside the Podcast card:

1. **Length:** Select **Short** (approximately 5–8 minutes), **Default** (approximately 10–15 minutes), or **Long** (approximately 20–30 minutes). Both the discussion guide and the focus prompt scale their scope to match your preset: **Short** covers 1–2 themes and 2–3 papers, **Default** covers 2–3 themes with 4–6 papers in depth, and **Long** covers 3–4 themes with extended discussion of the highest-scoring papers. Each preset corresponds to one of Gemini Notebook's built-in duration options (**Shorter**, **Default**, or **Longer**), as noted on the card and in `INSTRUCTIONS.md` (preset budgets are defined in `lib/notebooklm/podcastLength.js`).
2. **Model:** Choose the model that generates `discussion-guide.md` from the selector (populated from `AVAILABLE_MODELS` and defaulting to `gemini-3.8-flash`). Because outlining the episode is a cross-paper synthesis task, select a capable synthesis model ([Model selection](/concepts/model-selection)).
3. **Generate:** Click <span class="ui-action">Generate podcast bundle</span>. Generation takes roughly 30–60 seconds and downloads a ZIP archive named `aparture-notebooklm-YYYY-MM-DD.zip`.

## Uploading to Gemini Notebook

Because Gemini Notebook (`notebooklm.google.com`) does not offer a public API for notebook creation or audio generation, uploading the bundle is a brief manual step (if Google updates the Notebook interface, `INSTRUCTIONS.md` inside your generated ZIP archive contains the latest UI labels):

1. Unzip the downloaded archive on your machine, as Gemini Notebook accepts individual files rather than ZIP archives.
2. Open [notebooklm.google.com](https://notebooklm.google.com) and sign in with your Google account.
3. Create a new notebook.
4. In the Sources panel, select **Add source → Upload files** and upload `briefing.md`, `discussion-guide.md`, and all files under `papers/<arxivId>.md`.
5. Leave `focus-prompt.txt` and `INSTRUCTIONS.md` out of the uploaded sources, because `focus-prompt.txt` is pasted into the audio customization box in Step 8 and `INSTRUCTIONS.md` is for your own reference.
6. Wait a few seconds for Gemini Notebook to index the uploaded Markdown files.
7. In the Audio Overview panel, click <span class="ui-action">Customize</span> (or the pencil icon).
8. Paste the full contents of `focus-prompt.txt` into the customization text box and select the Gemini Notebook duration option that matches your preset (**Shorter**, **Default**, or **Longer**).
9. Click <span class="ui-action">Generate</span>. Gemini Notebook renders the audio overview in a few minutes depending on server queue depth, after which you can listen in your browser, download the audio file, or share the notebook link.

::: info Gemini Notebook UI changes
Google updates the Gemini Notebook interface periodically. Whenever button labels or panel locations shift, follow the `INSTRUCTIONS.md` file packaged inside your downloaded bundle.
:::

::: warning The notebook decides the final length
Gemini Notebook's built-in duration selector (**Shorter**, **Default**, **Longer**) is the primary pacing setting for the generated audio and takes precedence over minute targets written in the focus prompt. Always pair your Aparture preset with the matching duration selector in Gemini Notebook, and expect roughly $\pm 30\%$ variation in final runtime. The focus prompt instructs the hosts to preserve the selected papers and technical depth if the runtime stretches or compresses.
:::

## What the focus prompt does

The generated `focus-prompt.txt` file steers Gemini Notebook away from a generic summary toward a technical discussion between two researchers by specifying:

- Your research context, summarized from your active profile and podcast editorial notes.
- How many themes and papers to cover and at what level of technical detail, scaled to your selected length preset.
- Conversational guidelines that prioritize methodological trade-offs, quantitative results, and explicit arXiv ID citations.
- Material to skip, such as introductory boilerplate or lower-scored papers.

Because `focus-prompt.txt` is tailored to the specific briefing and length preset at bundle-generation time, you can paste it directly without manual edits.

## Tuning podcast style

You can customize podcast structure and tone through the Markdown outline prompt (`prompts/notebooklm-discussion-guide.md`) and the programmatic focus-prompt builder (`lib/notebooklm/buildFocusPrompt.js`).

### `prompts/notebooklm-discussion-guide.md`: the outline template

This Markdown prompt generates `discussion-guide.md`, controlling how themes are ordered and weighted, which papers receive deep-dive coverage versus brief mentions, how the conversation transitions from opening to close, and how lower-priority papers are pruned to fit the length preset.

Because the server reads `prompts/notebooklm-discussion-guide.md` from disk on every call, edits take effect on the next bundle you generate without restarting `npm run dev`.

### `lib/notebooklm/buildFocusPrompt.js`: the focus prompt builder

This JavaScript module generates `focus-prompt.txt`, combining conversation-style directives with the per-preset theme and paper budgets defined in `lib/notebooklm/podcastLength.js`.

Because `buildFocusPrompt.js` is part of the server code, restart `npm run dev` after editing it so your changes take effect. See [Reference: prompts](/reference/prompts) for a complete overview of all prompt templates and builders.

## Common issues

- **The audio sounds generic:** Confirm that you clicked <span class="ui-action">Customize</span> in Gemini Notebook and pasted the contents of `focus-prompt.txt` into the instructions box before generating audio.
- **The hosts skip a paper you wanted covered:** Shorter length presets prune lower-scoring papers to fit the time budget. Star the paper on the briefing view, regenerate the podcast bundle, and upload the updated files, because starred papers receive priority in the discussion guide.
- **Episode length differs from your target:** Verify that the duration option selected in Gemini Notebook (**Shorter**, **Default**, or **Longer**) matches the preset you chose in Aparture.
- **The hosts spend the opening minute on banter or meta-narration:** Although `focus-prompt.txt` instructs the hosts to begin directly with the science and avoid announcing their format, Gemini Notebook occasionally inserts conversational preamble on longer duration settings; switching to the **Short** preset reduces filler.
- **Gemini Notebook hits a source limit or truncates:** On very large runs, upload only `briefing.md` and `discussion-guide.md` so the source set stays compact.
- **Bundle generation takes a long time:** Generating `discussion-guide.md` requires a full synthesis call; switching `notebookLMModel` to a faster model (such as `gemini-3.8-flash` or `claude-sonnet-5.5`) reduces generation latency.

## Next

- [Reading a briefing](/using/reading-a-briefing): Learn how briefing themes and stars shape the upstream input to the podcast bundle.
- [Tuning the pipeline](/using/tuning-the-pipeline): Adjust scoring thresholds and model slots that determine which papers reach the briefing.
- [Reference: prompts](/reference/prompts): Inspect every prompt template Aparture uses, including `prompts/notebooklm-discussion-guide.md`.
