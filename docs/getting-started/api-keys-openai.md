# OpenAI (GPT) API key

Running Aparture with GPT models requires an OpenAI API key stored in `.env.local`. If you have not chosen a provider yet, [Google AI](/getting-started/api-keys-google) offers the fastest initial setup because Aparture's default model slots use Gemini models covered by Google's free tier.

Before you start, note how OpenAI handles prepaid billing and prompt caching:

- **Prepaid API credit is required:** OpenAI API usage is billed separately from ChatGPT subscriptions and does not include a free trial balance, so every API call returns `429 insufficient_quota` until you add prepaid credit to your organization.
- **Automatic prompt caching:** OpenAI caches repeated prompt prefixes of 1,024 tokens or more automatically without requiring extra configuration.

## 1. Sign up

Open [platform.openai.com/signup](https://platform.openai.com/signup) and create an account using an email address or a Google, Microsoft, or Apple login. OpenAI verifies both your email address and a phone number during onboarding, and you can use `"Personal"` as the organization name.

## 2. Add billing

Configure billing before testing your key so your organization has a positive credit balance:

1. In the OpenAI developer console, open **Settings → Billing**.
2. Add a payment method.
3. Purchase at least $5 in prepaid credit, which is sufficient for several test and daily runs.

Purchasing $5 in credit moves your organization into the Build usage tier (with a $500 monthly limit). You can also configure a monthly budget cap and email alert threshold under your organization's limits page ($10–$25 per month with an alert at 50% is a practical starting setting).

## 3. Create an API key

1. Navigate to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Click **Create new secret key**.
3. Give the key a descriptive name such as `aparture-local` and keep the default project and permissions.
4. **Copy the key immediately when it appears.** OpenAI displays the full secret key only once; if you close the dialog before copying it, delete the key and create a new one.

Current project keys begin with `sk-proj-` (while legacy user keys begin with `sk-`), and Aparture accepts both formats.

## 4. Add to `.env.local`

Open `.env.local` in the Aparture repository root and add the key on its own line without quotes or spaces around `=`:

```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

Restart `npm run dev` if the server is already running so Next.js loads the updated `.env.local` file.

If you have not set `ACCESS_PASSWORD` in `.env.local` yet, follow the instructions on the [install page](/getting-started/install#_3-set-a-local-access-password), because the web UI requires a password to log in.

## 5. Verify

Because Aparture's default model slots all point to Google Gemini models, switch at least one slot to a GPT model in Settings before testing your OpenAI key:

1. Start or restart `npm run dev` and log in to the web UI.
2. Open the **Settings** panel.
3. Change the `pdfModel` slot to `gpt-6.1-sol` so Stage 4 routes through OpenAI.
4. In the Control Panel, run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free) (which verifies your OpenAI key and model access against the models metadata endpoint at zero cost) and then run the [Minimal API Test](/getting-started/verify-setup) to exercise a full structured-output request.

On the five-paper Minimal API Test (with `gpt-6.1-sol` on `pdfModel` and the remaining slots on their Google defaults), expect a base cost of roughly $0.50 plus reasoning tokens.

If `OPENAI_API_KEY` is unset or misspelled in `.env.local`, the activity log reports `no API key for openai: set OPENAI_API_KEY in .env.local and restart the server`. A malformed or revoked key returns `401 invalid_api_key`, an account with zero prepaid balance returns `429 insufficient_quota`, and a restricted model returns `model_not_found`.

## 6. Recommended models

You can configure each pipeline stage's model independently in Settings (see [Model selection](/concepts/model-selection)). The table below lists the recommended all-OpenAI lineup:

| Stage                               | Model         |
| ----------------------------------- | ------------- |
| Filter (`filterModel`)              | `gpt-6-luna`  |
| Scoring (`scoringModel`)            | `gpt-6.1-sol` |
| PDF analysis (`pdfModel`)           | `gpt-6.1-sol` |
| Briefing (`briefingModel`)          | `gpt-6.1-sol` |
| Quick summary (`quickSummaryModel`) | `gpt-6-luna`  |
| Podcast outline (`notebookLMModel`) | `gpt-6.1-sol` |

::: warning Post-processing stays on Google unless you change it
Stage 3.5 post-processing uses `postProcessingModel`, which defaults to `gemini-3.6-flash` independently of your other slot choices. If you do not have a Google API key configured, select a GPT model under **Review Model** inside **Enable Post-Processing** in Settings (or disable post-processing) so Stage 3.5 batches do not fail.
:::

You can adjust the recommended lineup for higher synthesis quality or lower PDF cost:

- **Higher synthesis capacity on the briefing (`gpt-6-astra`):** `gpt-6-astra` costs five times as much per token as `gpt-6.1-sol`, but because `briefingModel` runs once per briefing (plus the audit), assigning it to `briefingModel` increases the 100-paper reference run below from ~$2.11 to ~$3.37.
- **Lower cost on PDF analysis (`gpt-6-luna`):** Assigning `gpt-6-luna` to `pdfModel` reduces the 20-paper PDF stage on the reference run from ~$1.50 to under $0.10; inspect a few generated full reports to confirm that its technical depth fits your needs.

## 7. Cost estimate

### Per-model pricing

OpenAI bills per million tokens (MTok) separately for input and output, with reasoning tokens billed at the output rate.

Standard-tier pricing for all OpenAI models in Aparture's registry (for prompts up to 272K tokens) is listed below:

| Model                                              | Input ($/MTok) | Cached input ($/MTok) | Output ($/MTok) |
| -------------------------------------------------- | -------------: | --------------------: | --------------: |
| `gpt-6-astra`                                      |         $10.00 |                 $1.00 |          $50.00 |
| `gpt-6.1-sol` (recommended scoring, PDF, briefing) |          $2.00 |                 $0.10 |          $10.00 |
| `gpt-6-luna` (recommended filter + quick summary)  |          $0.10 |                 $0.01 |           $0.50 |
| `gpt-5.6-sol`\*                                    |          $5.00 |                 $0.40 |          $30.00 |
| `gpt-5.6-terra`                                    |          $2.00 |                 $0.20 |          $12.00 |
| `gpt-5.6-luna`                                     |          $0.20 |                 $0.02 |           $1.20 |

\* `gpt-5.6-sol` carries a promotional rate of $4 / $20 per MTok through at least 2026-11-21, which Aparture's cost estimator uses automatically until that date.

The October 2026 registry refresh replaced `gpt-5.4`, `gpt-5.4-mini`, and `gpt-5.4-nano`, migrating saved configurations automatically to `gpt-6.1-sol` (from `gpt-5.4`) and `gpt-6-luna` (from `gpt-5.4-mini` and `gpt-5.4-nano`) on startup.

**Automatic prompt caching:** OpenAI automatically caches repeated prompt prefixes of 1,024 tokens or more for 30 minutes after each use, billing cached input tokens at the middle column's rate. Because the shared rubric and profile prefix represents a smaller fraction of each call than the variable abstracts or PDF content, caching provides a modest discount; the worked estimates below report uncached list prices.

### Worked calculation: 100 input papers (OpenAI lineup)

In this reference scenario, 100 papers are fetched, 50 pass the filter for scoring and post-processing, and 20 undergo full-PDF analysis (below the default cap of 30). Token counts reflect the application's planning estimates prior to reasoning tokens:

| Stage                       | Model             | Input tokens | Output tokens | Cost at list price                |
| --------------------------- | ----------------- | ------------ | ------------- | --------------------------------- |
| Filter (100 abstracts)      | GPT-6 Luna        | ~50,000      | ~10,000       | 50k × $0.10 + 10k × $0.50 = $0.01 |
| Scoring (50 abstracts)      | GPT-6.1 Sol       | ~40,000      | ~10,000       | 40k × $2 + 10k × $10 = $0.18      |
| Post-processing (50 papers) | Gemini 3.6 Flash† | ~35,000      | ~6,000        | 35k × $1.50 + 6k × $7.50 = $0.10  |
| PDF analysis (20 papers)    | GPT-6.1 Sol       | ~600,000     | ~30,000       | 600k × $2 + 30k × $10 = $1.50     |
| Quick summaries (20)        | GPT-6 Luna        | ~40,000      | ~6,000        | 40k × $0.10 + 6k × $0.50 = $0.01  |
| Briefing synthesis + audit  | GPT-6.1 Sol       | ~108,000     | ~10,000       | 108k × $2 + 10k × $10 = $0.32     |
| **Total, list price**       |                   |              |               | **~$2.11**                        |

† Disabling Stage 3.5 post-processing when running without a Google key reduces the reference total to roughly $2.01.

Individual rows are rounded to the nearest cent. After a run completes, the Download Report card displays the exact cost from the tokens used, including reasoning tokens.

### Scaling to other input volumes

Filtering and abstract scoring scale linearly with harvested paper volume, while Stage 4 PDF analysis is bounded by the default cap of 30 papers:

- **50 papers in** (10 PDFs): ~$1.10 at list price.
- **100 papers in** (20 PDFs): ~$2.11 at list price (the reference calculation above).
- **250 papers in** (30 PDFs, capped): ~$3.26 at list price, where PDF analysis plateaus at 30 papers while filtering and scoring scale with input volume.

## 8. Common gotchas

- **Forgetting to restart `npm run dev`:** Restart the development server whenever you edit `.env.local` so Next.js reloads environment variables.
- **Minimal API Test still calls Google:** Switch at least one model slot in Settings to a GPT model before running the test.
- **Stage 3.5 fails without a Google key:** Select a GPT model as the **Review Model** under **Enable Post-Processing** in Settings, or turn post-processing off.
- **`429 insufficient_quota` on the first call:** Your OpenAI organization has no prepaid credit balance; add at least $5 under **Settings → Billing**.
- **`model_not_found` error:** Your organization does not have access to the selected model ID; check available models in the OpenAI dashboard or pick another GPT model in Settings.
- **Trailing whitespace or CRLF in `.env.local`:** Save `.env.local` with LF line endings and no trailing spaces after the key.
- **Checking rate limits:** Inspect your live per-model rate limits in the OpenAI console under **Settings → Organization → Limits**.
- **Increasing Stage 4 PDF parallelism:** Because OpenAI does not require a single-worker cache warmup call, all Stage 4 workers launch simultaneously; if your tier rate limits allow it, you can raise **Parallel PDF Calls** in Settings to 5–8 ([tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-calls)).

## Next

Once your key is configured and the server is restarted, proceed to [Verify your setup](/getting-started/verify-setup).

---

_Pricing snapshot taken 2026-10-17 from the model registry. Verify current pricing at [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) and live organization limits at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits)._
