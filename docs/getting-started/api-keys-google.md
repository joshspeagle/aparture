# Google (Gemini) API key

Google AI Studio is the recommended first-run provider for Aparture. The free tier covers the entire Budget preset end-to-end, so a brand-new user can run a full analysis without spending anything, as long as they stick to the Gemini Flash family and stay inside the daily request allowances.

Setup takes 2 minutes. No credit card required.

## 1. Create a key

Signup page: **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.

Prerequisites:

- A Google account (gmail, Workspace, or any `@google` identity).
- No Google Cloud project needed — AI Studio auto-creates one on first key generation.
- No credit card for the free tier.

Steps:

1. Navigate to `https://aistudio.google.com/apikey`.
2. Sign in with your Google account if prompted.
3. Accept the Google AI Studio terms of service on first visit.
4. Click **Create API key**.
5. Choose whether to create the key inside an existing Google Cloud project or let AI Studio create a new one. For first-time users, **"Create API key in new project"** is the right choice — it provisions a minimal Cloud project with no billing attached.
6. The dialog shows the full key. **Copy it immediately** — later you can only see the masked form.

Key format: `AIzaSy<33 chars>`. Standard Google API-key format, same shape as Maps, Gemini, and other Google APIs.

## 2. Add to `.env.local`

Open `.env.local` in the project root and add:

```bash
GOOGLE_AI_API_KEY=AIzaSy-your-actual-key-here
```

Note that the env var name is `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`.

Rules:

- No quotes, no spaces around `=`.
- One key per line. Comments start with `#` at column 0.
- **Restart `npm run dev`** after editing — `.env.local` is read once at dev-server startup.

You'll also need `ACCESS_PASSWORD` set in the same file. See [reference/environment](/reference/environment).

## 3. Free tier scope

Five of the six Gemini models Aparture knows about are free-tier eligible:

| Model                         | Free-tier status         |
| ----------------------------- | ------------------------ |
| Gemini 3.1 Pro Preview        | **Not free** — paid only |
| Gemini 3 Flash Preview        | Free of charge           |
| Gemini 3.1 Flash-Lite Preview | Free of charge           |
| Gemini 2.5 Pro                | Free of charge           |
| Gemini 2.5 Flash              | Free of charge           |
| Gemini 2.5 Flash-Lite         | Free of charge           |

The **Budget preset** uses Flash and Flash-Lite throughout, so it costs nothing on the free tier. The **Balanced preset** uses Gemini 3.1 Pro for deep PDF analysis and briefing, which is paid-only — you'll need to upgrade to Tier 1 (below) to use it.

::: warning Two caveats on the free tier

