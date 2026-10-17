# Model selection

Each pipeline stage reads from its own model slot, and picking the model for each slot is where most of your cost-versus-quality trade-offs live. This page covers the slots, the current registry, and a few configurations that work well in practice.

## The model slots

Aparture has six model slots for the pipeline plus one for the optional podcast add-on. Every slot ships with a default, and any slot can be changed between runs without restarting the server. Six have drop-downs in the Settings panel; the post-processing one appears when **Enable Post-Processing** is on. `notebookLMModel` is picked on the Podcast card in the briefing view.

| Slot                  | What it drives                                                                                                                                              | Default                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `filterModel`         | Stage 2 quick filter (<span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> triage) | `gemini-3.5-flash-lite` |
| `scoringModel`        | Stage 3 abstract scoring (0–10 + justification)                                                                                                             | `gemini-3.6-flash`      |
| `postProcessingModel` | Stage 3.5 comparative re-scoring (optional)                                                                                                                 | `gemini-3.6-flash`      |
| `pdfModel`            | Stage 4 deep PDF analysis                                                                                                                                   | `gemini-3.8-flash`      |
| `briefingModel`       | Stage 5 synthesis, the hallucination audit, and the refinement flow                                                                                         | `gemini-3.8-flash`      |
| `quickSummaryModel`   | Per-paper quick-summary compression (text-only), runs just before synthesis                                                                                 | `gemini-3.5-flash-lite` |
| `notebookLMModel`     | The podcast add-on's discussion guide                                                                                                                       | `gemini-3.8-flash`      |

The `quickSummaryModel` default is a Flash-Lite model because the work is text compression: the input is the text of each deep-analysis report, not the PDF. If you run a single provider and don't want a Google key alongside it, switch this slot to that provider's small model. Quick-summary failures don't stop the briefing; a missing key only drops the inline quick-summary expansions.

