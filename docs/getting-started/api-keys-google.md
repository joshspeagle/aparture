# Google (Gemini) API key

This page walks you through creating a Google AI Studio API key and wiring it into Aparture so the pipeline can call Gemini models. Google is the simplest provider to start with: every default model slot is a Gemini model, and Google's free tier covers all of them.

Two things worth knowing about Google before you start:

- **The free tier covers the defaults.** Gemini 3.5 Flash-Lite, 3.6 Flash, and 3.8 Flash are free within Google's daily request caps. Gemini 4 Argon is the one current model that needs billing.
- **Older keys may need a restriction.** The Gemini API rejects unrestricted standard keys. Keys that AI Studio creates now are a different kind and work as created; §2 covers older keys.

## 1. Sign up

Head to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with a Google account. The free tier needs no credit card.

## 2. Create an API key

1. Sign in and accept the terms of service on your first visit.
2. Click **Create API key**.
3. Pick a Google Cloud project for the key, or let AI Studio create one. A project with no billing account stays on the free tier.
4. Copy the key.

Since 2026-05-28, every key AI Studio creates is an **auth key**, bound to a Google Cloud service account. An auth key works with Aparture as created.

Older keys are **standard keys**. The Gemini API rejects requests from a standard key that has no restrictions, and a restricted one keeps working. If AI Studio labels your key **Unrestricted**:

1. Open the API keys page in AI Studio.
2. Hover over the **Unrestricted** label and click **Add restrictions**.
3. Select **Restrict to Gemini API only**.
4. Click **Restrict key**.

Changing a key's restrictions needs the `apikeys.keys.update` permission, which the API Keys Admin and Editor roles include. If you can't edit the key, create a new one instead.

Standard keys start with `AIza`. Google doesn't document the format of auth keys, so paste the key exactly as AI Studio shows it.

## 3. Add to `.env.local`

Open `.env.local` in the Aparture project root and paste the key:

```bash
GOOGLE_AI_API_KEY=your-gemini-api-key
```

The env var name is `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`. No quotes, no spaces around `=`. Restart `npm run dev` if it's already running; Next.js reads `.env.local` once at server startup.

If you haven't already set `ACCESS_PASSWORD` in the same file, see the [install page](/getting-started/install#_3-set-a-local-access-password). Both values live in `.env.local`; the web UI can't launch without a password.

## 4. Verify

Aparture's default model slots are all Google, so with the key in place and the dev server restarted you can test straight away:

1. Start (or restart) `npm run dev` and log in.
2. In the Control Panel, open **System Tests** and run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free). It calls the Gemini API's free `countTokens` method for each configured model, so a key that Google refuses should fail here, before you spend anything.
3. Run the Dry Run, then the [Minimal API Test](/getting-started/verify-setup).

On the free tier the Minimal API Test costs nothing. On a paid project with the default models, expect about $0.20 at the promotional prices through 2026-12-31 and about $0.40 at list price.

If the key is missing, the activity log shows `no API key for google: set GOOGLE_AI_API_KEY in .env.local and restart the server` (the env var is unset or misspelled). If the key is malformed, revoked, or unrestricted, Google's own error message appears instead.

## 5. Recommended models

You pick each pipeline stage's model individually in the Settings panel. See [Model selection](/concepts/model-selection) for what each slot does. For an all-Google setup, the defaults are the recommended lineup, and you don't need to change anything:

| Stage                                   | Model                   |
| --------------------------------------- | ----------------------- |
| Filter (`filterModel`)                  | `gemini-3.5-flash-lite` |
| Scoring (`scoringModel`)                | `gemini-3.6-flash`      |
| Post-processing (`postProcessingModel`) | `gemini-3.6-flash`      |
| PDF analysis (`pdfModel`)               | `gemini-3.8-flash`      |
| Briefing (`briefingModel`)              | `gemini-3.8-flash`      |
| Quick summary (`quickSummaryModel`)     | `gemini-3.5-flash-lite` |
| NotebookLM doc (`notebookLMModel`)      | `gemini-3.8-flash`      |

Changes worth considering:

- **Stronger reading.** Put `gemini-4-argon` on `pdfModel` and `briefingModel`. Argon needs a paid tier and costs about 2.7 times as much as 3.8 Flash; on the reference run below, the total goes from about $1.66 to $3.93 at list price.
- **Lower floor.** `gemini-3.1-flash-lite` is the cheapest registered Gemini model ($0.25 / $1.50). On the filter and quick-summary slots it saves about two cents on the reference run below. Google lists its earliest shutdown as May 2027.
- **3.8 Flash for scoring.** 3.6 Flash and 3.8 Flash cost the same, so this changes quality, not price. On the free tier, each model has its own limits, so putting more stages on one model uses up its daily cap sooner.

The Gemini 2.5 models are still in the registry for projects that already use them. Google now limits Gemini 2.5 to accounts that have used it before, so a new key is likely to be refused.

## 6. Cost estimate

### Per-model pricing

