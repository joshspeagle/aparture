# OpenAI (GPT) API key

This page walks you through creating an OpenAI API key and wiring it into Aparture so the pipeline can call GPT models. If you haven't picked a provider yet, [Google AI](/getting-started/api-keys-google) is the easier on-ramp: Aparture's default model slots are all Google, and the free tier covers them.

Two things worth knowing about OpenAI before you start:

- **API calls need prepaid credit.** There's no free trial credit, and a ChatGPT subscription doesn't include API credit. Until the organization has a credit balance, every call fails with `429 insufficient_quota`.
- **Prompt caching is automatic.** OpenAI caches repeated prompt prefixes on its end with no setup.

## 1. Sign up

Head to [platform.openai.com/signup](https://platform.openai.com/signup). You can sign up with email or with a Google, Microsoft, or Apple account. OpenAI verifies your email address and a phone number. "Personal" works fine as the organization name.

## 2. Add billing

Billing comes before the key, because a key on an organization with no credit can't make calls.

1. In the dashboard, open **Settings → Billing**.
2. Add a payment method.
3. Add credit to the balance. $5 is enough for several small runs.

$5 in total credit purchases moves the organization to the Build usage tier, which has a $500 monthly usage limit. Consider also setting a monthly budget and an alert threshold in the organization's limits settings; a budget of $10–$25 with an alert at half of it is a sensible start.

## 3. Create an API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Click **Create new secret key**.
3. Name it something like `aparture-local`. The default project and permissions are fine.
4. **Copy the key when it appears.** OpenAI shows it once. If you miss it, delete the key and create another.

Project keys start with `sk-proj-`. Older keys may start with `sk-`; Aparture treats both the same.

## 4. Add to `.env.local`

Open `.env.local` in the Aparture project root and paste the key:

```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

No quotes, no spaces around `=`. Restart `npm run dev` if it's already running; Next.js reads `.env.local` once at server startup.

If you haven't already set `ACCESS_PASSWORD` in the same file, see the [install page](/getting-started/install#_3-set-a-local-access-password). Both values live in `.env.local`; the web UI can't launch without a password.

## 5. Verify

Aparture's default model slots are all Google, so adding an OpenAI key alone doesn't route anything to OpenAI yet. To test your key, switch at least one slot to a GPT model first:

1. Start (or restart) `npm run dev` and log in.
2. Open the **Settings** panel.
3. Change the `pdfModel` slot to `gpt-6.1-sol`. This is the most expensive stage and the clearest signal that your key works.
4. Back in the Control Panel, run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free), then the [Minimal API Test](/getting-started/verify-setup). For OpenAI the setup check confirms the key and the model ID; only the Minimal API Test sends a real request.

Expect about $0.50 on the 5-paper test with GPT-6.1 Sol on the PDF slot and the other slots on their Google defaults, plus reasoning tokens.

If the key is missing, the activity log shows `no API key for openai: set OPENAI_API_KEY in .env.local and restart the server` (the env var is unset or misspelled). A malformed or revoked key gives `401 invalid_api_key`, and an organization with no credit gives `429 insufficient_quota`. If a model returns `model_not_found`, check which models your organization can use in the dashboard, or pick another GPT model in Settings.

## 6. Recommended models

You pick each pipeline stage's model individually in the Settings panel. See [Model selection](/concepts/model-selection) for what each slot does; the table below is the recommended all-OpenAI lineup.

| Stage                               | Model         |
| ----------------------------------- | ------------- |
| Filter (`filterModel`)              | `gpt-6-luna`  |
| Scoring (`scoringModel`)            | `gpt-6.1-sol` |
| PDF analysis (`pdfModel`)           | `gpt-6.1-sol` |
| Briefing (`briefingModel`)          | `gpt-6.1-sol` |
| Quick summary (`quickSummaryModel`) | `gpt-6-luna`  |
| NotebookLM doc (`notebookLMModel`)  | `gpt-6.1-sol` |

::: warning Post-processing stays on Google unless you change it
Stage 3.5 runs on `postProcessingModel`, which has no Settings control and defaults to `gemini-3.6-flash`. With no Google key, turn off **Enable Post-Processing** in Settings, or every Stage 3.5 batch fails after its retries and the run keeps the Stage 3 scores.
:::

Two changes worth considering:

- **Step up on the briefing.** `gpt-6-astra` costs five times as much as GPT-6.1 Sol. On `briefingModel` it runs once per briefing, so the premium is bounded: the reference run below goes from about $2.11 to $3.37.
- **Step down on PDFs.** `gpt-6-luna` on `pdfModel` cuts the most expensive stage from about $1.50 to under $0.10 on the reference run. Read a few of its reports before keeping it.

## 7. Cost estimate

### Per-model pricing

GPT models bill per million tokens (MTok), separately for input and output. Reasoning tokens bill as output.

Standard-tier pricing for every OpenAI model in Aparture's registry, for prompts up to 272K tokens (longer prompts bill higher):

| Model                                              | Input ($/MTok) | Cached input ($/MTok) | Output ($/MTok) |
| -------------------------------------------------- | -------------: | --------------------: | --------------: |
| `gpt-6-astra`                                      |         $10.00 |                 $1.00 |          $50.00 |
| `gpt-6.1-sol` (recommended scoring, PDF, briefing) |          $2.00 |                 $0.10 |          $10.00 |
| `gpt-6-luna` (recommended filter + quick summary)  |          $0.10 |                 $0.01 |           $0.50 |
| `gpt-5.6-sol`\*                                    |          $5.00 |                 $0.40 |          $30.00 |
| `gpt-5.6-terra`                                    |          $2.00 |                 $0.20 |          $12.00 |
| `gpt-5.6-luna`                                     |          $0.20 |                 $0.02 |           $1.20 |

\* `gpt-5.6-sol` has a promotional price of $4 / $20 through at least 2026-11-21. Aparture's cost estimates use it until that date and the list price after.

The October 2026 refresh removed `gpt-5.4`, `gpt-5.4-mini`, and `gpt-5.4-nano`. Saved configs that pointed at them move to `gpt-6.1-sol` (from `gpt-5.4`) and `gpt-6-luna` (from the other two) the next time the app loads.

**Automatic prompt caching.** OpenAI caches repeated prompt prefixes of 1,024 tokens or more, and a cached prefix stays available for 30 minutes after its last use. Cached input bills at the rate in the middle column. The repeated part of an Aparture prompt is the rubric and your profile, which is a small share of each call next to the abstracts or the PDF, so expect a modest saving. The estimates below leave caching out.

### Worked calculation: 100 input papers (OpenAI lineup)

Reference case: 100 fetched papers, 50 pass the filter and are scored and post-processed, 20 go through PDF analysis (below the default cap of 30). Token counts are the app's own per-paper planning estimates, and they leave out reasoning tokens.

| Stage                       | Model             | Input tokens | Output tokens | Cost at list price                |
| --------------------------- | ----------------- | ------------ | ------------- | --------------------------------- |
| Filter (100 abstracts)      | GPT-6 Luna        | ~50,000      | ~10,000       | 50k × $0.10 + 10k × $0.50 = $0.01 |
| Scoring (50 abstracts)      | GPT-6.1 Sol       | ~40,000      | ~10,000       | 40k × $2 + 10k × $10 = $0.18      |
| Post-processing (50 papers) | Gemini 3.6 Flash† | ~35,000      | ~6,000        | 35k × $1.50 + 6k × $7.50 = $0.10  |
| PDF analysis (20 papers)    | GPT-6.1 Sol       | ~600,000     | ~30,000       | 600k × $2 + 30k × $10 = $1.50     |
| Quick summaries (20)        | GPT-6 Luna        | ~40,000      | ~6,000        | 40k × $0.10 + 6k × $0.50 = $0.01  |
| Briefing synthesis + audit  | GPT-6.1 Sol       | ~108,000     | ~10,000       | 108k × $2 + 10k × $10 = $0.32     |
| **Total, list price**       |                   |              |               | **~$2.11**                        |

† Post-processing stays on its Google default (see the warning above). Without a Google key, turn it off; the total drops to about $2.01.

Rows are rounded to the cent, so they can sum a cent away from the total. Reasoning adds output tokens on every row. After a run, the Download Report card shows the estimate from the tokens the run actually used.

### Scaling to other input volumes

Filter and scoring scale linearly with input volume. Stage 4 scales with how many papers you deep-analyse, and the default cap of 30 binds at higher volumes:

- **50 papers in** (10 PDFs): ~$1.10 list
- **100 papers in** (20 PDFs): ~$2.11 list (reference case above)
- **250 papers in** (30 PDFs, at cap): ~$3.26 list. PDF analysis plateaus at the cap; filter and scoring keep growing.

## 8. Common gotchas

- **Forgot to restart `npm run dev`.** Hot-reload doesn't pick up `.env.local` changes; restart the server.
- **Minimal API Test still runs against Google.** If you added the OpenAI key but didn't change a model slot in Settings, the test runs on Google models and doesn't exercise OpenAI at all. Swap at least one slot to a GPT model first.
- **Stage 3.5 errors without a Google key.** See the warning under Recommended models: post-processing stays on its Google default unless you turn it off.
- **`429 insufficient_quota` before any real usage.** The organization has no credit balance. Add credit under **Settings → Billing**.
- **`model_not_found`.** Your organization can't use that model. Check the models list in the dashboard, or pick another GPT model.
- **Whitespace in the key.** Copy and paste sometimes adds a trailing space or a Windows CRLF line ending. Re-save `.env.local` with LF line endings and no trailing whitespace.
- **Rate limits are in the console.** OpenAI shows your per-model limits under **Settings → Organization → Limits**, in the **Rate limits** section.
- **Want faster PDF analysis?** OpenAI needs no cache warmup, so Stage 4 workers all start at once. If your rate limits allow it, raise **Parallel PDF Calls** in Settings to 5–8 ([tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-calls)).

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Pricing snapshot taken 2026-10-17 from the model registry, checked against OpenAI's pricing page the same day. OpenAI pricing, usage tiers, and signup flow may change. Verify against [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) and your console's live limits at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits) before committing to real spend._
