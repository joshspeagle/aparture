# Model selection

Each pipeline stage reads from its own model slot, and picking the right model for each slot is where most of your cost-versus-quality trade-offs live. This page walks through the slots, the current registry, and a few configurations that tend to work well in practice.

## The model slots

Aparture exposes six independent model slots plus one for the optional podcast add-on. Every slot ships with a default so you can run without touching them, and every slot can be swapped per run without restarting the server.

| Slot                  | What it drives                                                                                                                                              | Default                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `filterModel`         | Stage 2 quick filter (<span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> triage) | `gemini-3.1-flash-lite` |
| `scoringModel`        | Stage 3 abstract scoring (0–10 + justification)                                                                                                             | `gemini-3.5-flash`      |
| `postProcessingModel` | Stage 3.5 comparative re-scoring (optional)                                                                                                                 | `gemini-3.5-flash`      |
| `pdfModel`            | Stage 4 deep PDF analysis                                                                                                                                   | `gemini-3.5-flash`      |
| `briefingModel`       | Stage 5 synthesis, the hallucination audit, and the refinement flow                                                                                         | `gemini-3.5-flash`      |
| `quickSummaryModel`   | Per-paper quick-summary compression (text-only), runs just before synthesis                                                                                 | `gemini-3.1-flash-lite` |

A separate `notebookLMModel` slot drives the podcast-bundle generator in [the podcast add-on](/add-ons/podcast) — no default, you pick it per generation. The related `quickSummaryConcurrency` knob (default 5, clamped 1–20) controls how many quick-summary calls fire in parallel before synthesis.

The `quickSummaryModel` default is a small Flash-Lite model because the work is text compression (the input is already the text of each deep-analysis report, not the original PDF). If you're running single-provider and don't want a Google key alongside your main one, swap this slot to a small model in your chosen provider. Quick-summary failures are non-fatal in practice — a missing key quietly drops the inline-expansion feature but doesn't break the briefing.

