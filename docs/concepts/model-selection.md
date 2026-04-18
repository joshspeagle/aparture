# Model selection

Choosing a model for each pipeline stage is where most of your cost and quality decisions live. This page covers the current lineup, what each stage benefits from, and three example configurations you can copy.

## The model slots

Aparture's config exposes five independent model slots. You don't have to change all of them — sensible defaults are set on first run — but every slot can be swapped per run without touching code.

| Slot                  | What it drives                                                 | Default                 |
| --------------------- | -------------------------------------------------------------- | ----------------------- |
| `filterModel`         | Stage 2 quick filter (YES/MAYBE/NO triage)                     | `gemini-2.5-flash-lite` |
| `scoringModel`        | Stage 3 abstract scoring (0–10 + justification)                | `gemini-3-flash`        |
| `postProcessingModel` | Stage 3.5 comparative re-scoring (optional)                    | `gemini-3-flash`        |
| `pdfModel`            | Stage 4 deep PDF analysis                                      | `gemini-3.1-pro`        |
| `briefingModel`       | Stage 5 synthesis + hallucination check + Suggest Improvements | `gemini-3.1-pro`        |

There's also a `notebookLMModel` slot for the optional podcast-document generator; no default (you pick one when you generate a podcast).

## Current lineup

The authoritative source is `utils/models.js`. As of 2026-04-17, the registry holds 17 models across three providers.

### Anthropic (Claude)

**Current:**

| User-facing ID      | API ID              | Context | Input / Output per MTok | Vision | Adaptive thinking |
| ------------------- | ------------------- | ------- | ----------------------- | ------ | ----------------- |
| `claude-opus-4.7`   | `claude-opus-4-7`   | 1M      | $5 / $25                | Yes    | **Yes**           |
| `claude-opus-4.6`   | `claude-opus-4-6`   | 1M      | $5 / $25                | Yes    | No                |
| `claude-sonnet-4.6` | `claude-sonnet-4-6` | 1M      | $3 / $15                | Yes    | No                |
| `claude-haiku-4.5`  | `claude-haiku-4-5`  | 200k    | $1 / $5                 | Yes    | No                |

**Legacy (still available, but prefer the current row above):**

| User-facing ID      | API ID                      | Context | Input / Output per MTok |
| ------------------- | --------------------------- | ------- | ----------------------- |
| `claude-opus-4.5`   | `claude-opus-4-5`           | 200k    | ~$5 / ~$25              |
| `claude-opus-4.1`   | `claude-opus-4-1`           | 200k    | ~$5 / ~$25              |
| `claude-sonnet-4.5` | `claude-sonnet-4-5`         | 200k    | ~$3 / ~$15              |
| `claude-haiku-3.5`  | `claude-3-5-haiku-20241022` | 200k    | ~$1 / ~$5               |

### OpenAI (GPT-5.4 family)

| User-facing ID | API ID         | Context | Vision |
| -------------- | -------------- | ------- | ------ |
| `gpt-5.4`      | `gpt-5.4`      | 1M      | Yes    |
| `gpt-5.4-mini` | `gpt-5.4-mini` | 400k    | Yes    |
| `gpt-5.4-nano` | `gpt-5.4-nano` | 400k    | Yes    |

### Google (Gemini 3.x previews + 2.5 stable)

**Preview (Gemini 3.x):**

| User-facing ID          | API ID                          | Vision |
| ----------------------- | ------------------------------- | ------ |
| `gemini-3.1-pro`        | `gemini-3.1-pro-preview`        | Yes    |
| `gemini-3-flash`        | `gemini-3-flash-preview`        | Yes    |
| `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite-preview` | Yes    |

**Stable (Gemini 2.5):**

| User-facing ID          | API ID                  | Vision |
| ----------------------- | ----------------------- | ------ |
| `gemini-2.5-pro`        | `gemini-2.5-pro`        | Yes    |
| `gemini-2.5-flash`      | `gemini-2.5-flash`      | Yes    |
| `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | Yes    |

All 17 models support PDF content blocks, so any of them can drive stage 4. Speed and price are the real differentiators.

## Per-stage recommendations

Each stage puts different pressure on the model. Matching the model to the pressure is how you keep quality up and costs down.

**`filterModel` — fast, cheap, directional.** Stage 2 only needs three-bucket triage with a short justification. The prompt is ~50–150 tokens per paper and you'll call it on every paper fetched, so optimise for throughput and cost.

- Good picks: `gemini-2.5-flash-lite`, `gemini-3.1-flash-lite`, `claude-haiku-4.5`, `gpt-5.4-nano`.
- Overkill: anything more expensive than Haiku. You're triaging, not deciding.

**`scoringModel` — careful, calibrated, still batch-friendly.** Stage 3 assigns a 0–10 score with a justification based on the full abstract. Calibration matters because downstream stages use these scores. Still cheap per paper, but it needs more thought than filtering.

- Good picks: `gemini-3-flash`, `claude-sonnet-4.6`, `gpt-5.4-mini`.
- Works in a pinch: Haiku 4.5 or Flash-Lite if your profile is very clear-cut.

**`postProcessingModel` — same or stronger than scoringModel.** Stage 3.5 compares top papers head-to-head, so calibration matters more than raw throughput. Most users set it to the same model as `scoringModel`.

**`pdfModel` — quality-sensitive, vision-capable, the most expensive slot.** Stage 4 reads full PDFs (figures, equations, tables) and writes the structured deep analysis that ends up in the briefing. Spending more usually pays off here.

- Good picks: `gemini-3.1-pro`, `claude-opus-4.7`, `claude-sonnet-4.6`, `gpt-5.4`.
- Budget fallback: `gemini-3-flash` or `gemini-2.5-pro` if you're cost-constrained.

**`briefingModel` — editorial judgment + long context.** Stage 5 writes the executive summary, themes, and paper cards. It needs to hold your profile, the day's papers' quick summaries + deep analyses, and recent briefing history in one context. Quality here correlates with what the user actually reads.

- Good picks: `gemini-3.1-pro`, `claude-opus-4.7`, `claude-sonnet-4.6`, `gpt-5.4`.
- Budget fallback: `gemini-3-flash` works if you don't mind slightly less polished prose.

## Three example configurations

Per-paper cost estimates are rough (token counts vary with profile length and abstract length). Briefing-level costs assume 10 papers in the final round.

### Budget (Google Flash-Lite + Flash)

All-Google, preview models, cheapest realistic path. Good for high-volume categories where you're willing to accept slightly rougher briefings.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-2.5-flash-lite` |
| `scoringModel`        | `gemini-2.5-flash`      |
| `postProcessingModel` | `gemini-2.5-flash`      |
| `pdfModel`            | `gemini-3-flash`        |
| `briefingModel`       | `gemini-3-flash`        |

