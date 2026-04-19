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

You pick each pipeline stage's model individually in the Settings panel. For an all-OpenAI Balanced configuration:

| Stage                               | Model                                          | Notes                                                                           |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Filter (`filterModel`)              | `gpt-5.4-nano`                                 | Cheapest; filtering is high-volume.                                             |
| Scoring (`scoringModel`)            | `gpt-5.4-mini`                                 | Middle of the range.                                                            |
| PDF analysis (`pdfModel`)           | `gpt-5.4`                                      | Strongest option, most expensive stage. GPT-5.4 Mini is a ~65% cheaper drop-in. |
| Briefing (`briefingModel`)          | `gpt-5.4`                                      | Synthesis + hallucination check.                                                |
| Quick summary (`quickSummaryModel`) | `gpt-5.4-nano` (or keep Flash-Lite default)    | Text-compression task. The default is `gemini-3.1-flash-lite`; swap to GPT-5.4 Nano if you'd rather keep all calls inside OpenAI (and your key set). |
| NotebookLM doc (`notebookLMModel`)  | `gpt-5.4`                                      | Set in the NotebookLM card, not Settings. Only runs if you generate a bundle.   |

If you want a quality/cost step down, swap `pdfModel` to GPT-5.4 Mini — that single change cuts roughly 65% off the PDF-analysis cost, since Stage 3 dominates the total.

The default `quickSummaryModel` is Gemini 3.1 Flash-Lite. If you only have an OpenAI API key (no Google key), the quick-summary calls will fail silently and the briefing will render without the inline-expansion summaries. Switching `quickSummaryModel` to GPT-5.4 Nano in Settings keeps everything inside OpenAI.

## 7. Cost estimate

With Balanced-configuration OpenAI models and the default 30-paper PDF cap:

- **~$1.40/run at 25 input papers**
- **~$3/run at 250 input papers** (Stage 3 caps at 30 papers; Stage 1/2 scale modestly with input)

Automatic prompt caching typically takes 20–40% off on repeat runs. See the [pricing table on the hub page](/getting-started/api-keys#cost-at-a-glance) for cross-provider comparison.

## 8. Common gotchas

- **Forgot to restart `npm run dev`.** Hot-reload doesn't pick up `.env.local` changes; restart the server.
- **Minimal API Test still runs against Google.** If you added the OpenAI key but didn't change a model slot in Settings, the test runs with Google models and won't exercise OpenAI at all. Swap at least one slot to a GPT model first.
- **`429 insufficient_quota` before any real usage.** You forgot the $5 deposit. Fix: **Settings → Billing → Add to credit balance**.
- **`model_not_found` for `gpt-5.4`.** Your org may not yet have access to the newest models. Check **Dashboard → Models**, or switch to `gpt-5.4-mini`.
- **Whitespace in the key.** Copy/paste sometimes adds a trailing space or a Windows CRLF line ending. Re-save `.env.local` with LF and no trailing whitespace.
- **Per-model rate limits are dashboard-only.** OpenAI no longer publishes consolidated tables; your current limits are at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits).

---

_Snapshot taken 2026-04-17. OpenAI pricing, tier thresholds, and signup flow may change. Verify against [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) and your console's live limits at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits) before committing to real spend._
