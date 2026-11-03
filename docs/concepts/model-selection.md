# Model selection

Every LLM stage in Aparture reads from an independent model slot, allowing you to match model capability and token pricing to the specific workload of each stage.

## The model slots

Aparture provides six pipeline model slots plus one slot for the optional podcast add-on. Every slot ships with an all-Google default and can be reassigned between runs without restarting the server. Five pipeline slots appear directly in the Settings panel, `postProcessingModel` (**Review Model**) appears when **Enable Post-Processing** is checked, and `notebookLMModel` is selected on the Podcast card inside the briefing view:

| Slot                  | What it drives                                                                                                                                              | Default                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `filterModel`         | Stage 2 quick filter (<span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> triage) | `gemini-3.5-flash-lite` |
| `scoringModel`        | Stage 3 abstract scoring (0–10 score + justification)                                                                                                       | `gemini-3.6-flash`      |
| `postProcessingModel` | Stage 3.5 comparative re-scoring (optional)                                                                                                                 | `gemini-3.6-flash`      |
| `pdfModel`            | Stage 4 full-text PDF analysis                                                                                                                              | `gemini-3.8-flash`      |
| `briefingModel`       | Stage 5 synthesis, hallucination audit, editor questions, and profile refinement                                                                            | `gemini-3.8-flash`      |
| `quickSummaryModel`   | Per-paper ~300-word summary compression (text-only), executed immediately before synthesis                                                                  | `gemini-3.5-flash-lite` |
| `notebookLMModel`     | Discussion guide generation for the podcast bundle                                                                                                          | `gemini-3.8-flash`      |

Because `quickSummaryModel` compresses the text of each Stage 4 report rather than reading raw PDF bytes, a lightweight Flash-Lite, Haiku, or Luna model is well suited for that slot. If you run exclusively on Anthropic or OpenAI without a Google API key, switch `quickSummaryModel` to your active provider's lightweight model (a missing key on `quickSummaryModel` omits the inline quick-summary expansions without halting synthesis). For details on how `scoringModel` evaluates abstracts, see [Stage 3 scoring](/concepts/pipeline#stage-3-score-abstracts).

## Current lineup

The model registry in `utils/models.js` maintains each provider's current generation alongside the immediately preceding generation, together with per-model pricing in US dollars per million tokens (MTok) as of the `2026-10-17` registry snapshot. When a provider offers a time-limited promotional rate, the registry stores both the promotional price (with its expiration date) and the standard list price so that cost estimates automatically use whichever rate applies on the date of the run.

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

The first four rows represent Anthropic's current generation: Opus 5.5 reduces pricing below Opus 5, and Haiku 5.5 costs one-tenth as much as Haiku 4.5 while adding adaptive thinking. Haiku 5.5's `$0.10 / $0.50` rate applies to prompts up to 100K tokens; prompts exceeding 100K tokens bill at `$0.50 / $2.50`, which long manuscripts on `pdfModel` can reach.

When selecting a Fable model (`claude-fable-5.1` or `claude-fable-5`), note its reasoning billing and data-retention requirements:

- **Reasoning tokens are always active**: Adaptive thinking cannot be disabled on Fable models, and reasoning tokens are billed at the `$50 / MTok` output rate.
- **Requires 30-day organization data retention**: Anthropic restricts Fable models to organizations with 30-day data retention enabled; under zero-data-retention policies, Fable requests fail with an HTTP 400 error. If Fable returns 400 while Opus or Sonnet succeeds on the same key, check your organization's retention setting.

Claude Mythos is restricted to Project Glasswing participants and is not included in the default registry; users with access can add it to `utils/models.js` by copying a Fable entry and updating the model IDs.

### OpenAI (GPT)

| User-facing ID  | API ID          | Input / Output                                                  | Cached input |
| --------------- | --------------- | --------------------------------------------------------------- | ------------ |
| `gpt-6-astra`   | `gpt-6-astra`   | $10 / $50                                                       | $1.00        |
| `gpt-6.1-sol`   | `gpt-6.1-sol`   | $2 / $10                                                        | $0.10        |
| `gpt-6-luna`    | `gpt-6-luna`    | $0.10 / $0.50                                                   | $0.01        |
| `gpt-5.6-sol`   | `gpt-5.6-sol`   | $5 / $30 list; $4 / $20 promotional through at least 2026-11-21 | $0.40        |
| `gpt-5.6-terra` | `gpt-5.6-terra` | $2 / $12                                                        | $0.20        |
| `gpt-5.6-luna`  | `gpt-5.6-luna`  | $0.20 / $1.20                                                   | $0.02        |