Gemini models bill per million tokens (MTok), separately for input and output. Gemini 3.x and 4 think by default, and Google bills thinking tokens at the output rate; Aparture counts them in its cost tracking.

Paid-tier pricing for every Gemini model in Aparture's registry, for text prompts up to 200k tokens:

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

Aparture's cost estimates use the promotional price until its end date and the list price after.

The October 2026 refresh removed `gemini-3.5-flash`, the `gemini-3-flash` preview, and the `gemini-3.1-pro` preview. Saved configs move to `gemini-3.6-flash`, `gemini-3.8-flash`, and `gemini-4-argon` respectively the next time the app loads. The last two cost more than the previews they replace, and Argon needs a paid tier, so check those slots if you were using either preview.

**Caching.** Aparture doesn't create Google cache objects. Google applies implicit caching on its own for Gemini 2.5 and newer and passes on the discount automatically, but only above a minimum prompt size (4,096 tokens on the current Flash models and Argon). The estimates on this page assume full input price.

### Worked calculation: 100 input papers (default lineup, paid tier)

Reference case: 100 fetched papers, 50 pass the filter and are scored and post-processed, 20 go through PDF analysis (below the default cap of 30). Token counts are the app's own per-paper planning estimates, and they leave out thinking tokens.

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

Rows are rounded to the cent, so the column sums a cent or two away from the totals, which are computed before rounding. Thinking adds output tokens on every row. After a run, the Download Report card shows the estimate from the tokens the run actually used.

### Scaling to other input volumes

Filter and scoring scale linearly with input volume. Stage 4 scales with how many papers you deep-analyse, and the default cap of 30 binds at higher volumes:

- **50 papers in** (10 PDFs): ~$0.86 list, ~$0.45 promotional
- **100 papers in** (20 PDFs): ~$1.66 list, ~$0.86 promotional (reference case above)
- **250 papers in** (30 PDFs, at cap): ~$2.59 list, ~$1.36 promotional. PDF analysis plateaus at the cap; filter and scoring keep growing.

### Free tier

On a project with no billing account, every default model runs free, subject to Google's rate limits:

- **Daily request caps.** Each model has its own requests-per-day cap, and caps apply per project, not per key. They reset at midnight Pacific time. A 25-paper run fits comfortably; a 250-paper run can hit a cap partway through.
- **Your limits are on the dashboard.** Google's docs don't list per-model numbers; sign in at [aistudio.google.com](https://aistudio.google.com/) to see yours.
- **Google uses free-tier prompts and responses to improve its products.** On the paid tier it doesn't. If your profile contains research notes you'd rather keep out of that, use a paid project.

## 7. When to add billing

You'll want a paid project when any of these applies:

- You want Gemini 4 Argon on any slot. It is paid only.
- Your runs hit the free tier's daily caps.
- You don't want Google to use your prompts and responses to improve its products.
- You want higher rate limits, for example to raise Stage 4 parallelism.

### Upgrading to Tier 1

Moving from the free tier to Tier 1 means linking a Cloud Billing account to the project that owns your key and prepaying at least $5. Google's [billing page](https://ai.google.dev/gemini-api/docs/billing) has the current steps.

Google caps monthly spend per billing account by tier: $250 on Tier 1, $2,000 on Tier 2. You can't change the tier cap directly, but you can request an increase. You can also set your own project-level spend cap in AI Studio (Google marks this experimental). Tier 2 requires $100 paid on the billing account and three days since the first successful payment. At the defaults, a daily 250-paper run costs about $78 a month at list price, well under the Tier 1 cap.

## 8. Common gotchas

- **Forgot to restart `npm run dev`.** Hot-reload doesn't pick up `.env.local` changes; restart the server.
- **Wrong env var name.** It's `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- **Every Google call fails on an old key.** The key is probably an unrestricted standard key. Restrict it to the Gemini API (§2) or create a new one.
- **Argon slots fail on a free project.** Gemini 4 Argon has no free tier. Set up billing, or move those slots back to `gemini-3.8-flash`.
- **Gemini 2.5 fails on a new key.** Google limits Gemini 2.5 to accounts that used it before. Switch to a 3.x model.
- **Runs slow down partway through on the free tier.** Free-tier rate limits are lower than paid ones. On large runs Aparture warns when a Flash-Lite stage's parallelism is likely to exceed 60 requests per minute; the run pauses on rate-limit errors and recovers, but slowly. Lower that stage's parallelism in Settings, or add billing.
- **Want faster PDF analysis on a paid project?** Tier 1 rate limits leave room for more than the default 3 parallel PDF calls. Raise **Parallel PDF Calls** in Settings to 5–8 ([tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-calls)).

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Pricing snapshot taken 2026-10-17 from the model registry, checked against Google's pricing page the same day. Google's pricing, free-tier policy, and billing tiers change. Verify current pricing at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), key rules at [ai.google.dev/gemini-api/docs/api-key](https://ai.google.dev/gemini-api/docs/api-key), and your rate limits at [aistudio.google.com](https://aistudio.google.com/) before committing to real spend._
