# Anthropic (Claude) API key

This page walks you through creating an Anthropic API key and wiring it into Aparture so the pipeline can call Claude models. If you haven't picked a provider yet, [Google AI](/getting-started/api-keys-google) is the easier on-ramp: Aparture's default model slots are all Google, and the free tier covers them.

Two things worth knowing about Anthropic before you start:

- New accounts get a **one-time ~$5 starter credit**, which is enough to run a few small Aparture runs before you need to top up. You can try it without entering a credit card.
- Aparture caches the rubric and your profile on Anthropic calls, so repeat calls within a few minutes of each other read that part of the prompt at a fraction of the input price.

## 1. Sign up

Head to [platform.claude.com](https://platform.claude.com/) and create an account. You can sign in with Google, GitHub, or a plain email address.

Anthropic requires SMS phone verification at signup, and it rejects VoIP numbers like Google Voice. The phone number you verify can't be changed later, so use one you expect to have long-term access to.

## 2. Create an API key

Once you're signed in, navigate to **Settings → API Keys → Create Key**.

Give the key a recognisable name (something like `aparture-local` works) so you can identify it later in the usage log. If you want a safety net on spend, you can set a per-key monthly cap at creation time; $20–50 is a reasonable starting point for a personal Aparture deployment.

**Copy the key immediately once it appears.** Anthropic shows the full value exactly once; afterwards, you'll only see a masked preview. If you close the dialog without copying, revoke the key and create a new one.

The key format is `sk-ant-api03-<...>`.

## 3. Add to `.env.local`

Open `.env.local` in the Aparture project root and paste the key:

```bash
CLAUDE_API_KEY=sk-ant-api03-your-actual-key-here
```

No quotes, no spaces around `=`. Restart `npm run dev` if it's already running; Next.js reads `.env.local` at server startup and may not pick up the change otherwise.

If you haven't already set `ACCESS_PASSWORD` in the same file, see the [install page](/getting-started/install#_3-set-a-local-access-password). Both values live in `.env.local`; the web UI can't launch without a password.

## 4. Verify

Aparture's default model slots are all Google, so adding a Claude key alone doesn't route anything to Anthropic yet. To test your key, switch at least one slot to a Claude model first:

1. Start (or restart) `npm run dev` and log in.
2. Open the **Settings** panel.
3. Change the `pdfModel` slot to `claude-sonnet-5.5` or `claude-opus-5.5`. This is the most expensive stage and the clearest signal that your key works.
4. Back in the Control Panel, run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free), then the [Minimal API Test](/getting-started/verify-setup). The setup check validates the key, the model ID, and the request syntax for free.

Expect about $0.50 on the 5-paper test with Sonnet 5.5 on the PDF slot, or $0.90 with Opus 5.5, with the other slots on their Google defaults. Thinking tokens come on top.

If the key is missing, the activity log shows `no API key for anthropic: set CLAUDE_API_KEY in .env.local and restart the server` (the env var is unset or misspelled). If it is malformed or revoked, Anthropic's own authentication error appears instead.

## 5. Recommended models

You pick each pipeline stage's model individually in the Settings panel. See [Model selection](/concepts/model-selection) for what each slot does; the table below is the recommended all-Anthropic lineup.

| Stage                               | Model               |
| ----------------------------------- | ------------------- |
| Filter (`filterModel`)              | `claude-haiku-5.5`  |
| Scoring (`scoringModel`)            | `claude-sonnet-5.5` |
| PDF analysis (`pdfModel`)           | `claude-opus-5.5`   |
| Briefing (`briefingModel`)          | `claude-opus-5.5`   |
| Quick summary (`quickSummaryModel`) | `claude-haiku-5.5`  |
| Podcast outline (`notebookLMModel`) | `claude-opus-5.5`   |

::: warning Post-processing stays on Google unless you change it
Stage 3.5 runs on `postProcessingModel`, which defaults to `gemini-3.6-flash` and doesn't follow your other choices. With no Google key, pick a Claude model as the **Review Model** under **Enable Post-Processing** in Settings, or turn post-processing off; otherwise every Stage 3.5 batch fails and the run keeps the Stage 3 scores.
:::

For a quality/cost step down, put `claude-sonnet-5.5` on `pdfModel`; that halves the most expensive stage, and the reference run below drops from about $3.93 to $2.43. For a step up on the briefing, `claude-fable-5.1` costs 2.5 times as much as Opus 5.5 (about $4.87 for the reference run); see the notes below before putting it in a per-paper slot.

## 6. Cost estimate

### Per-model pricing

Claude models bill per million tokens (MTok), separately for input and output. Input tokens are everything you send (prompt, profile, PDF content); output tokens are everything the model writes back, **including adaptive-thinking tokens**, which every current Claude model uses.

List pricing for every Anthropic model in Aparture's registry:

| Model                                                     | Context | Input ($/MTok) | Output ($/MTok) |
| --------------------------------------------------------- | ------- | -------------: | --------------: |
| `claude-fable-5.1`†                                       | 1M      |            $10 |             $50 |
| `claude-opus-5.5` (recommended PDF + briefing)            | 1M      |             $4 |             $20 |
| `claude-sonnet-5.5` (recommended scoring)                 | 1M      |             $2 |             $10 |
| `claude-haiku-5.5`\* (recommended filter + quick summary) | 1M      |          $0.10 |           $0.50 |
| `claude-fable-5`†                                         | 1M      |            $10 |             $50 |
| `claude-opus-5`                                           | 1M      |             $5 |             $25 |
| `claude-sonnet-5`                                         | 1M      |             $2 |             $10 |
| `claude-haiku-4.5`                                        | 200k    |             $1 |              $5 |

