# API keys

Aparture routes LLM calls through Anthropic ([Claude](https://claude.com)), OpenAI ([GPT](https://chatgpt.com)), or Google ([Gemini](https://gemini.google.com)). You need at least one provider key to run the pipeline. You can mix providers across stages — the default config already does — and you can add more providers later without reconfiguring anything else.

## TL;DR

Pick one provider to start. If you have no strong preference, **start with Google AI** — its free tier covers a full all-Flash-model run end-to-end, and no credit card is required. Aparture's default model slots are all-Google out of the box, so a Google key also requires the least fiddling in Settings.

## Pick a provider

The current-generation models from all three providers are broadly comparable on the tasks Aparture performs. The decision is mostly about cost structure and setup friction.

<div class="landing-cards">

<a class="landing-card" href="/aparture/getting-started/api-keys-anthropic.html">
  <h3>Anthropic Claude</h3>
  <p>New accounts get a one-time ~$5 starter credit. Aparture has prompt caching wired in explicitly for Anthropic, so repeated runs with the same profile typically come in 20–40% below list pricing.</p>
</a>

<a class="landing-card" href="/aparture/getting-started/api-keys-google.html">
  <h3>Google Gemini</h3>
  <p>Free tier covers an all-Flash model setup end-to-end, and no credit card is needed to start. Using Gemini 3.1 Pro (the stronger model Aparture defaults to for PDF analysis and briefing) requires enabling billing.</p>
</a>

<a class="landing-card" href="/aparture/getting-started/api-keys-openai.html">
  <h3>OpenAI GPT</h3>
  <p>Requires a $5 minimum prepaid deposit to activate API access — no free trial. OpenAI's platform caches repeated prompt prefixes automatically, so real cost on repeat runs tracks 20–40% below list.</p>
</a>

</div>

## After you get your key

Whichever provider you picked, the steps back in Aparture are the same:

1. Open `.env.local` in the project root. Confirm `ACCESS_PASSWORD` is set — see the [install page](/getting-started/install#_3-set-a-local-access-password) if you skipped that step.
2. Paste your API key under the right variable name:
   - `CLAUDE_API_KEY=sk-ant-api03-...` for Anthropic
   - `GOOGLE_AI_API_KEY=AIzaSy...` for Google
   - `OPENAI_API_KEY=sk-proj-...` for OpenAI
3. Restart `npm run dev` if it was already running. Next.js reads `.env.local` once at server startup.
4. Run the [Minimal API Test](/getting-started/verify-setup) from the UI. That's a 5-paper end-to-end test that confirms your key authenticates and the pipeline runs cleanly.

Aparture's defaults are all-Google. If you picked Anthropic or OpenAI, the Minimal API Test still hits Google unless you switch at least one model slot in Settings to the provider you just set up. The per-provider pages walk through this.

## How Aparture uses models

Aparture splits work across five LLM slots — filter, scoring, PDF analysis, briefing, and quick-summary compression — and runs each at a different point in the pipeline. Which model to put in which slot is the central configuration decision; [Model selection](/concepts/model-selection) is the dedicated page for that choice, and the per-provider pages below give a recommended all-provider lineup for each.

The common shape across these lineups is: a weak-but-fast model for filtering, a medium model for abstract scoring, a strong-but-slower model for PDF analysis and briefing synthesis, and the weak/fast model again for per-paper quick-summary compression. That's also the default shape the app ships with, and what the cost tables below assume.

For a narrated end-to-end tour of what each stage actually does in the UI, see [Your first briefing](/using/first-briefing).

## Cost at a glance

All three providers follow the same pipeline: quick filter runs on every input paper, abstract scoring runs on survivors, PDF analysis runs on the top N papers (default N=30, configurable via `maxDeepAnalysis` in Settings), and briefing synthesis runs once per run.

Because Stage 4 caps at the top N, cost flattens at high input volumes — PDF analysis dominates on small runs, filter + scoring dominate on large ones.

Per-stage breakdown for the recommended picks on each provider. The reference case is a run where 100 papers are fetched, ~50 pass the filter to scoring, and 20 reach deep PDF analysis; the 250-paper column shows what happens at a high input volume where the PDF cap (default 30) kicks in. Totals are list price (no caching); caching discount applies on repeat runs.

### Anthropic

| Stage                   | Model             | 100 papers in | 250 papers in |
| ----------------------- | ----------------- | ------------: | ------------: |
| Filter                  | Claude Haiku 4.5  |         $0.07 |         $0.16 |
| Scoring                 | Claude Sonnet 4.6 |         $0.23 |         $0.47 |
| PDFs + briefing + audit | Claude Opus 4.7   |         $2.99 |         $4.45 |
| Quick summaries         | Claude Haiku 4.5  |         $0.07 |         $0.11 |
| **Total / run**         |                   |    **~$3.35** |    **~$5.20** |

### Google

| Stage                   | Model                 | 100 papers in | 250 papers in |
| ----------------------- | --------------------- | ------------: | ------------: |
| Filter                  | Gemini 3.1 Flash-Lite |         $0.02 |         $0.04 |
| Scoring                 | Gemini 3 Flash        |         $0.04 |         $0.09 |
| PDFs + briefing + audit | Gemini 3.1 Pro        |         $1.28 |         $1.91 |
| Quick summaries         | Gemini 3.1 Flash-Lite |         $0.02 |         $0.03 |
| **Total / run**         |                       |    **~$1.35** |    **~$2.05** |

### OpenAI

| Stage                   | Model        | 100 papers in | 250 papers in |
| ----------------------- | ------------ | ------------: | ------------: |
| Filter                  | GPT-5.4 Nano |         $0.01 |         $0.04 |
| Scoring                 | GPT-5.4 Mini |         $0.06 |         $0.13 |
| PDFs + briefing + audit | GPT-5.4      |         $1.61 |         $2.39 |
| Quick summaries         | GPT-5.4 Nano |         $0.02 |         $0.02 |
| **Total / run**         |              |    **~$1.70** |    **~$2.60** |

Prompt caching (explicit on Anthropic, automatic on OpenAI, not wired for Google) takes another 20–40% off on repeat runs with the same profile.

## Can I run completely free?

Yes, if you configure Aparture's slots to stay within the Gemini Flash family (Flash, Flash-Lite, and the 3.x preview counterparts) — all of those are free for free-tier accounts. The only Gemini model that isn't free is Gemini 3.1 Pro Preview, which Aparture's out-of-the-box defaults use for PDF analysis and briefing. If you want everything free on Google, swap those two slots to a Flash model in Settings.

Two caveats worth knowing up front:

1. **Daily request caps apply on the free tier.** A 25-papers/day run fits comfortably; a 250-papers/day run can trip the cap. Your current per-model limits are visible after signing in at the [AI Studio dashboard](https://aistudio.google.com/), and described at a high level at the [Gemini API rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits).
2. **Free-tier users cannot opt out of training-data collection.** If your profile contains sensitive research notes, upgrade to paid Tier 1 (a $10 prepaid credit) to enable opt-out. More on the [Google setup page](/getting-started/api-keys-google).

## Reference: provider table

Quick lookup for key formats, env-var names, and signup URLs:

|                             | Anthropic (Claude)                                  | Google (Gemini)                                                  | OpenAI (GPT)                                              |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| **Free tier**               | ~$5 starter credit, one-time                        | Yes (covers an all-Flash setup)                                  | None                                                      |
| **Billing to start**        | Not required for starter credit                     | Not required for free tier                                       | $5 minimum deposit                                        |
| **Key format**              | `sk-ant-api03-...`                                  | `AIzaSy...`                                                      | `sk-proj-...`                                             |
| **Env var in `.env.local`** | `CLAUDE_API_KEY`                                    | `GOOGLE_AI_API_KEY`                                              | `OPENAI_API_KEY`                                          |
| **Prompt caching**          | Wired in explicitly                                 | Not yet wired in                                                 | Automatic                                                 |
| **Signup page**             | [platform.claude.com](https://platform.claude.com/) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | [platform.openai.com](https://platform.openai.com/signup) |

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Pricing snapshot taken 2026-04-19. Provider pricing, free-tier policies, and rate-limit tiers drift over time. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/docs/about-claude/models), [developers.openai.com/api/docs](https://developers.openai.com/api/docs/pricing), and [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before committing to production volumes._
