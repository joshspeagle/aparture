# Google (Gemini) API key

Running Aparture with Gemini models requires a Google AI Studio API key stored in `.env.local`. Google is the simplest provider to start with because every default model slot in Aparture uses a Gemini model covered by Google's free tier.

Before you start, note how Google's free tier and API key restrictions work:

- **Free-tier coverage for all defaults:** Gemini 3.5 Flash-Lite, 3.6 Flash, and 3.8 Flash run free of charge within Google's daily request quotas, while only the optional Gemini 4 Argon upgrade requires a paid billing account.
- **API restriction required on older standard keys:** The Gemini API rejects unrestricted legacy `AIza...` keys, whereas new auth keys created in AI Studio work immediately as issued (see §2 if you are reusing an older key).

## 1. Sign up

Open [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account. No credit card is required to use the free tier.

## 2. Create an API key

1. Sign in to Google AI Studio and accept the terms of service on your first visit.
2. Click **Create API key**.
3. Select an existing Google Cloud project or let AI Studio create a new one (projects without a linked billing account remain on the free tier).
4. Copy the generated key.

Since 2026-05-28, AI Studio issues **auth keys** bound to a Google Cloud service account, which work with Aparture immediately without additional configuration.

Keys created prior to that change are **standard keys** (prefixed with `AIza`). Because the Gemini API rejects requests from unrestricted standard keys, any key labeled **Unrestricted** in AI Studio must be restricted to the Gemini API:

1. Open the API keys page in Google AI Studio.
2. Hover over the **Unrestricted** label on your key and click **Add restrictions**.
3. Select **Restrict to Gemini API only**.
4. Click **Restrict key**.

Updating key restrictions requires the `apikeys.keys.update` IAM permission (included in the API Keys Admin and Editor roles); if your account cannot modify the existing key, create a new key instead.

Paste your key into `.env.local` exactly as AI Studio displays it.

## 3. Add to `.env.local`

Open `.env.local` in the Aparture repository root and add the key under `GOOGLE_AI_API_KEY` without quotes or spaces around `=`:

```bash
GOOGLE_AI_API_KEY=your-gemini-api-key
```

The environment variable name is `GOOGLE_AI_API_KEY` (not `GEMINI_API_KEY` or `GOOGLE_API_KEY`). Restart `npm run dev` if the server is already running so Next.js loads the updated file.

If you have not set `ACCESS_PASSWORD` in `.env.local` yet, follow the instructions on the [install page](/getting-started/install#_3-set-a-local-access-password), because the web UI requires a password to log in.

## 4. Verify

Because Aparture's default model slots all use Google Gemini models, you can verify your setup immediately after restarting the server:

1. Start or restart `npm run dev` and log in to the web UI.
2. In the Control Panel, expand **System Tests** and run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free), which calls the Gemini API's free `countTokens` endpoint for each configured model to verify your key and model access before spending any tokens.
3. Run the Dry Run followed by the [Minimal API Test](/getting-started/verify-setup).

On a free-tier project, the Minimal API Test costs $0. On a paid project using the default models, the five-paper test costs roughly $0.20 at the promotional rates available through 2026-12-31 (or ~$0.40 at standard list pricing).

If `GOOGLE_AI_API_KEY` is unset or misspelled in `.env.local`, the activity log reports `no API key for google: set GOOGLE_AI_API_KEY in .env.local and restart the server`. If the key is malformed, revoked, or unrestricted, the log displays Google's error message directly.

## 5. Recommended models

You can configure each stage's model independently in Settings (see [Model selection](/concepts/model-selection)). For an all-Google configuration, Aparture's built-in defaults already match the recommended lineup:

| Stage                                   | Model                   |
| --------------------------------------- | ----------------------- |
| Filter (`filterModel`)                  | `gemini-3.5-flash-lite` |
| Scoring (`scoringModel`)                | `gemini-3.6-flash`      |
| Post-processing (`postProcessingModel`) | `gemini-3.6-flash`      |
| PDF analysis (`pdfModel`)               | `gemini-3.8-flash`      |
| Briefing (`briefingModel`)              | `gemini-3.8-flash`      |
| Quick summary (`quickSummaryModel`)     | `gemini-3.5-flash-lite` |
| Podcast outline (`notebookLMModel`)     | `gemini-3.8-flash`      |

You can also adjust the default lineup for higher reasoning capacity or lower cost:

- **Higher synthesis and reading capacity (`gemini-4-argon`):** Assign `gemini-4-argon` to `pdfModel` and `briefingModel` on a paid project. Argon costs roughly 2.7 times as much as 3.8 Flash, increasing the 100-paper reference run below from ~$1.66 to ~$3.93 at list price.
- **Lowest-cost filtering (`gemini-3.1-flash-lite`):** Assigning `gemini-3.1-flash-lite` ($0.25 / $1.50 per MTok, with earliest deprecation listed as May 2027) to `filterModel` and `quickSummaryModel` trims roughly two cents from the reference run.
- **Using `gemini-3.8-flash` for scoring:** Because `gemini-3.6-flash` and `gemini-3.8-flash` share the same per-token price, switching `scoringModel` to 3.8 Flash changes scoring behavior at equal paid cost, though on the free tier sharing one model across more stages consumes that model's daily request quota faster.

Legacy `gemini-2.5-*` models remain in the registry for existing projects, as Google restricts Gemini 2.5 access on newly created accounts.

## 6. Cost estimate

### Per-model pricing

Gemini models bill per million tokens (MTok) separately for input and output. Because Gemini 3.x and 4 models use thinking by default and Google bills thinking tokens (`thoughtsTokenCount`) at the output rate, Aparture includes thinking tokens in its usage accounting.

Paid-tier pricing for all Gemini models in Aparture's registry (for text prompts up to 200K tokens) is listed below:

| Model                                                    | Input ($/MTok) | Output ($/MTok) | Promotional price                 | Free tier |
| -------------------------------------------------------- | -------------: | --------------: | --------------------------------- | --------- |
| `gemini-4-argon`                                         |          $4.00 |          $20.00 | $2.00 / $10.00 through 2026-11-30 | No        |
| `gemini-3.8-flash` (default PDF + briefing)              |          $1.50 |           $7.50 | $0.75 / $3.75 through 2026-12-31  | Yes       |
| `gemini-3.5-flash-lite` (default filter + quick summary) |          $0.30 |           $2.50 |                                   | Yes       |
| `gemini-3.6-flash` (default scoring + post-processing)   |          $1.50 |           $7.50 | $0.75 / $3.75 through 2026-12-31  | Yes       |
| `gemini-3.1-flash-lite`                                  |          $0.25 |           $1.50 |                                   | Yes       |
| `gemini-2.5-pro` (legacy)                                |          $1.25 |          $10.00 |                                   | Legacy    |
| `gemini-2.5-flash` (legacy)                              |          $0.30 |           $2.50 |                                   | Legacy    |
| `gemini-2.5-flash-lite` (legacy)                         |          $0.10 |           $0.40 |                                   | Legacy    |

Aparture's cost estimator automatically applies active promotional prices through their expiration dates and reverts to list prices afterward.

The October 2026 registry refresh replaced `gemini-3.5-flash`, `gemini-3-flash` preview, and `gemini-3.1-pro` preview with `gemini-3.6-flash`, `gemini-3.8-flash`, and `gemini-4-argon`, respectively. Because `gemini-4-argon` requires a paid billing account, verify your model slots if a saved configuration previously used the 3.1 Pro preview.

**Implicit caching:** Google applies automatic prefix caching on Gemini 2.5 and newer models for prompts above 4,096 tokens without requiring explicit cache objects. The planning tables below report uncached list and promotional rates.

### Worked calculation: 100 input papers (default lineup, paid tier)

In this reference scenario, 100 papers are fetched, 50 pass the filter for scoring and post-processing, and 20 undergo full-PDF analysis (below the default cap of 30). Token counts reflect the application's planning estimates prior to thinking tokens:

| Stage                       | Model                 | Input tokens | Output tokens | Cost at list price                 |
| --------------------------- | --------------------- | ------------ | ------------- | ---------------------------------- |
| Filter (100 abstracts)      | Gemini 3.5 Flash-Lite | ~50,000      | ~10,000       | 50k × $0.30 + 10k × $2.50 = $0.04  |
| Scoring (50 abstracts)      | Gemini 3.6 Flash      | ~40,000      | ~10,000       | 40k × $1.50 + 10k × $7.50 = $0.14  |
| Post-processing (50 papers) | Gemini 3.6 Flash      | ~35,000      | ~6,000        | 35k × $1.50 + 6k × $7.50 = $0.10   |
| PDF analysis (20 papers)    | Gemini 3.8 Flash      | ~600,000     | ~30,000       | 600k × $1.50 + 30k × $7.50 = $1.13 |
| Quick summaries (20)        | Gemini 3.5 Flash-Lite | ~40,000      | ~6,000        | 40k × $0.30 + 6k × $2.50 = $0.03   |
| Briefing synthesis + audit  | Gemini 3.8 Flash      | ~108,000     | ~10,000       | 108k × $1.50 + 10k × $7.50 = $0.24 |
| **Total, list price**       |                       |              |               | **~$1.66**                         |
| **Total, promotional**      |                       |              |               | **~$0.86** (Flash at half price)   |

Individual rows are rounded to the nearest cent, while totals are summed prior to rounding. After a run completes, the Download Report card displays the exact token count and cost including thinking tokens.

### Scaling to other input volumes

Filtering and abstract scoring scale linearly with harvested paper volume, while Stage 4 PDF analysis is bounded by the default cap of 30 papers:

- **50 papers in** (10 PDFs): ~$0.86 list, ~$0.45 promotional.
- **100 papers in** (20 PDFs): ~$1.66 list, ~$0.86 promotional (the reference calculation above).
- **250 papers in** (30 PDFs, capped): ~$2.59 list, ~$1.36 promotional, where PDF analysis plateaus at 30 papers while filtering and scoring scale with input volume.

### Free tier

On a Google Cloud project without a linked billing account, all default Gemini models run at zero cost within Google's free-tier quotas:

- **Per-project daily request caps:** Each model enforces its own requests-per-day quota at the Google Cloud project level (resetting at midnight Pacific time), which easily covers a 25-paper run and can bind during a 250-paper run.
- **Live quota inspection:** Sign in to [aistudio.google.com](https://aistudio.google.com/) to inspect the exact rate limits assigned to your project.
- **Data-usage policy:** Google uses free-tier prompts and responses to improve its products, whereas paid-tier traffic is excluded; link a billing account if your research profile contains private notes.

## 7. When to add billing

Link a Cloud Billing account to your Google Cloud project when any of the following conditions apply:

- You want to run `gemini-4-argon`, which is available only on paid tiers.
- Your daily runs exceed the free tier's requests-per-day or requests-per-minute quotas.
- You want your prompts and profile excluded from Google's product-improvement training pipeline.
- You want higher rate limits so you can increase Stage 4 PDF concurrency.

### Upgrading to Tier 1

To move from the free tier to paid Tier 1, link a Cloud Billing account to your project and make a prepayment of at least $5 following Google's [billing documentation](https://ai.google.dev/gemini-api/docs/billing).

Google enforces monthly spend caps by billing tier ($250/month on Tier 1 and $2,000/month on Tier 2, which unlocks after $100 in cumulative spend and three days since the initial payment), and you can also configure a project-level spend limit in AI Studio. At Aparture's default settings, a daily 250-paper run costs roughly $78/month at full list price, fitting comfortably within Tier 1.

## 8. Common gotchas

- **Forgetting to restart `npm run dev`:** Restart the development server whenever you edit `.env.local` so Next.js reloads environment variables.
- **Misspelled environment variable name:** The variable must be named `GOOGLE_AI_API_KEY` (not `GEMINI_API_KEY` or `GOOGLE_API_KEY`).
- **All Google calls fail on an older `AIza...` key:** Restrict the legacy standard key to the Gemini API in AI Studio (§2) or generate a new key.
- **`gemini-4-argon` fails on a free project:** Argon requires a paid billing tier; switch the slot back to `gemini-3.8-flash` or enable billing.
- **`gemini-2.5-*` fails on a new account:** Google restricts legacy 2.5 models to accounts with prior 2.5 usage; select a current `gemini-3.x` model instead.
- **Rate-limit pauses on large free-tier runs:** When a Flash-Lite stage's batch count and concurrency approach ~60 requests per minute, Aparture logs a pre-flight notice and automatically pauses and retries on 429 responses; lower the stage concurrency in Settings or upgrade to Tier 1.
- **Speeding up PDF analysis on paid tiers:** Paid Tier 1 quotas support higher concurrency than the default of 3 parallel PDF calls; raise **Parallel PDF Calls** in Settings to 5–8 ([tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-calls)).

## Next

Once your key is configured and the server is restarted, proceed to [Verify your setup](/getting-started/verify-setup).

---

_Pricing snapshot taken 2026-10-17 from the model registry. Verify current pricing at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), API key rules at [ai.google.dev/gemini-api/docs/api-key](https://ai.google.dev/gemini-api/docs/api-key), and project rate limits at [aistudio.google.com](https://aistudio.google.com/)._
