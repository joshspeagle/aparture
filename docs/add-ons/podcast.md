# Generating a podcast

Aparture can't create audio directly, but it can build a bundle that [NotebookLM](https://notebooklm.google.com) turns into a commute-length podcast with two hosts discussing the day's papers. The flow is: download a bundle from the briefing view, upload it to NotebookLM, paste a focus prompt, pick a duration, generate.

This page covers what's in the bundle, how to upload it, and how to tune the podcast style.

## Is this worth setting up?

The podcast flow is **completely optional**. You never need it to use Aparture. A lot of users skip it entirely and just read their briefings.

It's worth trying if:

- You commute or exercise regularly and want to keep up with papers passively.
- You retain information better from audio than from text.
- You want to share a briefing with a co-author who isn't in the app.

It's probably not worth it if you only read papers at a desk and don't want another tool in your workflow.

## What's in the bundle

Once a briefing exists, the **NotebookLM** card appears below the briefing in the main area. Clicking **Generate NotebookLM bundle** produces a ZIP file containing:

- **`briefing.md`** — the full briefing (executive summary, themes, paper cards) as a single markdown source document for NotebookLM.
- **`discussion-guide.md`** — a podcast outline generated from the briefing. Structures theme emphasis, paper-by-paper talking points, and pacing suggestions scaled to the target duration. This is the main "content" source for NotebookLM.
- **One `.md` per paper** — each paper's deep-analysis full report, as its own source document. NotebookLM treats these as additional sources to pull details from during discussion.
- **`focus-prompt.txt`** — a short prompt you paste into NotebookLM's audio-customization textarea. Tells the hosts what to emphasize, how deep to go, and how to pace the conversation.

The bundle is all plain markdown + text files, so you can inspect it before uploading.

## Generating the bundle

Under the NotebookLM card:

1. **Duration** — dropdown with options 5, 10, 15, 20, 30 minutes. The discussion guide scales: 5 minutes covers 2-3 papers at headline depth; 30 minutes covers all papers with meaningful dive on the top 3-4.
2. **Model** — dropdown for which model generates the discussion guide. Pick a capable model here (it's synthesising a podcast outline from the briefing); Claude Sonnet 4.6 or Gemini 3.1 Pro are reasonable defaults.
3. **Generate NotebookLM bundle** — click to start. Takes 30-60 seconds. Progress shows inline.

When it's done, you'll get a downloaded ZIP file named something like `aparture-notebooklm-2026-04-17.zip`.

## Uploading to NotebookLM

NotebookLM doesn't have an API, so this is a **manual upload flow**. Expect about 2-3 minutes of clicking.

1. Unzip the bundle locally.
2. Open [notebooklm.google.com](https://notebooklm.google.com) in a browser. Sign in with a Google account if needed.
3. Click **+ New notebook** (or similar — the NotebookLM UI is occasionally revised).
4. You'll see a **Sources** panel. Click **+ Add source**, then **Upload files**.
5. Select every `.md` file in the unzipped bundle — the briefing, the discussion guide, and each paper's report. (Don't upload `focus-prompt.txt` here; it goes somewhere else.)
6. Wait a few seconds for NotebookLM to index the sources.
7. In the main notebook panel, find the **Audio Overview** section — look for a **Customize** button near the play button.
8. Click **Customize**. A textarea appears.
9. Paste the contents of `focus-prompt.txt` into the textarea.
10. Click **Generate**. NotebookLM takes a few minutes to produce the audio.

When it's done, you'll have a 5-30 minute podcast in NotebookLM's Audio Overview. Play it, download it, or share the notebook.

## What the focus prompt does

The focus prompt is what distinguishes a generic "here's the content" podcast from one that sounds like two researchers actually discussing the day's papers. It tells NotebookLM's hosts:

- The user's research context (from your Aparture profile).
- How many papers to cover and at what depth (scaled to your chosen duration).
- What kind of conversation to have — argument-focused, accessible, covering tensions rather than glossing.
- What to skip (e.g. skip purely descriptive parts of papers you marked as priorities).

The prompt is generated at bundle-build time, so it already reflects the specific briefing's content and your duration choice.

## Tuning podcast style

Two places to tune podcast output, and they behave differently:

### `prompts/notebooklm-discussion-guide.md` — the outline template (hot-reloadable)

This is the prompt that generates `discussion-guide.md`. It controls:

- How themes are ordered and weighted in the outline.
- Which papers get deep-dive coverage versus brief mentions.
- The overall conversation structure (open, themes, transitions, close).
- Pruning rules when the outline would run over budget.

Edit this file and the next bundle you generate will use the new template — no rebuild needed. Good for iterating on podcast structure.

### `lib/notebooklm/buildFocusPrompt.js` — the focus prompt (embedded, requires restart)

This is a JavaScript function (not a markdown template) that writes the contents of `focus-prompt.txt`. It controls:

- Duration-scaled depth strategy: how much time to allocate to deep-dives versus brief mentions at each duration tier.
- Theme count scaling with duration.
- Pacing and conversation-style directives embedded in the focus prompt.

Because this lives in JS, changes require a server restart to take effect. Less friendly for quick experimentation, but more powerful — you can condition the prompt on the specific briefing content and duration programmatically.

For the full prompt reference, see [Reference: prompts](/reference/prompts).

## Common issues

- **The audio sounds generic.** Likely cause: you pasted the focus prompt into the wrong textarea, or forgot to paste it at all. The Customize → textarea flow is the one that shapes the podcast.
- **The hosts skip a paper you cared about.** Likely cause: the paper wasn't starred, and at your chosen duration the discussion guide de-prioritised it. Star the paper and re-generate the bundle.
- **NotebookLM runs out of context / cuts off.** Likely cause: too many sources. Drop the individual-paper markdown files and upload only the briefing + discussion guide; let NotebookLM infer details from those.
- **The bundle takes forever to generate.** Likely cause: a slow briefing model. Switch to Gemini Flash or Claude Sonnet for this specific generation.

## Next

- You want to tune the briefing itself, which is the upstream input. → [Reading a briefing](/using/reading-a-briefing) and [Tuning the pipeline](/using/tuning-the-pipeline)
- You want to edit the prompt files that shape the podcast. → [Reference: prompts](/reference/prompts)
