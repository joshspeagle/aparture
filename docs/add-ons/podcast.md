# Generating a podcast

Aparture doesn't produce audio directly. Instead, it builds a bundle of markdown sources plus a focus prompt that you upload to [Gemini Notebook](https://notebooklm.google.com) (Google's hosted tool, formerly NotebookLM), which generates a two-host conversation about the day's papers. The whole flow takes a few minutes of active clicking on top of whatever the notebook needs to render the audio.

This page covers what's in the bundle, how the upload works, and the two places where you can tune podcast style.

## Is this worth setting up?

The podcast flow is entirely optional. Plenty of users skip it and just read their briefings. It tends to earn its keep if you commute or exercise regularly and want to keep up passively, if audio sticks better for you than text, or if you want to share a briefing with a collaborator who isn't in Aparture. If most of your paper reading happens at a desk and you don't want another tool in the loop, skipping this add-on is perfectly reasonable.

## What's in the bundle

Once a briefing exists, a <span class="ui-action">Podcast</span> card appears below it in the main area. Clicking <span class="ui-action">Generate podcast bundle</span> downloads a ZIP file containing:

| File                  | Purpose                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INSTRUCTIONS.md`     | The three-step upload workflow you're about to do. Not a notebook source: read it and keep it local.                                                                     |
| `briefing.md`         | The full briefing rendered as a single markdown source. Executive summary, themes, paper cards.                                                                          |
| `discussion-guide.md` | A podcast outline generated from the briefing — theme weighting, talking points, pacing, scaled to the length preset. The main "content" source the notebook reads from. |
| `papers/<arxivId>.md` | One file per paper, holding the Stage 4 deep-analysis report. The notebook uses these for detail during the conversation.                                                |
| `focus-prompt.txt`    | The prompt you paste into the notebook's audio-customisation box. Tells the hosts what to emphasise, how deep to go, and how to pace the conversation.                   |

Everything is plain markdown or text, so you can inspect the bundle before uploading.

## Generating the bundle

Inside the Podcast card:

1. **Length.** Short (about 5–8 minutes), Default (about 10–15 minutes), or Long (about 20–30 minutes). The discussion guide and focus prompt scale to the preset: Short covers one or two themes and 2–3 papers, Default two or three themes with 4–6 papers in depth, Long 3–4 themes with meaningful dives on the top papers. Each preset matches one of the notebook's own length options (Shorter, Default, Longer); the card and `INSTRUCTIONS.md` name the one to pick. The budgets per preset live in `lib/notebooklm/podcastLength.js`.
2. **Model.** Drop-down for which model generates the discussion guide. Picks up every model in `AVAILABLE_MODELS` and starts on the app's default model. Pick a capable one, since this is a synthesis task; [Model selection](/concepts/model-selection) lists the stronger options.
3. **Generate.** Click <span class="ui-action">Generate podcast bundle</span>. Takes roughly 30–60 seconds; progress shows inline.

When it's done, a ZIP file downloads with a name like `aparture-notebooklm-2026-04-17.zip`.

## Uploading to Gemini Notebook

Gemini Notebook, at notebooklm.google.com, has no public API for creating notebooks or generating audio, so this is a manual upload flow. Expect 2–3 minutes of clicking. Step-by-step (the version in `INSTRUCTIONS.md` inside the bundle stays current if Google changes the UI):

1. Unzip the bundle locally. The notebook doesn't accept ZIPs as sources.
2. Open [notebooklm.google.com](https://notebooklm.google.com) and sign in with a Google account if needed.
3. Create a new notebook.
4. In the Sources panel, choose "Add source" → "Upload files" and select **every `.md` file** from the unzipped bundle at once — `briefing.md`, `discussion-guide.md`, and all of `papers/<arxivId>.md`.
5. Do not upload `focus-prompt.txt` or `INSTRUCTIONS.md` as sources. They're for the next step and for you, respectively.
6. Wait a few seconds for the notebook to index the sources.
7. In the main panel, find the Audio Overview controls and click <span class="ui-action">Customize</span> (sometimes a pencil icon).
8. Paste the entire contents of `focus-prompt.txt` into the customisation text box, and pick the length option that matches your preset (Shorter, Default, or Longer).
9. Click <span class="ui-action">Generate</span>. The notebook takes a few minutes to render the audio — timing varies with queue depth on Google's side.

When it finishes, you'll have an audio overview in the notebook. Play it in-browser, download it, or share the notebook link.

::: info Gemini Notebook UI changes
Google revises the notebook interface periodically. Button names and panel locations drift. The bundle's `INSTRUCTIONS.md` is the version of these steps that ships with your bundle; if something doesn't match, trust that one over this page.
:::

::: warning The notebook decides the final length
The notebook's own length option is its pacing knob, and it overrides the length target in the focus prompt more often than not. That's why Aparture offers three presets instead of a minute count: pick the preset, then pick the matching option in the notebook. Expect ±30% variance even then. The focus prompt asks the hosts to keep the number of papers and depth intact when length is stretched or compressed, rather than dropping content.
:::

## What the focus prompt does

The focus prompt is what distinguishes a generic "read the sources aloud" podcast from one that sounds like two researchers talking through the day's papers. It carries:

- Your research context, paraphrased from the profile text.
- How many papers to cover and at what depth, scaled to the length preset you picked.
- What kind of conversation to have — argument-focused, willing to surface tensions, careful with citations.
- What to skip, usually purely descriptive or low-scored material.

The focus prompt is generated when you build the bundle, so it already reflects the specific briefing and length. You don't need to edit it — paste it in as-is.

## Tuning podcast style

Two places shape the output, and they behave differently.

### `prompts/notebooklm-discussion-guide.md`: the outline template

This is the prompt that produces `discussion-guide.md`. It controls how themes are ordered and weighted in the outline, which papers get deep-dive coverage versus brief mentions, the overall conversation arc (open, themes, transitions, close), and the pruning rules when the outline would overrun the length budget.

Edit this file and the next bundle you generate will use the new template — the server re-reads it on each call, no rebuild needed. This is usually the right place to experiment with podcast structure.

### `lib/notebooklm/buildFocusPrompt.js`: the focus prompt builder

This is a JavaScript function (not a markdown template) that produces `focus-prompt.txt`. It controls the conversation-style directives embedded in the focus prompt; the depth strategy for each preset (how time is split across deep-dives and brief mentions, and how many themes) lives beside it in `lib/notebooklm/podcastLength.js`.

Because this lives in JS, changes require a server restart to take effect. It's less convenient for quick iteration but more powerful, since you can condition the prompt on briefing content or length programmatically.

For the full prompt reference, see [Reference: prompts](/reference/prompts).

## Common issues

**The audio sounds generic.** Usually the focus prompt wasn't pasted, or it was pasted into the wrong text box. The <span class="ui-action">Customize</span> → text-box flow is what shapes the podcast; without it, the notebook produces a default-tone summary.

**The hosts skip a paper you wanted covered.** At shorter lengths, the outline prunes aggressively by score. Star the paper in the briefing, re-generate the bundle, and re-upload. Starred papers get priority in the discussion guide.

**Length is way off target.** The notebook's length option controls pacing more than the focus prompt does; see the warning box in the upload section. Check that the option you picked matches your preset (Short and Shorter, Default and Default, Long and Longer).

**The hosts spend the first minute or two on preamble and banter.** The focus prompt explicitly tells the hosts to skip greetings, agenda-setting, and meta-narration about the format, but the notebook sometimes inserts them anyway. The longer the length option, the worse this tends to be; Short has less runway for filler.

**The hosts repeatedly announce what they'll do instead of doing it** ("we'll cite arXiv IDs today", "we'll keep this conversational", etc.). Same root cause as banter: the notebook sometimes meta-narrates despite the focus prompt telling it not to. A shorter length usually cuts this down because there's less time to fill.

**The notebook hits a context limit or truncates.** Too many sources can do this. Try uploading only `briefing.md` and `discussion-guide.md`, dropping the per-paper reports. The notebook can usually infer enough from the briefing alone.

**Bundle generation takes a long time.** The LLM call for the discussion guide is the slow part. Switching `notebookLMModel` to a faster model (a Gemini Flash or Claude Sonnet model) cuts this noticeably.

## Next

- [Reading a briefing](/using/reading-a-briefing) — the briefing is the upstream input, so tuning it tunes the podcast.
- [Tuning the pipeline](/using/tuning-the-pipeline) — thresholds and model choices that shape what reaches the bundle.
- [Reference: prompts](/reference/prompts) — every prompt file Aparture ships, including the discussion-guide template.
