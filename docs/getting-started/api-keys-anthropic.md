# Anthropic (Claude) API key

Running Aparture with Claude models requires an Anthropic API key stored in `.env.local`. If you have not chosen a provider yet, [Google AI](/getting-started/api-keys-google) offers the fastest initial setup because Aparture's default model slots use Gemini models covered by Google's free tier.

Before you start, note how Anthropic handles starter credits and prompt caching:

- **One-time starter credit:** New Anthropic accounts receive an initial ~$5 credit without requiring a credit card, which covers several small Aparture runs.
- **Explicit prompt caching:** Aparture marks the rubric template and your research profile as cacheable on Anthropic calls, so subsequent requests within the five-minute cache window read that prefix at a fraction of the standard input price.

## 1. Sign up

Open [platform.claude.com](https://platform.claude.com/) and create an account using Google, GitHub, or an email address.

Anthropic requires SMS verification during signup and rejects VoIP numbers such as Google Voice. Because the verified phone number cannot be changed later, register with a number you expect to keep long-term.

## 2. Create an API key

After signing in, navigate to **Settings → API Keys → Create Key**.

Assign the key a descriptive label such as `aparture-local` so you can identify it in usage logs, and optionally set a monthly spend cap ($20–$50 per month is a practical limit for personal daily use).

**Copy the key immediately when it is displayed.** Anthropic displays the full secret key only once at creation time and shows only a masked prefix afterward; if you close the dialog before copying the key, revoke it and generate a new one.

Anthropic API keys begin with `sk-ant-api03-`.

## 3. Add to `.env.local`

Open `.env.local` in the Aparture repository root and add the key on its own line without quotes or spaces around `=`:

```bash
CLAUDE_API_KEY=sk-ant-api03-your-actual-key-here
```

Restart `npm run dev` if the development server is already running so Next.js loads the updated `.env.local` file.

If you have not set `ACCESS_PASSWORD` in `.env.local` yet, follow the instructions on the [install page](/getting-started/install#_3-set-a-local-access-password), because the web UI requires a password to log in.

## 4. Verify

Because Aparture's default model slots use Google Gemini models, you must assign at least one slot to a Claude model in Settings before testing your Anthropic key:

1. Start or restart `npm run dev` and log in to the web UI.
2. Open the **Settings** panel.
3. Change the `pdfModel` slot to `claude-sonnet-5.5` or `claude-opus-5.5` so the PDF analysis stage routes through Anthropic.
4. In the Control Panel, run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free), which calls Anthropic's `count_tokens` endpoint at zero cost to validate your key, model ID, and request syntax, and then run the [Minimal API Test](/getting-started/verify-setup).

On the five-paper Minimal API Test (with the remaining slots on their Google defaults), expect a base cost of roughly $0.50 with `claude-sonnet-5.5` on `pdfModel` or $0.90 with `claude-opus-5.5`, plus adaptive-thinking output tokens.

If `CLAUDE_API_KEY` is unset or misspelled in `.env.local`, the activity log reports `no API key for anthropic: set CLAUDE_API_KEY in .env.local and restart the server`. If the key is malformed or revoked, the log displays Anthropic's authentication error message.

## 5. Recommended models

You can configure each pipeline stage's model independently in Settings (see [Model selection](/concepts/model-selection) for how each slot behaves). The table below shows the recommended all-Anthropic lineup:

| Stage                               | Model               |
| ----------------------------------- | ------------------- |
| Filter (`filterModel`)              | `claude-haiku-5.5`  |
| Scoring (`scoringModel`)            | `claude-sonnet-5.5` |
| PDF analysis (`pdfModel`)           | `claude-opus-5.5`   |
| Briefing (`briefingModel`)          | `claude-opus-5.5`   |
| Quick summary (`quickSummaryModel`) | `claude-haiku-5.5`  |
| Podcast outline (`notebookLMModel`) | `claude-opus-5.5`   |

::: warning Post-processing stays on Google unless you change it
Stage 3.5 post-processing uses `postProcessingModel`, which defaults to `gemini-3.6-flash` independently of the other model slots. If you do not have a Google API key configured, select a Claude model under **Review Model** inside **Enable Post-Processing** in Settings (or disable post-processing) so Stage 3.5 batches do not fail.
:::

To reduce daily PDF costs by half, switch `pdfModel` from `claude-opus-5.5` to `claude-sonnet-5.5`, which lowers the 100-paper reference run below from roughly $3.93 to $2.43. For maximum editorial depth on the briefing, `claude-fable-5.1` can be used on `briefingModel` at 2.5 times the price of Opus 5.5 (bringing the reference run to roughly $4.87), subject to the data-retention requirement noted below.

## 6. Cost estimate

### Per-model pricing

Anthropic bills per million tokens (MTok) with separate rates for input tokens (prompt template, profile, and paper content) and output tokens (the structured response **plus adaptive-thinking tokens**, which are enabled on every current Claude model).

List pricing for all Anthropic models in Aparture's registry is shown below:

| Model                                                     | Context | Input ($/MTok) | Output ($/MTok) |
| --------------------------------------------------------- | ------- | -------------: | --------------: |
| `claude-fable-5.1`†                                       | 1M      |            $10 |             $50 |
| `claude-opus-5.5` (recommended PDF + briefing)            | 1M      |             $4 |             $20 |
| `claude-sonnet-5.5` (recommended scoring)                 | 1M      |             $2 |             $10 |
| `claude-haiku-5.5`\* (recommended filter + quick summary) | 1M      |          $0.10 |           $0.50 |
| `claude-fable-5`†                                         | 1M      |            $10 |             $50 |
| `claude-opus-5`                                           | 1M      |             $5 |             $25 |
| `claude-sonnet-5`                                         | 1M      |             $2 |             $10 |
| `claude-haiku-4.5`                                        | 200k    |             $1 |              $5 |

\* `claude-haiku-5.5` bills at $0.10 / $0.50 per MTok for prompts up to 100K tokens, and at $0.50 / $2.50 per MTok for prompts above 100K tokens (which can occur if Haiku is assigned to `pdfModel` on long manuscripts).

† `claude-fable-5.1` and `claude-fable-5` always run with adaptive thinking enabled and **require your Anthropic organization's data retention policy to be set to 30 days**; under zero-data-retention settings, every request fails with HTTP 400. Because of their per-token cost, Fable models are best suited for the single-call `briefingModel` slot rather than per-paper PDF analysis.

The October 2026 registry update retired Opus 4.6–4.8 and Sonnet 4.6, migrating saved configurations automatically to `claude-opus-5.5` and `claude-sonnet-5.5` when the application loads.

**Prompt caching and parallel warmup apply automatically to repeat calls** and reduce actual spend below list price:

- **Prompt caching:** Aparture marks the stable prefix of each request (the rubric template and your research profile) with `cache_control: {type: 'ephemeral'}`. The first call writes the cache entry at a small surcharge, and subsequent calls within ~5 minutes read the cached prefix at a reduced input rate, while paper abstracts and PDF bytes are billed normally.
- **Single-worker cache warmup on PDFs:** During Stage 4 PDF analysis on Anthropic models, worker 0 executes its first PDF request alone before the remaining parallel workers start so that the prompt cache entry is written once rather than duplicated across concurrent workers (see [Parallel PDF calls](/using/tuning-the-pipeline#parallel-pdf-calls)).

### Worked calculation: 100 input papers (Anthropic lineup)

In this reference scenario, 100 papers are fetched, 50 pass the quick filter for scoring and post-processing, and 20 undergo full-PDF analysis (below the default cap of 30). Token counts reflect the application's built-in planning estimates prior to adaptive-thinking tokens:

| Stage                       | Model             | Input tokens | Output tokens | Cost                              |
| --------------------------- | ----------------- | ------------ | ------------- | --------------------------------- |
| Filter (100 abstracts)      | Haiku 5.5         | ~50,000      | ~10,000       | 50k × $0.10 + 10k × $0.50 = $0.01 |
| Scoring (50 abstracts)      | Sonnet 5.5        | ~40,000      | ~10,000       | 40k × $2 + 10k × $10 = $0.18      |
| Post-processing (50 papers) | Gemini 3.6 Flash† | ~35,000      | ~6,000        | 35k × $1.50 + 6k × $7.50 = $0.10  |
| PDF analysis (20 papers)    | Opus 5.5          | ~600,000     | ~30,000       | 600k × $4 + 30k × $20 = $3.00     |
| Quick summaries (20)        | Haiku 5.5         | ~40,000      | ~6,000        | 40k × $0.10 + 6k × $0.50 = $0.01  |
| Briefing synthesis + audit  | Opus 5.5          | ~108,000     | ~10,000       | 108k × $4 + 10k × $20 = $0.63     |
| **Total, list price**       |                   |              |               | **~$3.93**                        |

† Disabling Stage 3.5 post-processing when running without a Google key reduces the reference total to roughly $3.83.

Adaptive thinking adds output tokens across all stages (most noticeably during PDF analysis and briefing synthesis); after each run completes, the Download Report card displays the cost calculated from the actual token counts returned by the API.

### Scaling to other input volumes

Filtering and abstract scoring scale linearly with harvested paper volume, whereas Stage 4 PDF analysis is bounded by the `maxDeepAnalysis` cap (default 30):

- **50 papers in** (10 PDFs): ~$2.05 at list price.
- **100 papers in** (20 PDFs): ~$3.93 at list price (the reference calculation above).
- **250 papers in** (30 PDFs, capped): ~$5.95 at list price, where PDF analysis plateaus at 30 papers while filtering and scoring scale with input count.

Consult Anthropic's [models documentation](https://platform.claude.com/docs/en/docs/about-claude/models) and [pricing page](https://claude.com/pricing) for current rates and tier limits.

## 7. Common gotchas

- **Forgetting to restart `npm run dev`:** Stop the server and start it again whenever you edit `.env.local` so Next.js reloads environment variables.
- **Minimal API Test still calls Google:** Because all default model slots use Gemini models, switch at least one slot in Settings to a Claude model before running the test.
- **Stage 3.5 fails without a Google key:** Change the **Review Model** under **Enable Post-Processing** in Settings to a Claude model or turn post-processing off.
- **Copying only the masked key preview:** Anthropic displays the full key only at creation time; if you missed it, revoke the key and generate a new one.
- **Expired starter credit:** New-account promotional credits typically expire after 14–30 days; check **Settings → Billing → Credit history** in the Anthropic console.
- **Rate-limit throttling on Tier 1 during PDF analysis:** New Tier 1 accounts have conservative tokens-per-minute caps when running 20 PDFs through Opus 5.5; switching `pdfModel` to `claude-sonnet-5.5` or reducing concurrency in Settings avoids rate-limit pauses ([tuning the pipeline](/using/tuning-the-pipeline)).
- **Initial delay on the first PDF in Stage 4:** On Anthropic slots, worker 0 completes the first PDF call before parallel workers launch so that the prompt cache is populated once for the entire stage ([Parallel PDF calls](/using/tuning-the-pipeline#parallel-pdf-calls)).

## Next

Once your key is configured and the server is restarted, proceed to [Verify your setup](/getting-started/verify-setup).

---

_Pricing snapshot taken 2026-10-17 from the model registry. Verify current pricing and tier thresholds at [platform.claude.com/docs](https://platform.claude.com/docs/en/api/overview) and [claude.com/pricing](https://claude.com/pricing)._
