# Anthropic (Claude) API key

This page walks you through creating an Anthropic API key and wiring it into Aparture so the pipeline can call Claude models. If you haven't picked a provider yet, [Google AI](/getting-started/api-keys-google) is the easier on-ramp — Aparture's default model slots are already all-Google, and the free tier covers an all-Flash setup end-to-end.

Two things worth knowing about Anthropic before you start:

- New accounts get a **one-time ~$5 starter credit**, which is enough to run a few small Aparture runs before you need to top up. You can kick the tires without entering a credit card.
- Aparture has prompt caching wired in explicitly for Anthropic calls, so repeat runs with the same profile typically come in 20–40% below list pricing once the cache warms up.

## 1. Sign up

Head to [platform.claude.com](https://platform.claude.com/) and create an account. You can sign in with Google, GitHub, or a plain email address.

Anthropic requires SMS phone verification at signup, and it rejects VoIP numbers like Google Voice. The phone number you verify can't be changed later, so use one you expect to have long-term access to.

## 2. Create an API key

Once you're signed in, navigate to **Settings → API Keys → Create Key**.

Give the key a recognisable name (something like `aparture-local` works) so you can identify it later in the usage log. If you want a safety net on spend, you can set a per-key monthly cap at creation time — $20–50 is a reasonable starting point for a personal Aparture deployment.

**Copy the key immediately once it appears.** Anthropic shows the full value exactly once; afterwards, you'll only see a masked preview. If you close the dialog without copying, revoke the key and create a new one.

The key format is `sk-ant-api03-<...>`.

## 3. Add to `.env.local`

Open `.env.local` in the Aparture project root and paste the key:

```bash
CLAUDE_API_KEY=sk-ant-api03-your-actual-key-here
```

No quotes, no spaces around `=`. Restart `npm run dev` if it's already running — Next.js reads `.env.local` once at server startup and won't pick up the change otherwise.

If you haven't already set `ACCESS_PASSWORD` in the same file, see the [install page](/getting-started/install#_3-set-a-local-access-password). Both values live in `.env.local`; the web UI can't launch without a password.

## 4. Verify

Aparture's default model slots are all-Google, so adding a Claude key alone doesn't route anything to Anthropic yet. To actually test your key, switch at least one slot to a Claude model first:

1. Start (or restart) `npm run dev` and log in.
2. Open the **Settings** panel.
3. Change the `pdfModel` slot to `claude-sonnet-4.6` or `claude-opus-4.7`. This is the most expensive stage and the clearest signal that your key works.
4. Back in the Control Panel, run the [Minimal API Test](/getting-started/verify-setup).

Expect ~$0.50–$1 on the 5-paper test once the PDF stage is running on Claude.

If the key is invalid, you'll see `"Anthropic API key not found"` (env var missing or misspelled) or an HTTP 401 response (key malformed or revoked).

## 5. Recommended models

You pick each pipeline stage's model individually in the Settings panel. For an all-Anthropic Balanced configuration:

| Stage                               | Model                                     | Notes                                                                                                   |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Filter (`filterModel`)              | `claude-haiku-4.5`                        | Fast and cheap; filtering is high-volume.                                                               |
| Scoring (`scoringModel`)            | `claude-sonnet-4.6`                       | Middle of the range. Haiku 4.5 works too if you want cheaper.                                           |
| PDF analysis (`pdfModel`)           | `claude-opus-4.7`                         | Strongest option, most expensive stage. Sonnet 4.6 is a ~40% cheaper drop-in with a modest quality hit. |
| Briefing (`briefingModel`)          | `claude-opus-4.7`                         | Synthesis + hallucination check.                                                                        |
| Quick summary (`quickSummaryModel`) | `claude-haiku-4.5` (or keep Flash-Lite default) | Text-compression task. The default is `gemini-3.1-flash-lite` across all providers; swap to Haiku if you'd rather keep all calls inside Anthropic (and your key set). |
| NotebookLM doc (`notebookLMModel`)  | `claude-opus-4.7`                         | Set in the NotebookLM card, not Settings. Only runs if you generate a bundle.                           |

If you want a quality/cost step down, swap `pdfModel` to Sonnet 4.6 — that single change cuts roughly a third off a typical run, since PDF analysis dominates cost.

The default `quickSummaryModel` is Gemini 3.1 Flash-Lite. If you only have a Claude API key (no Google key), the quick-summary calls will fail silently and the briefing will render without the inline-expansion summaries. Switching `quickSummaryModel` to Claude Haiku 4.5 in Settings keeps everything inside Anthropic.

## 6. Cost estimate

With Balanced-configuration Anthropic models and the default 30-paper PDF cap:

- **~$2.60/run at 25 input papers**
- **~$7/run at 250 input papers** (Stage 1/2 scale with input; Stage 3 caps at 30 papers, so total grows modestly)

Prompt caching takes another 20–40% off on repeat runs. See the [pricing table on the hub page](/getting-started/api-keys#cost-at-a-glance) for cross-provider comparison.

## 7. Common gotchas

- **Forgot to restart `npm run dev`.** Easily the most common cause of "my key isn't working". Hot-reload doesn't pick up `.env.local` changes reliably; stop the server and start it again.
- **Minimal API Test still runs against Google.** If you added the Claude key but didn't change a model slot in Settings, the test runs with Google models and won't exercise Anthropic at all. Swap at least one slot to a Claude model first.
- **Copied only the masked preview.** If you missed the full key at creation, revoke and recreate. There's no "show full key" button anywhere.
- **Starter credit expired.** The ~$5 new-account credit has an expiration, typically 14–30 days. If you signed up months ago without using it, check **Settings → Billing → Credit history**.
- **Slow PDF analysis on a new account.** Tier 1 has tight rate limits — a 20-paper deep-analysis stage on Opus can take ~40 minutes. Tier 2 unlocks automatically at ~$40 cumulative spend; until then, Sonnet 4.6 is a much faster option for the PDF stage ([tuning the pipeline](/using/tuning-the-pipeline)).

---

_Snapshot taken 2026-04-17. Anthropic pricing, tier thresholds, and signup flow may change. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/api/overview) and [claude.com/pricing](https://claude.com/pricing) before committing to real spend._
