# OpenAI (GPT) API key

This page walks you through creating an OpenAI API key and wiring it into Aparture so the pipeline can call GPT models. If you haven't picked a provider yet, [Google AI](/getting-started/api-keys-google) is the easier on-ramp — Aparture's default slots are already all-Google, and the free tier covers an all-Flash setup end-to-end.

Two things worth knowing about OpenAI before you start:

- **There's no free trial.** Every API account needs a $5 minimum prepaid deposit before any call goes through; the ChatGPT Plus subscription is separate and doesn't include API credit.
- **Prompt caching is automatic.** OpenAI caches repeated prompt prefixes on its end with no code changes needed. Real cost on repeat runs with the same profile typically tracks 20–40% below list.

## 1. Sign up

Head to [platform.openai.com/signup](https://platform.openai.com/signup). You can sign up with email, Google, Microsoft, or Apple SSO.

Verification requires a click-through email and an SMS code (phone verification isn't skippable). Fill in the basic profile — "Personal" works fine for the organisation name.

## 2. Add billing

OpenAI returns `429 insufficient_quota` on every API call until you have a credit balance, so billing setup comes before key creation.

1. From the dashboard, navigate to **Settings → Billing** (in the left sidebar under your org name).
2. Click **Add payment method**, add a credit card.
3. Click **Add to credit balance** — minimum deposit is **$5**. Credits don't expire.
4. Paying $5 immediately activates Tier 1 (the entry tier, $100/month spend ceiling).

Optional but recommended: also set a spend cap under **Settings → Limits**. A hard cap of $10–$25 and a notification threshold at ~50% of that is a sensible starting point; you can raise it later.

Auto-recharge is off by default. Leave it off unless you really want spend that happens without your knowing.

## 3. Create an API key

1. Go to **Dashboard → API keys** (left sidebar) or [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Click **+ Create new secret key** (top right).
3. Name it something like `aparture-local`. The default project and "All" permissions are fine.
4. Click **Create secret key**.
5. **Copy the key immediately once it appears** — it's shown exactly once. If you miss it, delete and recreate.

The key format is `sk-proj-<...>`. Legacy `sk-...` keys still work but aren't issued to new accounts. Aparture treats both shapes identically.

## 4. Add to `.env.local`

Open `.env.local` in the Aparture project root and paste the key:

```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

No quotes, no spaces around `=`. Restart `npm run dev` if it's already running — Next.js reads `.env.local` once at server startup.

If you haven't already set `ACCESS_PASSWORD` in the same file, see the [install page](/getting-started/install#_3-set-a-local-access-password). Both values live in `.env.local`; the web UI can't launch without a password.

## 5. Verify

Aparture's default model slots are all-Google, so adding an OpenAI key alone doesn't route anything to OpenAI yet. To actually test your key, switch at least one slot to a GPT model first:

1. Start (or restart) `npm run dev` and log in.
2. Open the **Settings** panel.
3. Change the `pdfModel` slot to `gpt-5.4`. This is the most expensive stage and the clearest signal that your key works.
4. Back in the Control Panel, run the [Minimal API Test](/getting-started/verify-setup).

Expect ~$0.30–$0.80 on the 5-paper test with the PDF stage on GPT-5.4.

If the key is invalid, you'll see `401 invalid_api_key`. If you didn't add credit yet, you'll see `429 insufficient_quota`. If `gpt-5.4` returns `model_not_found`, your org may not have access to the newest models yet — check **Dashboard → Models**, or switch to `gpt-5.4-mini` which is available on every tier.

## 6. Recommended models

You pick each pipeline stage's model individually in the Settings panel. See [Model selection](/concepts/model-selection) for what each slot does and how Aparture uses it end to end; the table below is just the OpenAI picks for an all-OpenAI Balanced configuration.

| Stage                               | Model          |
| ----------------------------------- | -------------- |
| Filter (`filterModel`)              | `gpt-5.4-nano` |
| Scoring (`scoringModel`)            | `gpt-5.4-mini` |
| PDF analysis (`pdfModel`)           | `gpt-5.4`      |
| Briefing (`briefingModel`)          | `gpt-5.4`      |
| Quick summary (`quickSummaryModel`) | `gpt-5.4-nano` |
| NotebookLM doc (`notebookLMModel`)  | `gpt-5.4`      |

If you want a quality/cost step down, swap `pdfModel` to GPT-5.4 Mini — that single change cuts roughly 65% off the PDF-analysis cost, since Stage 4 dominates the total.

## 7. Cost estimate

### Per-model pricing

All GPT-5.4 models bill per million tokens (MTok), separately for input and output. List pricing for every OpenAI model in Aparture's registry:

| Model                                           | Context | Input ($/MTok) | Output ($/MTok) |
| ----------------------------------------------- | ------- | -------------: | --------------: |
| `gpt-5.4` (recommended PDF + briefing)          | 1M      |          $2.50 |          $15.00 |
| `gpt-5.4-mini` (recommended scoring)            | 400k    |          $0.75 |           $4.50 |
| `gpt-5.4-nano` (recommended filter + q-summary) | 400k    |          $0.20 |           $1.25 |

**Automatic prompt caching.** OpenAI caches repeated prompt prefixes on its end with no configuration needed. The cached-input rate is roughly **10× cheaper** than the list rate above (`gpt-5.4` $0.25/MTok, `gpt-5.4-mini` $0.075/MTok, `gpt-5.4-nano` $0.02/MTok). That typically nets a 20–40% reduction overall on repeat runs with the same profile.

OpenAI updates pricing periodically. Verify current rates at [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) before committing to real spend.

### Worked calculation: Balanced at 100 input papers

Assume 100 fetched papers, 60 pass the filter and get scored, 30 go through PDF analysis (hitting the default `maxDeepAnalysis` cap of 30).

| Stage                    | Model        | Input tokens | Output tokens | Cost                                          |
| ------------------------ | ------------ | ------------ | ------------- | --------------------------------------------- |
| Filter (100 abstracts)   | GPT-5.4 Nano | ~40,000      | ~5,000        | 40k × $0.20 / MTok + 5k × $1.25 = ~$0.014     |
| Scoring (60 abstracts)   | GPT-5.4 Mini | ~48,000      | ~9,000        | 48k × $0.75 + 9k × $4.50 = ~$0.08             |
| PDF analysis (30 papers) | GPT-5.4      | ~540,000     | ~60,000       | 540k × $2.50 + 60k × $15 = ~$2.25             |
| Quick summaries (30)     | GPT-5.4 Nano | ~45,000      | ~12,000       | 45k × $0.20 + 12k × $1.25 = ~$0.02            |
| Briefing synthesis       | GPT-5.4      | ~12,000      | ~3,000        | 12k × $2.50 + 3k × $15 = ~$0.08               |
| Hallucination audit      | GPT-5.4      | ~8,000       | ~600          | 8k × $2.50 + 0.6k × $15 = ~$0.03              |
| **Total, list price**    |              |              |               | **~$2.47**                                    |

With automatic caching on repeat runs (same profile, same category set), the stable prefix of each prompt drops to 10% of list input pricing, so repeat runs land at **~$1.70–2.00 per run** after the first.

### Scaling to other input volumes

Stage 4 caps at the top N papers (default 30), so past ~50 input papers the PDF-analysis cost stops growing. Stages 2 and 3 scale roughly linearly:

- **25 papers in** (15 PDFs): ~$1.25 list / ~$0.90 with caching
- **100 papers in** (30 PDFs, capped): ~$2.50 list / ~$1.80 with caching
- **250 papers in** (30 PDFs, capped): ~$2.70 list / ~$1.95 with caching — PDF analysis plateaus; filter + scoring become the delta

## 8. Common gotchas

- **Forgot to restart `npm run dev`.** Hot-reload doesn't pick up `.env.local` changes; restart the server.
- **Minimal API Test still runs against Google.** If you added the OpenAI key but didn't change a model slot in Settings, the test runs with Google models and won't exercise OpenAI at all. Swap at least one slot to a GPT model first.
- **`429 insufficient_quota` before any real usage.** You forgot the $5 deposit. Fix: **Settings → Billing → Add to credit balance**.
- **`model_not_found` for `gpt-5.4`.** Your org may not yet have access to the newest models. Check **Dashboard → Models**, or switch to `gpt-5.4-mini`.
- **Whitespace in the key.** Copy/paste sometimes adds a trailing space or a Windows CRLF line ending. Re-save `.env.local` with LF and no trailing whitespace.
- **Per-model rate limits are dashboard-only.** OpenAI no longer publishes consolidated tables; your current limits are at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits).
- **Want faster PDF analysis?** OpenAI caches repeated prompt prefixes automatically (no warmup needed), and the Tier 3+ TPM is generous enough to handle higher Stage 4 parallelism than the default of 3. Raise **Parallel PDF analyses** in Settings to 5–8 ([tuning the pipeline](/using/tuning-the-pipeline#parallel-pdf-analyses)).

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Snapshot taken 2026-04-19. OpenAI pricing, tier thresholds, and signup flow may change. Verify against [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) and your console's live limits at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits) before committing to real spend._