1. **Rate limits apply.** Google used to publish per-model RPM/TPM/RPD tables. As of 2026, per-model live numbers have moved behind sign-in, visible at the [AI Studio dashboard](https://aistudio.google.com/) after you log in. The general [Gemini API rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits) still describes the free-tier structure at a high level. Based on historical allowances, a 25-papers/day Budget run fires ~95 requests/day and fits comfortably; a 250-papers/day run fires 300+/day and may trip daily caps on Flash.

2. **Free-tier users cannot opt out of data-for-training.** Google may train on your prompts and responses. If your profile contains proprietary or sensitive research notes, upgrade to paid Tier 1 ($10 prepaid credit) to enable opt-out, or use a non-sensitive profile for free-tier usage.

:::

## 4. When you need billing

You'll hit a free-tier wall when any of:

1. You select Gemini 3.1 Pro Preview for any stage (Balanced or Quality preset).
2. You exceed daily RPD on a Flash model (typical for 250+ papers/day).
3. You need to opt out of data-for-training.
4. Your workload needs higher RPM/TPM than the free tier allows.

### Upgrading to Tier 1

1. On the AI Studio API keys page, find the **Set up billing** button next to the project associated with your key, or go directly to the Projects page.
2. Click **Set up billing** — this opens Google Cloud Billing setup.
3. Link an existing Google Cloud billing account, or create a new one.
4. Add a payment method.
5. **Prepay minimum $10 in credits.** This moves the project from Free to Tier 1.

Tier 1 terms:

- **$250/month spend cap** per billing account. Non-configurable. Service pauses at the cap until the next billing cycle.
- All Gemini models unlock, including Gemini 3.1 Pro Preview.
- Opt out of data-for-training is available.
- Higher RPM/TPM/RPD allowances (visible only in the AI Studio rate-limit dashboard).

Tier 2+ requires sustained spend history and manual Google approval. Aparture's realistic usage won't approach the $250/month Tier 1 cap — solo researchers will stay on Tier 1 indefinitely.

## 5. Pricing for a Balanced-config run on Google

Balanced preset with all-Google models:

- **Stage 1 (quick filter):** Gemini 3.1 Flash-Lite Preview — $0.25 / $1.50 per MTok
- **Stage 2 (scoring):** Gemini 3 Flash Preview — $0.50 / $3.00 per MTok
- **Stage 3 (PDF analysis):** Gemini 3.1 Pro Preview — $2.00 / $12.00 per MTok
- **Briefing (synthesis + hallucination check):** Gemini 3.1 Pro Preview
- **Briefing quick summaries:** Flash-Lite (cheap)

Daily cost:

| Papers/day | Filter | Scoring | PDF (Pro) | Briefing sums | Synthesis | Halluc. check | **Total/day** |
| ---------- | ------ | ------- | --------- | ------------- | --------- | ------------- | ------------- |
| 25         | $0.002 | $0.016  | $1.35     | $0.018        | $0.088    | $0.038        | **~$1.53**    |
| 100        | $0.007 | $0.046  | $1.62     | $0.018        | $0.088    | $0.038        | **~$1.86**    |
| 250        | $0.018 | $0.114  | $1.62     | $0.018        | $0.088    | $0.038        | **~$1.94**    |

**Monthly projections** (30 daily runs): ~$46 at 25/day, ~$56 at 100/day, ~$58 at 250/day.

The cost flattens at higher paper volumes because Stage 3 + Briefing (the expensive Pro calls) are capped at top-N regardless of input. Scaling from 25 to 250 papers/day only adds about $0.40/day.

### Budget preset (free tier)

Same pipeline but with Flash-family models throughout — Flash-Lite filter, Flash scoring + post-proc, Flash PDF + briefing, no Pro models:

| Papers/day | Cost/day                                  |
| ---------- | ----------------------------------------- |
| 25         | $0.00                                     |
| 100        | $0.00 (watch daily RPD)                   |
| 250        | $0.00 at pricing, but likely hits RPD cap |

This is the main argument for Google AI as the first-run provider: a fresh account can run Aparture's full end-to-end pipeline without spending anything, as long as it stays in the Budget preset.

## 6. Verify

After restarting `npm run dev`, run the [Minimal API Test](/getting-started/verify-setup) from the UI. On the free tier this costs $0. On paid Tier 1 with Balanced models, expect ~$0.20–$0.50 on 5 test papers, since the minimal test runs the full pipeline (including PDF analysis).

If the key is invalid you'll see `"Google API key not found"` (env var missing or misspelled) or HTTP 401 (`UNAUTHENTICATED`).

## Common gotchas

1. **Forgot to restart `npm run dev`.** Next.js reads `.env.local` at startup; restart after editing.
2. **Missed the key at creation.** Only visible once. Create a new one from the same AI Studio page if you missed it.
3. **Wrong env var name.** It's `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
4. **Rate-limit numbers are gated behind sign-in.** Per-model RPM/TPM/RPD numbers aren't in the public docs anymore. Sign in at [aistudio.google.com](https://aistudio.google.com/) and look at the rate-limit panel for your current limits.
5. **Free tier trains on your data.** Unavoidable on the free tier. If your profile is sensitive, upgrade to Tier 1 or use a non-sensitive stand-in profile.
6. **Preview models have tighter limits.** Gemini 3.x previews have smaller RPM/TPM than the 2.5 stable counterparts. For production-grade reliability, consider the 2.5-stable variants.
7. **Picking Balanced on free tier fails silently.** If you select a Gemini 3.1 Pro-based preset but haven't enabled billing, the route returns `PERMISSION_DENIED` mid-run. Either enable billing or switch to the Budget preset.

---

_Snapshot taken 2026-04-17. Google's pricing and billing tier structure may change. Verify current pricing at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) and check your current per-model rate limits by signing in at [aistudio.google.com](https://aistudio.google.com/) before committing to production volumes._
