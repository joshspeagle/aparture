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

You pick each pipeline stage's model individually in the Settings panel. See [Model selection](/concepts/model-selection) for what each slot does and how Aparture uses it end to end; the table below is just the Anthropic picks for an all-Anthropic Balanced configuration.

| Stage                               | Model               |
| ----------------------------------- | ------------------- |
| Filter (`filterModel`)              | `claude-haiku-4.5`  |
| Scoring (`scoringModel`)            | `claude-sonnet-4.6` |
| PDF analysis (`pdfModel`)           | `claude-opus-4.7`   |
| Briefing (`briefingModel`)          | `claude-opus-4.7`   |
| Quick summary (`quickSummaryModel`) | `claude-haiku-4.5`  |
| NotebookLM doc (`notebookLMModel`)  | `claude-opus-4.7`   |

If you want a quality/cost step down, swap `pdfModel` to Sonnet 4.6 — that single change cuts roughly a third off a typical run, since PDF analysis dominates cost.

## 6. Cost estimate

### Per-model pricing

All Claude models bill per million tokens (MTok), separately for input and output. Input tokens are everything you send to the model (prompt, system message, PDF content, prior-paper context); output tokens are everything the model writes back, **including adaptive-thinking tokens** on Opus 4.7 (which can inflate output by 20–50% on hard prompts).

Current (April 2026) list pricing for every Anthropic model in Aparture's registry:

| Model                                                   | Context | Input ($/MTok) | Output ($/MTok) |
| ------------------------------------------------------- | ------- | -------------: | --------------: |
| `claude-opus-4.7` (recommended PDF + briefing)          | 1M      |             $5 |             $25 |
| `claude-opus-4.6`                                       | 1M      |             $5 |             $25 |
| `claude-sonnet-4.6` (recommended scoring)               | 1M      |             $3 |             $15 |
| `claude-haiku-4.5` (recommended filter + quick-summary) | 200k    |             $1 |              $5 |
| `claude-opus-4.5` (legacy)                              | 200k    |             $5 |             $25 |
| `claude-opus-4.1` (legacy)                              | 200k    |            $15 |             $75 |
| `claude-sonnet-4.5` (legacy)                            | 200k    |             $3 |             $15 |
| `claude-haiku-3.5` (legacy)                             | 200k    |            ~$1 |             ~$5 |

**Two discounts apply automatically to repeat runs** and aren't shown in list pricing:

- **Prompt caching.** Aparture marks the stable prefix of each prompt (template text + your profile) as cacheable. The first call writes the cache at ~1.25× input price; subsequent calls within ~5 minutes read it at ~0.1× input price. Across a session, this nets a 20–40% reduction on input tokens.
- **Cache warmup on parallel PDFs.** Stage 4 runs Anthropic's first PDF call alone before releasing the other workers, so the cache entry is primed once instead of racing N parallel cache-creates. See [Parallel PDF analyses](/using/tuning-the-pipeline#parallel-pdf-analyses).

### Worked calculation: Balanced at 100 input papers

Assume 100 fetched papers, 60 pass the filter and get scored, 30 go through PDF analysis (hitting the default `maxDeepAnalysis` cap of 30).

| Stage                    | Model      | Input tokens | Output tokens | Cost                                    |
| ------------------------ | ---------- | ------------ | ------------- | --------------------------------------- |
| Filter (100 abstracts)   | Haiku 4.5  | ~40,000      | ~5,000        | 40k × $1 / MTok + 5k × $5 = ~$0.07      |
| Scoring (60 abstracts)   | Sonnet 4.6 | ~48,000      | ~9,000        | 48k × $3 + 9k × $15 = ~$0.28            |
| PDF analysis (30 papers) | Opus 4.7   | ~540,000     | ~60,000       | 540k × $5 + 60k × $25 = ~$4.20          |
| Quick summaries (30)     | Haiku 4.5  | ~45,000      | ~12,000       | 45k × $1 + 12k × $5 = ~$0.11            |
| Briefing synthesis       | Opus 4.7   | ~12,000      | ~3,000        | 12k × $5 + 3k × $25 = ~$0.14            |
| Hallucination audit      | Opus 4.7   | ~8,000       | ~600          | 8k × $5 + 0.6k × $25 = ~$0.06           |
| **Total, list price**    |            |              |               | **~$4.86**                              |

The PDF-analysis output-token count includes adaptive-thinking tokens (Opus 4.7 uses roughly 1000–2000 output tokens per paper with thinking on). For a non-thinking model like Opus 4.6 or Sonnet 4.6, output is closer to ~30,000 tokens total and the PDF-analysis stage lands at ~$3.20 instead of ~$4.20.

With prompt caching on repeat runs (same profile, same category set, within ~5 min of the first call), expect **~$3.00–3.90 per run** after the first.

### Scaling to other input volumes

Stage 4 caps at the top N papers (default 30), so past ~50 input papers the PDF-analysis cost stops growing. Stages 2 and 3 scale roughly linearly:

- **25 papers in** (15 PDFs): ~$2.40 list / ~$1.70 with caching
- **100 papers in** (30 PDFs, capped): ~$4.90 list / ~$3.40 with caching
- **250 papers in** (30 PDFs, capped): ~$5.40 list / ~$3.80 with caching — PDF analysis plateaus; filter + scoring become the delta

For authoritative pricing verify against Anthropic's [models page](https://platform.claude.com/docs/en/docs/about-claude/models) and [pricing page](https://claude.com/pricing) before committing to real spend.

## 7. Common gotchas

- **Forgot to restart `npm run dev`.** Easily the most common cause of "my key isn't working". Hot-reload doesn't pick up `.env.local` changes reliably; stop the server and start it again.
- **Minimal API Test still runs against Google.** If you added the Claude key but didn't change a model slot in Settings, the test runs with Google models and won't exercise Anthropic at all. Swap at least one slot to a Claude model first.
- **Copied only the masked preview.** If you missed the full key at creation, revoke and recreate. There's no "show full key" button anywhere.
- **Starter credit expired.** The ~$5 new-account credit has an expiration, typically 14–30 days. If you signed up months ago without using it, check **Settings → Billing → Credit history**.
- **Slow PDF analysis on a new account.** Tier 1 has tight rate limits — a 20-paper deep-analysis stage on Opus can take ~40 minutes. Tier 2 unlocks automatically at ~$40 cumulative spend; until then, Sonnet 4.6 is a much faster option for the PDF stage ([tuning the pipeline](/using/tuning-the-pipeline)).
- **First PDF feels slow even though analysis is parallel.** Aparture runs a single cache-warmup call before releasing sibling workers on Anthropic, so the first paper takes 3–6 s longer than subsequent ones. This is deliberate — it primes the prompt-cache entry so the remaining N-1 papers hit the cache instead of racing parallel cache-creates. See [Parallel PDF analyses](/using/tuning-the-pipeline#parallel-pdf-analyses).

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Snapshot taken 2026-04-19. Anthropic pricing, tier thresholds, and signup flow may change. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/api/overview) and [claude.com/pricing](https://claude.com/pricing) before committing to real spend._
