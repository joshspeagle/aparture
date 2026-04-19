# OpenAI (GPT) API key

This page walks through getting an OpenAI API key and wiring it into Aparture so the pipeline can call GPT models (GPT-5.4, 5.4 Mini, 5.4 Nano). If you're not sure which provider to pick, start with [Google AI](/getting-started/api-keys-google). It has a free tier.

Two things specific to OpenAI worth knowing up front: there's no free trial, so you'll need a $5 minimum prepaid deposit before any API call goes through. And with GPT-5.4 across the heavier stages, cost stays roughly flat from 25 to 250 papers/day (~$1.40–$2.80), because the expensive PDF and briefing stages are capped at top-N regardless of input. OpenAI's platform caches repeated prompt prefixes automatically, so real cost with a warm cache typically runs 20–40% below list.

## 1. Sign up

Signup page: **[platform.openai.com/signup](https://platform.openai.com/signup)**.

Requirements:

- Email, or Google/Microsoft/Apple SSO.
- Email verification (click link).
- Phone verification (SMS code, not skippable).
- Basic profile (name, organization name — "Personal" is fine).

::: warning No free trial credits
Any docs claiming "free $5 on signup" are out of date — as of 2026 there's no free trial on new OpenAI API accounts. A ChatGPT Plus subscription is separate and does not include API credit.
:::

## 2. Add billing (required before any API call)

The API returns `429 insufficient_quota` until you have a credit balance, so you need to deposit first, then create a key.

1. From the dashboard, navigate to **Settings → Billing** (left sidebar under your org name).
2. Click **Add payment method** — add a credit card.
3. Click **Add to credit balance** — minimum deposit is **$5**.
4. Paying $5 immediately activates **Tier 1** (see §5).
5. (Optional) **Auto recharge** — off by default. Enable it only if you understand your expected spend.

Credits don't expire. You can add more later.

## 3. Set spend caps (before first call)

Strongly recommended before you create a key. Path: **Settings → Limits** (or `https://platform.openai.com/settings/organization/limits`).

Two thresholds:

| Setting                               | Effect                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Usage limit (hard cap)**            | API returns 429 errors once exceeded for the month. Default $100/month on Tier 1. You can lower it. |
| **Notification threshold (soft cap)** | Email when monthly spend crosses this amount. Does not block requests.                              |

::: tip Sensible starting caps for Aparture
Hard cap $10-25 and notification threshold at 50% of that. Raise later as you get comfortable with the spend.
:::

## 4. Create an API key

1. Go to **Dashboard → API keys** (left sidebar) or `https://platform.openai.com/api-keys`.
2. Click **+ Create new secret key** (top right).
3. Configure:
   - **Name:** something like `aparture-local`.
   - **Project:** "Default project" unless you've created others.
   - **Permissions:** "All" is correct — Aparture uses the chat completions and responses endpoints.
4. Click **Create secret key**.
5. **Copy the key immediately.** Starts with `sk-proj-`. Shown only once. If you miss it, delete and recreate.

**Project keys vs user keys:** `sk-proj-...` is the current format (project-scoped, default since Jan 2024). Legacy `sk-...` keys still work but aren't issued to new accounts. Aparture treats both formats identically — `lib/llm/resolveApiKey.js` reads `OPENAI_API_KEY` and sends it in the `Authorization` header.

**Organization ID (`org-...`):** Aparture does not send this header and you don't need to set it. It's only relevant if you belong to multiple OpenAI organizations.

## 5. Add to `.env.local`

Open `.env.local` in the project root and add:

```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

Rules:

- No quotes, no spaces around `=`.
- One key per line. Comments start with `#` at column 0.
- **Restart `npm run dev`** after editing — `.env.local` is read once at dev-server startup.

You'll also need `ACCESS_PASSWORD` set. See [reference/environment](/reference/environment).

## 6. Rate-limit tiers

OpenAI's tier system is organization-level, and advancement is automatic once you meet both the spend and time thresholds.

| Tier       | Qualification                                | Monthly usage limit |
| ---------- | -------------------------------------------- | ------------------- |
| Free       | Geo-eligible only, no API access             | $100/mo             |
| **Tier 1** | $5 paid                                      | $100/mo             |
| Tier 2     | $50 paid **and** 7+ days since first payment | $500/mo             |
| Tier 3     | $100 paid **and** 7+ days                    | $1,000/mo           |
| Tier 4     | $250 paid **and** 14+ days                   | $5,000/mo           |
| Tier 5     | $1,000 paid **and** 30+ days                 | $200,000/mo         |

::: info Per-model RPM/TPM limits are dashboard-only
As of 2026, OpenAI no longer publishes consolidated tables — live numbers live at **[Settings → Limits](https://platform.openai.com/settings/organization/limits)** in the console. Check there for your tier's current per-model limits.
:::

Tier 1 is adequate for Aparture's typical 25-250-paper runs. The pipeline batches requests conservatively and retries on 429 with exponential backoff. If you hit persistent rate limits, move to Tier 2+ or switch `scoringModel`/`pdfModel` to Anthropic or Google.

## 7. Pricing for a Balanced-config run on OpenAI

Balanced configuration with OpenAI models (editorial shorthand for a sensible mid-tier combo — see [hub page](/getting-started/api-keys) for definition):

- **Stage 1 (quick filter):** GPT-5.4 Nano — $0.20 / $0.02 cached / $1.25 per MTok
- **Stage 2 (scoring):** GPT-5.4 Mini — $0.75 / $0.075 cached / $4.50 per MTok
- **Stage 3 (PDF analysis):** GPT-5.4 — $2.50 / $0.25 cached / $15.00 per MTok
- **Briefing (synthesis + hallucination check):** GPT-5.4 — same as above
- **Briefing quick summaries:** GPT-5.4 Nano (cheap)

Daily cost (before caching):

| Papers/day | Quick filter | Scoring | PDF analysis       | Briefing | **Total/run** | **Monthly (20 runs)** |
| ---------- | ------------ | ------- | ------------------ | -------- | ------------- | --------------------- |
| 25         | $0.005       | $0.032  | $1.225 (10 papers) | $0.110   | **~$1.37**    | ~$27                  |
| 100        | $0.020       | $0.064  | $1.838 (15 papers) | $0.110   | **~$2.03**    | ~$41                  |
| 250        | $0.050       | $0.128  | $2.450 (20 papers) | $0.160   | **~$2.79**    | ~$56                  |

**Why is cost flat across volume?** Stage 3 (PDF analysis) is capped at the top 10-20 papers regardless of input size. Stages 1 and 2 scale linearly but are cheap. Stage 3 + Briefing dominate total cost, and they don't scale with paper count — so you get more total value per run at higher volumes, not higher cost.

Caveats:

1. PDF analysis is ~90% of total spend at every volume. Swapping `pdfModel` to GPT-5.4 Mini cuts total by ~65%, at the cost of analysis depth.
2. OpenAI's platform auto-caches repeated prompt prefixes (10× discount on cached input tokens — $0.25 vs $2.50 for GPT-5.4). Real cost with a warm cache runs 20-40% below the table.
3. The Batch API would halve costs further (50% off standard pricing), but Aparture runs synchronously today — no Batch path.

**Cost-cutting levers:**

- Switch `pdfModel` to GPT-5.4 Mini → ~65% drop in Stage 3 cost.
- Reduce `maxDeepAnalysis` (default 30 → 15) → halves Stage 3 cost proportionally.

See [concepts/model-selection](/concepts/model-selection) for the full tuning guide.

## 8. Verify

After restarting `npm run dev`, run the [Minimal API Test](/getting-started/verify-setup) from the UI. Expect ~$0.30–$0.80 spend on OpenAI's Balanced defaults, since the minimal test runs the full pipeline (including PDF analysis) on 5 papers.

Quick curl sanity-check before running Aparture:

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Expected: a JSON list of available models. If you get `401 invalid_api_key`, the key is wrong. If `429 insufficient_quota`, you haven't added credit yet.

## Common gotchas

1. **Forgot to restart `npm run dev`.** Next.js reads `.env.local` at startup; restart after editing.
2. **Missed the key at creation.** Shown exactly once. Delete and recreate if you missed it.
3. **`429 insufficient_quota` before any real usage.** You forgot the $5 deposit. Fix: **Settings → Billing → Add to credit balance**.
4. **`model_not_found` for `gpt-5.4`.** Your org may not yet have access to the newest models. Check **Dashboard → Models**; may require Tier 2+.
5. **Whitespace in the key.** Copy/paste sometimes adds a trailing space or Windows CRLF line ending. Re-save `.env.local` with LF line endings and no trailing whitespace.
6. **Never commit `.env.local`.** Gitignored by default. Verify with `git check-ignore .env.local`.

---

_Snapshot taken 2026-04-17. OpenAI pricing, tier thresholds, and signup flow may change. Verify against [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) and your console's live limits at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits)._