\* `claude-haiku-5.5`'s price holds for prompts up to 100K tokens. Longer prompts bill at $0.50 / $2.50, which a long PDF can reach if you put Haiku on `pdfModel`.

† The Fable models are the most expensive in the registry, and their thinking is always on, so you can't trade thinking tokens away to claw the cost back. They also **require your Anthropic organization's data retention to be set to 30 days**; under zero data retention every request fails with a 400 that looks like a malformed-payload error rather than a policy one. Worth trying on `briefingModel` if editorial quality matters most to you; hard to justify on `pdfModel`, where the premium multiplies across every paper.

The October 2026 refresh removed Opus 4.6–4.8 and Sonnet 4.6. Saved configs that pointed at them move to Opus 5.5 and Sonnet 5.5 the next time the app loads.

**Two cache effects apply automatically to repeat calls** and aren't in list pricing:

- **Prompt caching.** Aparture marks the stable prefix of each prompt (the template text and your profile) as cacheable. The first call writes the cache at a small premium; calls within about five minutes read it at a fraction of the input price. PDFs and abstracts aren't part of the cached prefix.
- **Cache warmup on parallel PDFs.** Stage 4 runs Anthropic's first PDF call alone before releasing the other workers, so the cache entry is written once instead of by N parallel calls. See [Parallel PDF calls](/using/tuning-the-pipeline#parallel-pdf-calls).

### Worked calculation: 100 input papers (Anthropic lineup)

Reference case: 100 fetched papers, 50 pass the filter and are scored and post-processed, 20 go through PDF analysis (below the default cap of 30). Token counts are the app's own per-paper planning estimates, and they leave out thinking tokens.

| Stage                       | Model             | Input tokens | Output tokens | Cost                              |
| --------------------------- | ----------------- | ------------ | ------------- | --------------------------------- |
| Filter (100 abstracts)      | Haiku 5.5         | ~50,000      | ~10,000       | 50k × $0.10 + 10k × $0.50 = $0.01 |
| Scoring (50 abstracts)      | Sonnet 5.5        | ~40,000      | ~10,000       | 40k × $2 + 10k × $10 = $0.18      |
| Post-processing (50 papers) | Gemini 3.6 Flash† | ~35,000      | ~6,000        | 35k × $1.50 + 6k × $7.50 = $0.10  |
| PDF analysis (20 papers)    | Opus 5.5          | ~600,000     | ~30,000       | 600k × $4 + 30k × $20 = $3.00     |
| Quick summaries (20)        | Haiku 5.5         | ~40,000      | ~6,000        | 40k × $0.10 + 6k × $0.50 = $0.01  |
| Briefing synthesis + audit  | Opus 5.5          | ~108,000     | ~10,000       | 108k × $4 + 10k × $20 = $0.63     |
| **Total, list price**       |                   |              |               | **~$3.93**                        |

† Post-processing stays on its Google default (see the warning above). Without a Google key, turn it off; the total drops to about $3.83.

Thinking adds output tokens on every row; on the PDF and briefing rows that is usually the biggest difference between this estimate and a real run. After a run, the Download Report card shows the estimate from the tokens the run actually used.

### Scaling to other input volumes

Filter and scoring scale linearly with input volume. Stage 4 scales with how many papers you deep-analyse, and the default cap of 30 binds at higher volumes:

- **50 papers in** (10 PDFs): ~$2.05 list
- **100 papers in** (20 PDFs): ~$3.93 list (reference case above)
- **250 papers in** (30 PDFs, at cap): ~$5.95 list. PDF analysis plateaus at the cap; filter and scoring keep growing.

For authoritative pricing, check Anthropic's [models page](https://platform.claude.com/docs/en/docs/about-claude/models) and [pricing page](https://claude.com/pricing) before committing to real spend.

## 7. Common gotchas

- **Forgot to restart `npm run dev`.** Easily the most common cause of "my key isn't working". Stop the server and start it again after editing `.env.local`.
- **Minimal API Test still runs against Google.** If you added the Claude key but didn't change a model slot in Settings, the test runs on Google models and doesn't exercise Anthropic at all. Swap at least one slot to a Claude model first.
- **Stage 3.5 errors without a Google key.** See the warning under Recommended models: post-processing stays on its Google default unless you turn it off or edit the saved config.
- **Copied only the masked preview.** If you missed the full key at creation, revoke and recreate. There's no "show full key" button anywhere.
- **Starter credit expired.** The ~$5 new-account credit has an expiration, typically 14–30 days. If you signed up months ago without using it, check **Settings → Billing → Credit history**.
- **Slow PDF analysis on a new account.** Tier 1 has tight rate limits, so a 20-paper deep-analysis stage on Opus can take a long time. Tier 2 unlocks automatically after enough cumulative spend; until then, Sonnet 5.5 is a faster option for the PDF stage ([tuning the pipeline](/using/tuning-the-pipeline)).
- **First PDF feels slow even though analysis is parallel.** Aparture runs a single cache-warmup call before releasing sibling workers on Anthropic, so the first paper takes a few seconds longer than the rest. This is deliberate: it writes the prompt-cache entry once so the remaining papers read it instead of each writing their own. See [Parallel PDF calls](/using/tuning-the-pipeline#parallel-pdf-calls).

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Pricing snapshot taken 2026-10-17 from the model registry. Anthropic pricing, tier thresholds, and signup flow may change. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/api/overview) and [claude.com/pricing](https://claude.com/pricing) before committing to real spend._