The scoring rubric itself lives in the pipeline documentation — see [Stage 3 scoring](/concepts/pipeline#stage-3-score-abstracts) for what the `scoringModel` is actually asked to do.

## Current lineup

The registry in `utils/models.js` is the authoritative source (it now carries per-model pricing fields too). As of July 2026 it holds 19 models across three providers. Prices below are per million tokens, list price, snapshot 2026-07.

### Anthropic (Claude)

| User-facing ID      | API ID              | Context | Input / Output | Adaptive thinking |
| ------------------- | ------------------- | ------- | -------------- | ----------------- |
| `claude-opus-4-8`   | `claude-opus-4-8`   | 1M      | $5 / $25       | Yes               |
| `claude-opus-4.7`   | `claude-opus-4-7`   | 1M      | $5 / $25       | Yes               |
| `claude-opus-4.6`   | `claude-opus-4-6`   | 1M      | $5 / $25       | Yes               |
| `claude-sonnet-5`   | `claude-sonnet-5`   | 1M      | $3 / $15       | Yes               |
| `claude-sonnet-4.6` | `claude-sonnet-4-6` | 1M      | $3 / $15       | Yes               |
| `claude-haiku-4.5`  | `claude-haiku-4-5`  | 200k    | $1 / $5        | No                |

Opus 4.8 is the current flagship; Sonnet 5 launched with introductory pricing ($2 / $10 through 2026-08-31, then $3 / $15 — the table above shows the post-intro list price). The pre-4.6 legacy entries (Opus 4.5/4.1, Sonnet 4.5, Haiku 3.5) were removed from the registry in July 2026: Haiku 3.5's API ID was retired upstream (selecting it returned a live 404), Opus 4.1 retires 2026-08-05, and the others predate adaptive thinking. Saved configs pointing at any of them are migrated automatically to the closest current-generation equivalent.

### OpenAI (GPT)

GPT-5.6 family (GA 2026-07-09, current generation):

| User-facing ID  | API ID          | Input / Output |
| --------------- | --------------- | -------------- |
| `gpt-5.6-sol`   | `gpt-5.6-sol`   | $5 / $30       |
| `gpt-5.6-terra` | `gpt-5.6-terra` | $2.50 / $15    |
| `gpt-5.6-luna`  | `gpt-5.6-luna`  | $1 / $6        |

GPT-5.4 family (previous generation, still fully served with no deprecation notice):

| User-facing ID | API ID         | Context | Input / Output | Cached input |
| -------------- | -------------- | ------- | -------------- | ------------ |
| `gpt-5.4`      | `gpt-5.4`      | 1M      | $2.50 / $15    | $0.25        |
| `gpt-5.4-mini` | `gpt-5.4-mini` | 400k    | $0.75 / $4.50  | $0.075       |
| `gpt-5.4-nano` | `gpt-5.4-nano` | 400k    | $0.20 / $1.25  | $0.02        |

OpenAI caches automatically when prompt prefixes repeat, so the cached-input column tends to apply on later runs of the day that share a profile.

### Google (Gemini)

Gemini 3.5 Flash reached GA and is Google's current top model — it is also Aparture's shipped default for the scoring, post-processing, PDF, and briefing slots. Its list pricing is $1.50 / $9.00 per million tokens (input/output), verified against Google's pricing page in the 2026-07 snapshot.

| User-facing ID     | API ID             | Input / Output |
| ------------------ | ------------------ | -------------- |
| `gemini-3.5-flash` | `gemini-3.5-flash` | $1.50 / $9.00  |

Gemini 3.x tier. Pro and Flash are still preview-only upstream (Google has already shut down sibling previews, so treat these as churn-prone); Flash-Lite reached GA in May 2026. The user-facing IDs stay stable when Google graduates the remaining previews — only the API IDs change.

| User-facing ID          | API ID                   | Input / Output (≤200k) |
| ----------------------- | ------------------------ | ---------------------- |
| `gemini-3.1-pro`        | `gemini-3.1-pro-preview` | $2 / $12               |
| `gemini-3-flash`        | `gemini-3-flash-preview` | $0.50 / $3             |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite`  | $0.25 / $1.50          |

Stable tier (Gemini 2.5):

| User-facing ID          | API ID                  | Input / Output (≤200k) |
| ----------------------- | ----------------------- | ---------------------- |
| `gemini-2.5-pro`        | `gemini-2.5-pro`        | $1.25 / $10            |
| `gemini-2.5-flash`      | `gemini-2.5-flash`      | $0.30 / $2.50          |
| `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | $0.10 / $0.40          |

Google also offers a free tier with daily request caps on most of these models. For someone running a couple of briefings per day on a modest profile, the free tier often covers the whole workflow.

All 19 models support PDF content blocks, so any of them can technically drive the `pdfModel` slot. Speed, quality, and price are the real differentiators.

## Per-stage recommendations

Each stage puts different pressure on the model. Matching the model to the pressure tends to be the cleanest way to keep quality up and costs down.

**`filterModel` — fast, cheap, directional.** Stage 2 produces three-bucket triage with a short summary. The prompt is 50–150 tokens per paper and you'll call it on everything fetched, so throughput and cost matter more than nuance. Good picks: `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`, `claude-haiku-4.5`, `gpt-5.6-luna`, `gpt-5.4-nano`. Anything pricier than Haiku is usually overkill at this stage.

**`scoringModel` — careful, calibrated, still batch-friendly.** Stage 3 assigns a 0–10 score with a justification from the abstract, and downstream stages use those scores to pick what gets deep-analysed. Calibration matters more than at the filter stage, but it's still a per-abstract task that benefits from throughput. Good picks: `gemini-3.5-flash`, `claude-sonnet-5`, `gpt-5.4-mini`. Haiku 4.5 or a Flash-Lite model can work if your profile is very clear-cut.

**`postProcessingModel` — same as or stronger than `scoringModel`.** Stage 3.5 compares top papers head-to-head for calibration, so calibration matters more than throughput. Most configurations set it to the same model as `scoringModel`.

**`pdfModel` — quality-sensitive, the most expensive slot.** Stage 4 reads full PDFs, including figures, equations, and tables, and writes the structured deep analysis that feeds the briefing. Spending more here usually pays off in what lands in front of you. Good picks: `gemini-3.5-flash`, `claude-opus-4-8`, `claude-sonnet-5`, `gpt-5.6-sol`. Cheaper fallback: `gemini-2.5-pro`.

**`briefingModel` — editorial judgment and long context.** Stage 5 writes the executive summary, themes, and paper cards. It holds your profile, the day's quick summaries and deep analyses, and recent briefing history in one context, so quality here correlates strongly with what you actually read. Good picks: `gemini-3.5-flash`, `claude-opus-4-8`, `claude-sonnet-5`, `gpt-5.6-sol`. Cheaper fallback: `gemini-2.5-flash` works if you're willing to accept slightly less polished prose.

## Example configurations

Cost estimates below are rough — token counts vary with profile length, abstract length, and how many papers pass the filter. The "100-paper run" numbers assume 100 papers fetched, ~50 passing the filter to scoring, 20 reaching deep PDF analysis, and one briefing produced. The same scenario is used for the worked calculations on the [API keys](/getting-started/api-keys#cost-at-a-glance) pages.

Three configurations worth spelling out: the Aparture default, a free-tier-only setup, and one mix across all three providers. Any model from the registry works in any slot — these are just common starting points.

### Default (Aparture ships with this)

All-Google, GA models only. What `DEFAULT_CONFIG` sets.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-3.1-flash-lite` |
| `scoringModel`        | `gemini-3.5-flash`      |
| `postProcessingModel` | `gemini-3.5-flash`      |
| `pdfModel`            | `gemini-3.5-flash`      |
| `briefingModel`       | `gemini-3.5-flash`      |
| `quickSummaryModel`   | `gemini-3.1-flash-lite` |

Ballpark cost for a 100-paper run: roughly $1.00–2.00 at Gemini 3.5 Flash's $1.50 / $9.00 list pricing — in the same band as the previous all-3.x-preview default (roughly $1.00–2.50), since 3.5 Flash undercuts the Gemini 3.1 Pro that used to hold the PDF and briefing slots.

### Free tier (Gemini 2.5 throughout)

Every slot set to a stable Gemini 2.5 model. A fresh Google AI Studio account can run the full pipeline at no cost, subject to daily request caps. Slightly less polished than the 3.x previews, but fully capable of end-to-end briefings.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-2.5-flash-lite` |
| `scoringModel`        | `gemini-2.5-flash`      |
| `postProcessingModel` | `gemini-2.5-flash`      |
| `pdfModel`            | `gemini-2.5-pro`        |
| `briefingModel`       | `gemini-2.5-pro`        |
| `quickSummaryModel`   | `gemini-2.5-flash-lite` |

Ballpark cost for a 100-paper run: effectively $0 within Google's free-tier caps, or roughly $0.50–1.20 on paid Tier 1. See [Google API key setup](/getting-started/api-keys-google#free-tier-2-5-stable-throughout) for caps and signup.

### Mixed providers

One way to spread work across all three providers: Gemini Flash-Lite on the high-volume filter, Claude Sonnet for careful abstract scoring, GPT-5.6 Terra on deep PDF analysis, Gemini 3.5 Flash for briefing synthesis, and Claude Haiku compressing quick summaries. Requires keys for all three.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-3.1-flash-lite` |
| `scoringModel`        | `claude-sonnet-5`       |
| `postProcessingModel` | `claude-sonnet-5`       |
| `pdfModel`            | `gpt-5.6-terra`         |
| `briefingModel`       | `gemini-3.5-flash`      |
| `quickSummaryModel`   | `claude-haiku-4.5`      |

Ballpark cost for a 100-paper run: roughly $1.75–3.00. Anthropic prompt caching trims scoring and quick-summary cost on repeat runs with the same profile.

This is one mix among many. Providers are interchangeable per slot, and the pipeline only checks that each slot's selected model has a valid key in `.env.local` — a missing key breaks only the stage that needs it, and the rest of the pipeline keeps running.

## Adaptive thinking on Anthropic

Claude Opus and Sonnet models from 4.6 onward (including Opus 4.8 and Sonnet 5) support adaptive thinking: the model allocates more internal reasoning tokens for harder tasks and fewer for straightforward ones. Aparture passes `thinking: {type: "adaptive"}` automatically on those models, and omits it on Haiku (which rejects it).

In practice, this matters most for `briefingModel` and `pdfModel`, where the model is asked for editorial judgment or structured deep analysis. Filter and scoring decisions are mechanical enough that thinking tokens don't buy much. Thinking tokens count against the output-token bill — usually worth it for the briefing, often not worth it for the filter.

The default `maxTokens` for Anthropic calls is raised to 16000 to give thinking room to breathe.

::: tip Anthropic prompt caching
Aparture enables Anthropic's prompt caching automatically on every Anthropic call. On runs that share a profile, the repeated-prefix cost drops substantially — the second run of the day is usually noticeably cheaper than the first. The terminal log prints `[anthropic cache] read=N create=N` after each call if you want to confirm cache hits.
:::

## When the previews change

Gemini 3.x Pro and Flash are still marked `-preview` in their API IDs; Flash-Lite reached GA in May 2026 and its API ID is now `gemini-3.1-flash-lite` (the old `-preview` alias has since been shut down upstream). Preview IDs carry real shutdown risk — Google has already retired sibling previews — which is why Aparture's shipped defaults moved to GA models in July 2026. The user-facing IDs stay stable across these transitions — only the API IDs change. `utils/models.js` handles the mapping, so upgrades are a one-file change.

---

**Snapshot taken 2026-07-15.** Model lineup and pricing from `utils/models.js` (pricing fields `inputPerMTok`/`outputPerMTok`, snapshot 2026-07). Pricing verified against the provider pricing pages below. Check these for current prices before making high-volume decisions:

- Anthropic: [platform.claude.com/docs/en/docs/about-claude/models](https://platform.claude.com/docs/en/docs/about-claude/models)
- OpenAI: [developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models)
- Google: [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)

## Next

[The pipeline →](/concepts/pipeline) — where each model slot slots in, and what each stage is actually asking for.

Also worth reading:

- [API keys](/getting-started/api-keys) — set up the keys for the providers you picked.
- [Tuning the pipeline](/using/tuning-the-pipeline) — thresholds, batch sizes, and review gates to adjust alongside model choice.
- [Reading a briefing](/using/reading-a-briefing) — what the `briefingModel` actually produces, so you can judge whether a slot change is helping.
