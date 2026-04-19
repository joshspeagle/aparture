# Google (Gemini) API key

This page walks you through creating a Google AI Studio API key and wiring it into Aparture so the pipeline can call Gemini models. Google AI is the easiest on-ramp for first-time users — Aparture's default model slots are already all-Google, and the free tier covers an all-Flash model setup end-to-end.

Two things worth knowing about Google before you start:

- **Free tier covers the Flash family.** Gemini Flash, Flash-Lite, and their 3.x preview counterparts are free on fresh accounts. The only Gemini model that isn't free is Gemini 3.1 Pro Preview, which Aparture's out-of-the-box defaults use for PDF analysis and briefing. Keeping all model slots on Flash (or switching the Pro slots down to Flash in Settings) costs $0.
- **Prompt caching isn't wired in yet for Google.** Runs always pay list price on the Google side, unlike Anthropic (explicit caching) and OpenAI (automatic caching).

## 1. Sign up

Head to [aistudio.google.com/apikey](https://aistudio.google.com/apikey). You'll need a Google account (gmail, Workspace, or any `@google` identity). No credit card is needed for the free tier, and no separate Google Cloud project setup is required — AI Studio auto-creates one on first key generation.

## 2. Create an API key

1. Sign in with your Google account, accept the terms of service on first visit.
2. Click **Create API key**.
3. Choose **"Create API key in new project"** for a clean Cloud project with no billing attached. (If you want the key inside an existing project, pick that project from the dropdown instead.)
4. **Copy the key immediately once it appears.** Google only shows the masked form afterwards. If you miss it, create a fresh one.

The key format is `AIzaSy<33 chars>` — the same shape as other Google API keys.

## 3. Add to `.env.local`

Open `.env.local` in the Aparture project root and paste the key:

```bash
GOOGLE_AI_API_KEY=AIzaSy-your-actual-key-here
```

The env var name is `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`. No quotes, no spaces around `=`. Restart `npm run dev` if it's already running — Next.js reads `.env.local` once at server startup.

If you haven't already set `ACCESS_PASSWORD` in the same file, see the [install page](/getting-started/install#_3-set-a-local-access-password). Both values live in `.env.local`; the web UI can't launch without a password.

## 4. Verify

Aparture's default model slots are already all-Google, so with the Google key in place and the dev server restarted you can run the [Minimal API Test](/getting-started/verify-setup) directly — no Settings changes needed:

1. Start (or restart) `npm run dev` and log in.
2. In the Control Panel, click **Minimal API Test**.

On the free tier this costs $0. If you've upgraded to Tier 1 with the default Gemini 3.1 Pro in the PDF and briefing slots, expect ~$0.20–$0.50 on the 5-paper test.

If the key is invalid, you'll see `"Google API key not found"` (env var missing or misspelled) or HTTP 401 (`UNAUTHENTICATED`). If you're on the free tier but the PDF stage is set to Gemini 3.1 Pro, you'll get `PERMISSION_DENIED` partway through — switch the PDF and briefing slots to a Flash model in Settings, or upgrade to Tier 1.

## 5. Recommended models

You pick each pipeline stage's model individually in the Settings panel. For an all-Google setup:

| Stage                              | Model                                                    | Notes                                                                                          |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Filter (`filterModel`)             | `gemini-2.5-flash-lite`                                  | Free-tier eligible. Fast, cheap.                                                               |
| Scoring (`scoringModel`)           | `gemini-3-flash`                                         | Free-tier eligible. Better nuance than Flash-Lite.                                             |
| PDF analysis (`pdfModel`)          | `gemini-3.1-pro` (paid) or `gemini-2.5-pro` (free)       | Most expensive stage. 2.5 Pro is free-tier; 3.1 Pro Preview needs billing.                     |
| Briefing (`briefingModel`)         | Same as `pdfModel`                                       | Synthesis quality. Use whatever you picked for PDF.                                            |
| Quick summary (`quickSummaryModel`)| `gemini-3.1-flash-lite` (default)                        | Small text-compression task, already the app default across providers. Free-tier eligible.    |
| NotebookLM (`notebookLMModel`)     | `gemini-3.1-pro` (paid) or `gemini-2.5-pro` (free)       | Configured in the NotebookLM card, not Settings. Only runs if you generate a podcast bundle.  |

## 6. Cost estimate

With all-Google Balanced model picks and the default 30-paper PDF cap, here's what a run actually spends per stage:

- **Filter** runs on every input paper. ~$0.002 per 25 papers.
- **Scoring** runs on the filter-passing subset (typically 60% of input). ~$0.016 per 25 papers.
- **PDF analysis** runs on the **top 30** papers regardless of input (the cap). ~$1.35 with Gemini 3.1 Pro.
- **Briefing synthesis + hallucination check + quick-summary fan-out** runs once per run. Quick summaries use Flash-Lite by default (~$0.02 total); synthesis + check use the briefing model (~$0.12 on Gemini 3.1 Pro).

Putting it together:

| Input papers | Filter | Scoring | PDF (top 30) | Briefing + quick summaries | **Total/run** |
| ------------ | ------ | ------- | ------------ | -------------------------- | ------------- |
| 25           | $0.002 | $0.016  | $1.35 (25)   | $0.14                      | **~$1.53**    |
| 100          | $0.007 | $0.046  | $1.62 (30)   | $0.14                      | **~$1.82**    |
| 250          | $0.018 | $0.114  | $1.62 (30)   | $0.14                      | **~$1.90**    |

The cost flattens at higher input volumes because PDF analysis is the dominant stage and caps at 30 papers regardless. Scaling from 25 to 250 papers/day adds only ~$0.40/run.

### Free tier (all-Flash)

If every model slot is set to a Flash-family model — Flash-Lite filter, Flash scoring, Flash (or 2.5 Pro on free tier) for PDF + briefing, Flash-Lite for quick summaries:

| Input papers | Cost/run                                  |
| ------------ | ----------------------------------------- |
| 25           | $0.00                                     |
| 100          | $0.00 (watch daily request caps)          |
| 250          | $0.00 at pricing, may hit daily caps      |

This is the main argument for Google AI as the first-run provider: a fresh account can run Aparture's full end-to-end pipeline without spending anything.

## 7. When to add billing

You'll hit a free-tier wall when any of:

- You want to use Gemini 3.1 Pro Preview for any slot (it's paid-only; the defaults use it for PDF and briefing).
- You exceed daily request caps on a Flash model (possible on 250+ papers/day).
- You need to opt out of training-data collection (only available on paid Tier 1+).
- Your workload outgrows the free-tier request-per-minute allowances.

### Upgrading to Tier 1

On the AI Studio API keys page, find the **Set up billing** button next to your project (or navigate to the Projects page). Google Cloud Billing opens in a new tab; link a billing account, add a payment method, and prepay a minimum $10 in credits. This moves the project from Free to Tier 1.

Tier 1 has a **$250/month spend cap per billing account** (non-configurable, service pauses at the cap until the next cycle). All Gemini models unlock, opt-out is available, and request allowances are higher. Aparture's realistic usage — even at hundreds of papers/day — won't approach $250/month, so solo researchers stay on Tier 1 indefinitely.

## 8. Common gotchas

- **Forgot to restart `npm run dev`.** Hot-reload doesn't pick up `.env.local` changes; restart the server.
- **Wrong env var name.** It's `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- **Missed the key at creation.** Only shown in the clear once; create a new one from the same AI Studio page if needed.
- **`PERMISSION_DENIED` mid-run.** A slot is set to Gemini 3.1 Pro but billing isn't enabled yet. Either upgrade to Tier 1 or switch that slot to a Flash-family model.
- **Free-tier uses your data for training.** Unavoidable on the free tier. If your profile contains sensitive research notes, upgrade to Tier 1 or keep the free-tier profile non-sensitive.
- **Preview models have tighter limits than 2.5-stable.** Gemini 3.x previews get smaller allowances than the 2.5 stable counterparts. For production-grade runs with predictable throughput, prefer 2.5-stable models.
- **Rate-limit numbers are dashboard-only.** Per-model RPM/TPM/RPD aren't in the public docs anymore. Sign in at [aistudio.google.com](https://aistudio.google.com/) to see your current limits.

---

_Snapshot taken 2026-04-17. Google's pricing and billing tier structure may change. Verify current pricing at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) and per-model rate limits by signing in at [aistudio.google.com](https://aistudio.google.com/) before committing to real spend._