**Ballpark cost for a 50-paper run, 10 into deep analysis, 1 briefing:** ~$0.30–0.80.

### Balanced (Aparture default)

Gemini Flash-Lite for triage, Gemini 3 Flash for scoring, Gemini 3.1 Pro for the expensive stages. This is what `DEFAULT_CONFIG` ships with.

| Slot                  | Model                   |
| --------------------- | ----------------------- |
| `filterModel`         | `gemini-2.5-flash-lite` |
| `scoringModel`        | `gemini-3-flash`        |
| `postProcessingModel` | `gemini-3-flash`        |
| `pdfModel`            | `gemini-3.1-pro`        |
| `briefingModel`       | `gemini-3.1-pro`        |

**Ballpark cost for a 50-paper run, 10 into deep analysis, 1 briefing:** ~$0.80–2.00.

### Premium (Claude throughout)

All-Anthropic. Haiku 4.5 for triage, Sonnet 4.6 for scoring, Opus 4.7 for deep analysis and briefing. The briefing stage benefits most from Opus's adaptive thinking (see below).

| Slot                  | Model               |
| --------------------- | ------------------- |
| `filterModel`         | `claude-haiku-4.5`  |
| `scoringModel`        | `claude-sonnet-4.6` |
| `postProcessingModel` | `claude-sonnet-4.6` |
| `pdfModel`            | `claude-opus-4.7`   |
| `briefingModel`       | `claude-opus-4.7`   |

**Ballpark cost for a 50-paper run, 10 into deep analysis, 1 briefing:** ~$3.00–8.00.

::: tip Anthropic prompt caching
Aparture enables Anthropic's prompt caching automatically on every Anthropic call. On runs that share a profile, repeated-prefix cost drops substantially — expect the second run of the day to cost noticeably less than the first. Watch the terminal for `[anthropic cache] read=N create=N` lines to confirm cache hits.
:::

## Adaptive thinking on Anthropic

Claude Opus 4.7 supports **adaptive thinking** — the model allocates more internal reasoning tokens for complex tasks and fewer for straightforward ones. Aparture passes `thinking: {type: "adaptive"}` on all Anthropic calls, so when you pick Opus 4.7 you get it automatically.

**What it does in practice.** On hard synthesis tasks (ambiguous themes, dense papers, conflicting signals), Opus 4.7 takes longer and produces better-reasoned output. On simple tasks it behaves like Opus 4.6.

**When it matters.** Primarily for `briefingModel` and `pdfModel`, where you're asking for editorial judgment or structured deep analysis. Less impactful for the filter or scoring stages, where decisions are more mechanical.

**Cost implication.** Thinking tokens count against your output-token bill, so Opus 4.7 runs can cost noticeably more than Opus 4.6 on the same inputs. The quality difference usually justifies it for the briefing.

Aparture sets `maxTokens: 16000` by default for Anthropic calls to give thinking room to breathe.

## Mixing providers across stages

Nothing requires you to stick with one provider. A common pattern is:

- **Google for the cheap stages** (`filterModel`, `scoringModel`), because Flash and Flash-Lite are hard to beat on cost.
- **Claude Opus or GPT-5.4 for the expensive stages** (`pdfModel`, `briefingModel`) for quality.

That gets you most of Google's throughput advantage on the volumes that matter for cost, and most of Anthropic or OpenAI's quality on the stages that matter for output.

**Trade-off to know about.** Each provider needs its own API key in `.env.local`. If you mix three providers, you need all three keys. The auth check in each API route reads the env-var key matching the chosen model's provider, so a missing key only breaks the stage using that provider's model.

## When the previews change

Gemini 3.x models are currently marked `-preview` in their API IDs. The user-facing IDs (`gemini-3.1-pro`, `gemini-3-flash`, `gemini-3.1-flash-lite`) will stay stable when Google graduates them, but the API IDs will change. `utils/models.js` handles the mapping, so upgrades are a one-file change.

---

**Snapshot taken:** 2026-04-17. Model lineup and pricing from `utils/models.js`. Check provider docs for current prices before making large-volume decisions:

- Anthropic: [platform.claude.com/docs/en/docs/about-claude/models](https://platform.claude.com/docs/en/docs/about-claude/models)
- OpenAI: [developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models)
- Google: [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)

## Next steps

- [The pipeline →](/concepts/pipeline) — see which stage each slot drives.
- [API keys →](/getting-started/api-keys) — set up the keys you'll need for the providers you chose.
- [Tuning the pipeline →](/using/tuning-the-pipeline) — adjust thresholds, batch sizes, and review gates alongside your model choices.