The GPT-6 family (`gpt-6-astra`, `gpt-6.1-sol`, and `gpt-6-luna`) is the current generation, while the GPT-5.6 family is the previous generation. Listed prices reflect standard-tier rates for prompts up to 272K tokens. OpenAI automatically caches repeated prompt prefixes (such as the scoring rubric and your research profile), billing cached prefix tokens at the discounted rate in the final column.

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

The current Google lineup comprises `gemini-4-argon` (flagship, paid tier only), `gemini-3.8-flash` (highest-capability Flash model), and `gemini-3.5-flash-lite` (low-cost current model), while `gemini-3.6-flash` and `gemini-3.1-flash-lite` represent the preceding generation (with `gemini-3.1-flash-lite` scheduled for retirement no earlier than May 2027). Google restricts the legacy Gemini 2.5 family to accounts that have previously called those models.

Gemini 3.x and Gemini 4 models enable thinking tokens by default, which Google bills at the output token rate and Aparture includes in its post-run cost summaries. Google rejects requests from unrestricted standard API keys; see [Google setup](/getting-started/api-keys-google#_2-create-an-api-key) for key restriction setup.

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

When Aparture loads a saved configuration on startup, any retired model ID in any slot (including `refusalFallbackModel` and `notebookLMModel`) is migrated automatically to its replacement in the table above. Most automatic replacements cost the same as or less than the retired model, whereas `gemini-3-flash` (preview) maps to `gemini-3.8-flash` and `gemini-3.1-pro` (preview) maps to `gemini-4-argon` (which also requires a paid tier). Verify those slots in Settings if you previously used either preview model.

## Per-stage recommendations

Each stage places different demands on throughput, calibration, and long-context comprehension:

- **`filterModel` (fast, low-cost abstract triage)**: Stage 2 classifies every fetched abstract into <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">NO</span> with a one-sentence summary. Recommended picks: `gemini-3.5-flash-lite` (default), `gemini-3.1-flash-lite`, `claude-haiku-5.5`, or `gpt-6-luna`.
- **`scoringModel` (calibrated batch ranking)**: Stage 3 assigns 0.0–10.0 relevance scores that determine which papers advance to Stage 4. Recommended picks: `gemini-3.6-flash` (default), `gemini-3.8-flash`, `claude-sonnet-5.5`, or `gpt-6.1-sol` (or `claude-haiku-5.5` / `gpt-6-luna` when your profile boundaries are sharply defined).
- **`postProcessingModel` (comparative Review Model)**: Stage 3.5 re-evaluates top candidates in comparative batches. The **Review Model** dropdown appears under **Enable Post-Processing** in Settings and defaults to `gemini-3.6-flash` independently of `scoringModel`; if you operate without a Google API key, switch `postProcessingModel` to your active provider or uncheck **Enable Post-Processing**.
- **`pdfModel` (deep multimodal manuscript analysis)**: Stage 4 reads full PDFs (including figures, equations, and tables) at tens of thousands of tokens per paper and writes the technical reports that ground the briefing. Recommended picks: `gemini-3.8-flash` (default), `gemini-4-argon`, `claude-opus-5.5`, `claude-sonnet-5.5`, or `gpt-6.1-sol`. Flagship reasoning models (`claude-fable-5.1` or `gpt-6-astra`) can also be used here, though their per-paper cost multiplies across the full `maxDeepAnalysis` set.
- **`briefingModel` (long-context editorial synthesis and audit)**: Stage 5 synthesizes all final-round full reports alongside your profile in one call and runs the hallucination audit on the same slot. Recommended picks: `gemini-3.8-flash` (default), `gemini-4-argon`, `claude-opus-5.5`, or `gpt-6.1-sol`. Because `briefingModel` runs once per briefing (plus audit) rather than once per paper, flagship models such as `claude-fable-5.1` or `gpt-6-astra` add a bounded cost here.
- **`quickSummaryModel` (compact text compression)**: Any Flash-Lite, Haiku 5.5, or Luna model handles the ~300-word Stage 4 report compression cleanly.

## Example configurations

The planning figures below use Aparture's built-in token estimator (`lib/analyzer/costEstimate.js`) on a standard reference run: 100 papers fetched, 50 scored and post-processed, 20 analyzed in full as PDFs, and 1 synthesized briefing covering those 20 papers. Thinking tokens are billed as output tokens and are not included in pre-run projections, so runs on thinking-enabled models bill higher than the baseline figures. Live pre-stage estimates appear at Gates 2 and 3, and actual post-run token costs appear on the Download Report card.

### Default (Aparture ships with this)

`DEFAULT_CONFIG` assigns all-Google models that qualify for Google's free tier:

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-3.5-flash-lite` |
| `scoringModel`        | `gemini-3.6-flash`      |
| `postProcessingModel` | `gemini-3.6-flash`      |
| `pdfModel`            | `gemini-3.8-flash`      |
| `briefingModel`       | `gemini-3.8-flash`      |
| `quickSummaryModel`   | `gemini-3.5-flash-lite` |

The estimated cost for the 100-paper reference run is approximately `$0.86` at promotional Flash pricing through `2026-12-31`, `$1.66` at standard list pricing thereafter, and `$0` when operating within Google's free-tier daily rate limits (see [Google API key setup](/getting-started/api-keys-google#free-tier)).

### Stronger reading on Google

Upgrading `pdfModel` and `briefingModel` from the default lineup to `gemini-4-argon` (which requires a paid Google tier) brings the estimated cost for the 100-paper reference run to approximately `$2.00` at Argon's promotional rate through `2026-11-30` and `$3.93` at standard list pricing.

### Mixed providers

Combining all three providers lets you assign each stage to a specialized tier (requiring valid API keys for Google, Anthropic, and OpenAI):

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-3.5-flash-lite` |
| `scoringModel`        | `claude-sonnet-5.5`     |
| `postProcessingModel` | `gemini-3.6-flash`      |
| `pdfModel`            | `gpt-6.1-sol`           |
| `briefingModel`       | `gemini-3.8-flash`      |
| `quickSummaryModel`   | `claude-haiku-5.5`      |

The estimated cost for the 100-paper reference run is approximately `$2.06` at list pricing, with prompt caching reducing repeated prefix costs on the Anthropic and OpenAI stages. Single-provider lineups with per-stage cost tables are detailed on the [Anthropic](/getting-started/api-keys-anthropic#_5-recommended-models) and [OpenAI](/getting-started/api-keys-openai#_6-recommended-models) setup pages.

## Adaptive thinking on Anthropic

Every current-generation Claude model in the registry supports adaptive thinking, allocating additional reasoning tokens to complex prompts and fewer to routine ones. Aparture passes `thinking: {type: "adaptive"}` automatically on all Anthropic models where `supportsAdaptiveThinking` is enabled in `utils/models.js` (every model except `claude-haiku-4.5`, which rejects the parameter; for custom model IDs outside the registry, the adapter infers support from the model family and version).

Aparture leaves the reasoning effort parameter at each model's provider default and configures a default `maxTokens` of `16000` on Anthropic calls so reasoning tokens do not truncate the structured output. Because thinking tokens bill at the output rate, they provide the highest return on `pdfModel` and `briefingModel`.

::: tip Anthropic prompt caching
Aparture enables ephemeral prompt caching on every Anthropic request. Because the scoring rubric and your research profile sit in the shared prompt prefix, subsequent batches within the cache window read that prefix at a steep discount while only the per-paper abstracts or PDFs bill as fresh input tokens. The server logs `[anthropic cache] read=N create=N` to the terminal after each call so you can verify cache hits.
:::

## When the registry changes

Whenever `utils/models.js` is refreshed for a new model generation, models more than one generation old are retired and mapped automatically to their current equivalents on config load. User-facing model IDs in Settings remain stable across minor provider snapshot renames because `utils/models.js` maps each user-facing ID to its current provider API string in a single file.

---

**Registry snapshot 2026-10-17.** Pricing metadata is defined in `utils/models.js` (`inputPerMTok`, `outputPerMTok`, and `promo` blocks with expiration dates). Consult the official provider pricing pages for the latest rates:

- Anthropic: [platform.claude.com/docs/en/docs/about-claude/models](https://platform.claude.com/docs/en/docs/about-claude/models)
- OpenAI: [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing)
- Google: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)

## Next

Continue to [The pipeline →](/concepts/pipeline) to see how each stage processes papers and passes data to the next model slot.

Related guides:

- [**API keys**](/getting-started/api-keys): Configure API keys for Anthropic, Google, and OpenAI.
- [**Tuning the pipeline**](/using/tuning-the-pipeline): Adjust concurrency, batch sizes, candidate counts, and review gates alongside model slots.
- [**Reading a briefing**](/using/reading-a-briefing): Inspect what `briefingModel` produces and compare configurations via Generation details.
