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

You pick each pipeline stage's model individually in the Settings panel. See [Model selection](/concepts/model-selection) for what each slot does and how Aparture uses it end to end; the table below is just the Google picks for an all-Google Balanced configuration, with a free-tier-only alternative in the rightmost column.

| Stage                               | Balanced (paid Tier 1)  | Free-tier alternative   |
| ----------------------------------- | ----------------------- | ----------------------- |
| Filter (`filterModel`)              | `gemini-3.1-flash-lite` | `gemini-2.5-flash-lite` |
| Scoring (`scoringModel`)            | `gemini-3-flash`        | `gemini-2.5-flash`      |
| PDF analysis (`pdfModel`)           | `gemini-3.1-pro`        | `gemini-2.5-pro`        |
| Briefing (`briefingModel`)          | Same as `pdfModel`      | Same as `pdfModel`      |
| Quick summary (`quickSummaryModel`) | `gemini-3.1-flash-lite` | `gemini-2.5-flash`      |
| NotebookLM (`notebookLMModel`)      | Same as `pdfModel`      | Same as `pdfModel`      |

The Balanced column is Aparture's out-of-the-box default. If you're staying on Google's free tier (no billing), switch the right-hand column in everywhere — the 2.5-stable family has higher free-tier daily request caps than the 3.x previews, and the only paid-only slot is the Pro tier (`gemini-3.1-pro`), which has no free counterpart at all.

## 6. Cost estimate

### Per-model pricing

All Gemini models bill per million tokens (MTok), separately for input and output. **Google doesn't wire in Aparture's prompt caching** the way Anthropic does, so every run pays list price on the Google side (unlike Anthropic's 20–40% discount on repeat runs).

List pricing (paid tier) for every Gemini model in Aparture's registry:

| Model                                                    | Context | Input ($/MTok) | Output ($/MTok) |
| -------------------------------------------------------- | ------- | -------------: | --------------: |
| `gemini-3.1-pro` (preview; recommended PDF + briefing)   | 1M      |          $2.00 |          $12.00 |
| `gemini-3-flash` (preview; recommended scoring)          | 1M      |          $0.50 |           $3.00 |
| `gemini-3.1-flash-lite` (preview; recommended filter + q-summary) | 1M      |          $0.25 |           $1.50 |
| `gemini-2.5-pro` (stable)                                | 2M      |          $1.25 |          $10.00 |
| `gemini-2.5-flash` (stable)                              | 1M      |          $0.30 |           $2.50 |
| `gemini-2.5-flash-lite` (stable)                         | 1M      |          $0.10 |           $0.40 |

**Free-tier eligibility** (at reduced RPM/RPD caps):

- All models except `gemini-3.1-pro` are free-tier eligible.
- The 2.5-stable family gets higher free-tier allowances than the 3.x previews, so free-tier-only users should prefer the 2.5 line.
- `gemini-2.5-pro` is free-tier eligible for low-volume use, but daily caps bite on larger runs.

Prices shown are text/image/video input at ≤200k prompt size. `gemini-3.1-pro` and `gemini-2.5-pro` both have higher tier pricing above 200k ($4/$18 and $2.50/$15 respectively), which Aparture rarely hits. Audio input is billed at a separate higher rate.

Google updates preview pricing periodically and the 3.x tier is still beta, so verify current rates at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before committing to real spend.

### Worked calculation: Balanced at 100 input papers (paid Tier 1)

Assume 100 fetched papers, 60 pass the filter and get scored, 30 go through PDF analysis (hitting the default `maxDeepAnalysis` cap of 30).

| Stage                    | Model                  | Input tokens | Output tokens | Cost                                             |
| ------------------------ | ---------------------- | ------------ | ------------- | ------------------------------------------------ |
| Filter (100 abstracts)   | Gemini 3.1 Flash-Lite  | ~40,000      | ~5,000        | 40k × $0.25 / MTok + 5k × $1.50 = ~$0.02         |
| Scoring (60 abstracts)   | Gemini 3 Flash         | ~48,000      | ~9,000        | 48k × $0.50 + 9k × $3 = ~$0.05                   |
| PDF analysis (30 papers) | Gemini 3.1 Pro         | ~540,000     | ~60,000       | 540k × $2 + 60k × $12 = ~$1.80                   |
| Quick summaries (30)     | Gemini 3.1 Flash-Lite  | ~45,000      | ~12,000       | 45k × $0.25 + 12k × $1.50 = ~$0.03               |
| Briefing synthesis       | Gemini 3.1 Pro         | ~12,000      | ~3,000        | 12k × $2 + 3k × $12 = ~$0.06                     |
| Hallucination audit      | Gemini 3.1 Pro         | ~8,000       | ~600          | 8k × $2 + 0.6k × $12 = ~$0.02                    |
| **Total, list price**    |                        |              |               | **~$1.97**                                       |

Google doesn't wire in Aparture's prompt caching, so repeat runs pay the same list price.

### Scaling to other input volumes

Stage 4 caps at the top N papers (default 30), so past ~50 input papers the PDF-analysis cost stops growing. Stages 2 and 3 scale roughly linearly, but at Gemini's paid-tier Flash pricing they stay well under $0.25 even at 250 papers:

- **25 papers in** (15 PDFs): ~$0.90 list / all free on Flash-only free tier
- **100 papers in** (30 PDFs, capped): ~$2.00 list
- **250 papers in** (30 PDFs, capped): ~$2.10 list — PDF analysis plateaus; filter + scoring barely budge

### Free tier (2.5-stable throughout)

If you set every slot to its free-tier alternative from the Recommended models table — `gemini-2.5-flash-lite` for filter, `gemini-2.5-flash` for scoring and quick summaries, `gemini-2.5-pro` for PDF and briefing — a fresh account can run Aparture's full end-to-end pipeline without spending anything, subject only to daily request caps.

| Input papers | Cost/run                                  |
| ------------ | ----------------------------------------- |
| 25           | $0.00                                     |
| 100          | $0.00 (watch daily request caps)          |
| 250          | $0.00 at pricing, may hit daily caps      |

This is the main argument for Google AI as the first-run provider.

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
- **Want faster PDF analysis?** Google's RPM on Tier 1+ is generous enough to handle higher Stage 4 parallelism than the default of 3. Raise **Parallel PDF analyses** in Settings to 5–8 ([tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-analyses)).

---

_Snapshot taken 2026-04-19. Google's pricing and billing tier structure may change. Verify current pricing at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) and per-model rate limits by signing in at [aistudio.google.com](https://aistudio.google.com/) before committing to real spend._