The scoring rubric itself is described on the pipeline page: see [Stage 3 scoring](/concepts/pipeline#stage-3-score-abstracts) for what the `scoringModel` is asked to do.

## Current lineup

The registry in `utils/models.js` is the authoritative source. It keeps each provider's current generation plus the one before it, with per-model pricing. Prices below are US dollars per million tokens (MTok), registry snapshot 2026-10-17.

Some providers publish a time-boxed promotional price. The registry records it with its end date, and Aparture's cost estimates use the promotional price until that date and the list price after. Both are shown below.

### Anthropic (Claude)

| User-facing ID      | API ID              | Context | Input / Output | Adaptive thinking |
| ------------------- | ------------------- | ------- | -------------- | ----------------- |
| `claude-fable-5.1`  | `claude-fable-5-1`  | 1M      | $10 / $50      | Always on         |
| `claude-opus-5.5`   | `claude-opus-5-5`   | 1M      | $4 / $20       | Yes               |
| `claude-sonnet-5.5` | `claude-sonnet-5-5` | 1M      | $2 / $10       | Yes               |
| `claude-haiku-5.5`  | `claude-haiku-5-5`  | 1M      | $0.10 / $0.50  | Yes               |
| `claude-fable-5`    | `claude-fable-5`    | 1M      | $10 / $50      | Always on         |
| `claude-opus-5`     | `claude-opus-5`     | 1M      | $5 / $25       | Yes               |
| `claude-sonnet-5`   | `claude-sonnet-5`   | 1M      | $2 / $10       | Yes               |
| `claude-haiku-4.5`  | `claude-haiku-4-5`  | 200k    | $1 / $5        | No                |

The first four rows are the current generation. Opus 5.5 is cheaper than the Opus 5 it replaces, and Haiku 5.5 costs a tenth of Haiku 4.5 while adding adaptive thinking. Haiku 5.5's price holds for prompts up to 100K tokens; longer prompts bill at $0.50 / $2.50, which a long PDF on the `pdfModel` slot can reach.

Two things to know about the Fable models (`claude-fable-5.1`, `claude-fable-5`):

- **Their thinking can't be turned off.** At $50 / MTok output, thinking tokens are the expensive kind, and there's no setting that trades them away.
- **They require 30-day data retention on your Anthropic organization.** Under zero data retention every request fails with a 400 that reads like a malformed payload rather than a policy rejection. If a Fable model is the one that 400s for you and the others work, check your org's retention setting first.

Claude Mythos is available only through Project Glasswing, so it isn't in the registry. If you have access, adding it is a short change in `utils/models.js`: copy the matching Fable entry and change the IDs.

### OpenAI (GPT)

| User-facing ID  | API ID          | Input / Output                                                  | Cached input |
| --------------- | --------------- | --------------------------------------------------------------- | ------------ |
| `gpt-6-astra`   | `gpt-6-astra`   | $10 / $50                                                       | $1.00        |
| `gpt-6.1-sol`   | `gpt-6.1-sol`   | $2 / $10                                                        | $0.10        |
| `gpt-6-luna`    | `gpt-6-luna`    | $0.10 / $0.50                                                   | $0.01        |
| `gpt-5.6-sol`   | `gpt-5.6-sol`   | $5 / $30 list; $4 / $20 promotional through at least 2026-11-21 | $0.40        |
| `gpt-5.6-terra` | `gpt-5.6-terra` | $2 / $12                                                        | $0.20        |
| `gpt-5.6-luna`  | `gpt-5.6-luna`  | $0.20 / $1.20                                                   | $0.02        |

The GPT-6 family is current; GPT-5.6 is the previous generation. Prices are OpenAI's standard-tier rates for prompts up to 272K tokens. OpenAI caches repeated prompt prefixes automatically, so the cached-input column applies to the part of each prompt that repeats between calls (the rubric and your profile).

### Google (Gemini)

| User-facing ID          | API ID                  | Input / Output (≤200k)                               | Free tier |
| ----------------------- | ----------------------- | ---------------------------------------------------- | --------- |
| `gemini-4-argon`        | `gemini-4-argon`        | $4 / $20 list; $2 / $10 through 2026-11-30           | No        |
| `gemini-3.8-flash`      | `gemini-3.8-flash`      | $1.50 / $7.50 list; $0.75 / $3.75 through 2026-12-31 | Yes       |
| `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | $0.30 / $2.50                                        | Yes       |
| `gemini-3.6-flash`      | `gemini-3.6-flash`      | $1.50 / $7.50 list; $0.75 / $3.75 through 2026-12-31 | Yes       |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | $0.25 / $1.50                                        | Yes       |
| `gemini-2.5-pro`        | `gemini-2.5-pro`        | $1.25 / $10                                          | Legacy    |
| `gemini-2.5-flash`      | `gemini-2.5-flash`      | $0.30 / $2.50                                        | Legacy    |
| `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | $0.10 / $0.40                                        | Legacy    |

The first three rows are current: Gemini 4 Argon is the flagship (paid tier only), 3.8 Flash is the strongest Flash model, and 3.5 Flash-Lite is the cheapest current model. 3.6 Flash and 3.1 Flash-Lite are the previous generation; Google lists 3.1 Flash-Lite's earliest shutdown as May 2027. Google now limits Gemini 2.5 to accounts that have used it before, so a new key is likely to be refused; the models aren't deprecated.

Gemini 3.x and 4 think by default, and Google bills thinking tokens at the output rate. Aparture counts them in its cost tracking.

Google rejects requests from unrestricted standard API keys. [Google setup](/getting-started/api-keys-google#_2-create-an-api-key) explains which keys work.

### Removed in the October 2026 refresh

| Removed                                                 | Saved configs move to |
| ------------------------------------------------------- | --------------------- |
| `claude-opus-4.8`, `claude-opus-4.7`, `claude-opus-4.6` | `claude-opus-5.5`     |
| `claude-sonnet-4.6`                                     | `claude-sonnet-5.5`   |
| `gpt-5.4`                                               | `gpt-6.1-sol`         |
| `gpt-5.4-mini`, `gpt-5.4-nano`                          | `gpt-6-luna`          |
| `gemini-3.5-flash`                                      | `gemini-3.6-flash`    |
| `gemini-3-flash` (preview)                              | `gemini-3.8-flash`    |
| `gemini-3.1-pro` (preview)                              | `gemini-4-argon`      |

The move happens once, when the app loads a saved config, and covers every model slot including `refusalFallbackModel` and the podcast model (`notebookLMModel`). Most replacements cost the same as or less than the model they replace. Two cost more at list price: the `gemini-3-flash` preview moves to `gemini-3.8-flash`, and the `gemini-3.1-pro` preview moves to `gemini-4-argon`, which also needs a paid tier. Check those slots in Settings if you were using either preview. Models removed in earlier refreshes move the same way.

## Per-stage recommendations

Each stage puts different pressure on the model. Matching the model to the pressure keeps quality up and costs down.

**`filterModel`: fast, cheap, directional.** Stage 2 sorts every fetched paper into three buckets with a short summary, so throughput and cost matter more than nuance. Good picks: `gemini-3.5-flash-lite` (the default), `gemini-3.1-flash-lite` (cheaper), `claude-haiku-5.5`, `gpt-6-luna`.

**`scoringModel`: careful and calibrated, still batch-friendly.** Stage 3 scores each surviving abstract from 0 to 10, and those scores decide what gets read in full. Good picks: `gemini-3.6-flash` (the default), `gemini-3.8-flash`, `claude-sonnet-5.5`, `gpt-6.1-sol`. `claude-haiku-5.5` or `gpt-6-luna` can work if your profile is clear-cut.

**`postProcessingModel`: the Review Model.** Stage 3.5 compares top papers against each other for consistency. Its **Review Model** drop-down sits under **Enable Post-Processing** in Settings. The slot defaults to `gemini-3.6-flash` and doesn't follow `scoringModel` when you change it, so a setup with no Google key should pick a model its keys cover there, or turn post-processing off. Otherwise every Stage 3.5 batch fails and the run keeps the Stage 3 scores.

**`pdfModel`: the slot where quality shows most.** Stage 4 reads full PDFs, including figures, equations, and tables, and writes the deep analysis the briefing is built from. It is also the most expensive slot, because it runs once per paper on tens of thousands of tokens. Good picks: `gemini-3.8-flash` (the default), `gemini-4-argon`, `claude-opus-5.5`, `claude-sonnet-5.5`, `gpt-6.1-sol`. A Fable model or `gpt-6-astra` works here, but its premium multiplies across every paper read.

**`briefingModel`: editorial judgment over a long context.** Stage 5 reads your profile and every full report in one call and writes the executive summary, themes, and paper cards; the audit runs on the same model. Good picks: `gemini-3.8-flash` (the default), `gemini-4-argon`, `claude-opus-5.5`, `gpt-6.1-sol`. This is the one slot where `claude-fable-5.1` or `gpt-6-astra` can be worth the price: it runs once per briefing rather than once per paper, so the premium is bounded.

**`quickSummaryModel`: small and cheap.** Any Flash-Lite, Haiku 5.5, or Luna model.

## Example configurations

The cost figures below are rough planning numbers. They use the same per-paper token estimates the app uses for its gate projections (`lib/analyzer/costEstimate.js`) on a reference run: 100 papers fetched, 50 scored and post-processed, 20 read in full, and one briefing over those 20. Thinking tokens bill as output and aren't in these figures, so real runs on thinking models come in higher. The app's own estimates appear at the score-review and pre-briefing gates, and after a run the Download Report card shows a per-stage estimate from the tokens the run actually used.

### Default (Aparture ships with this)

All-Google, all models eligible for Google's free tier. This is what `DEFAULT_CONFIG` sets.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-3.5-flash-lite` |
| `scoringModel`        | `gemini-3.6-flash`      |
| `postProcessingModel` | `gemini-3.6-flash`      |
| `pdfModel`            | `gemini-3.8-flash`      |
| `briefingModel`       | `gemini-3.8-flash`      |
| `quickSummaryModel`   | `gemini-3.5-flash-lite` |

Ballpark cost for the reference run: about $0.86 at the promotional Flash prices through 2026-12-31, about $1.66 at list price after that, and $0 within the free tier's daily caps. See [Google API key setup](/getting-started/api-keys-google#free-tier) for the caps.

### Stronger reading on Google

The default with `gemini-4-argon` on `pdfModel` and `briefingModel`. Argon needs a paid tier.

Ballpark cost for the reference run: about $2.00 at Argon's promotional price through 2026-11-30, about $3.93 at list price.

### Mixed providers

One way to spread work across all three providers: Gemini Flash-Lite on the high-volume filter, Claude Sonnet for abstract scoring, GPT-6.1 Sol for deep PDF analysis, Gemini 3.8 Flash for the briefing, and Claude Haiku for quick summaries. Post-processing stays on its Google default. It needs keys for all three.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-3.5-flash-lite` |
| `scoringModel`        | `claude-sonnet-5.5`     |
| `postProcessingModel` | `gemini-3.6-flash`      |
| `pdfModel`            | `gpt-6.1-sol`           |
| `briefingModel`       | `gemini-3.8-flash`      |
| `quickSummaryModel`   | `claude-haiku-5.5`      |

Ballpark cost for the reference run: about $2.06 at list price. Prompt caching trims the Anthropic and OpenAI stages on repeat runs with the same profile.

This is one mix among many. Each slot only needs a valid key for its own provider; a missing key breaks the stage that needs it, and the rest of the pipeline keeps running.

The per-provider pages show an all-Anthropic and an all-OpenAI lineup with stage-by-stage costs: [Anthropic](/getting-started/api-keys-anthropic#_5-recommended-models), [OpenAI](/getting-started/api-keys-openai#_6-recommended-models).

## Adaptive thinking on Anthropic

Every current Claude model in the registry uses adaptive thinking: the model spends more reasoning tokens on hard prompts and fewer on easy ones. Aparture sends `thinking: {type: "adaptive"}` on every Anthropic model except `claude-haiku-4.5`, which rejects it. Which models get the parameter is set by a `supportsAdaptiveThinking` flag on each Anthropic entry in `utils/models.js`. For a model ID that isn't in the registry, the adapter falls back to the model's name and version.

Aparture doesn't set an effort level, so each model runs at its own default. Thinking tokens bill as output; they are usually worth it on the PDF and briefing slots and buy less on the filter. Anthropic calls get a default `maxTokens` of 16000 to leave room for thinking.

::: tip Anthropic prompt caching
Aparture enables Anthropic's prompt caching on every Anthropic call. The cached part of each prompt is the rubric and your profile, so repeat calls within a few minutes read that part at a fraction of the input price; the PDFs and abstracts themselves aren't cached. The terminal prints `[anthropic cache] read=N create=N` after each call if you want to confirm cache hits.
:::

## When the registry changes

Model IDs change faster than anything else in Aparture. At each registry refresh, models more than a generation old are removed, and saved configs that point at a removed model move to its replacement the next time the app loads, as in the table above. The user-facing IDs in Settings stay stable when a provider renames an API ID; `utils/models.js` maps one to the other, so an upgrade is a one-file change.

---

**Registry snapshot 2026-10-17.** Prices from `utils/models.js` (`inputPerMTok`/`outputPerMTok`, plus `promo` blocks with end dates). Check the provider pages for current prices before committing to high-volume use:

- Anthropic: [platform.claude.com/docs/en/docs/about-claude/models](https://platform.claude.com/docs/en/docs/about-claude/models)
- OpenAI: [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing)
- Google: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)

## Next

[The pipeline →](/concepts/pipeline): where each model slot fits, and what each stage asks of it.

Also worth reading:

- [API keys](/getting-started/api-keys): set up the keys for the providers you picked.
- [Tuning the pipeline](/using/tuning-the-pipeline): thresholds, batch sizes, and review gates to adjust alongside model choice.
- [Reading a briefing](/using/reading-a-briefing): what the `briefingModel` produces, so you can judge whether a slot change is helping.
