# API keys

Aparture routes LLM calls through Anthropic ([Claude](https://claude.com)), OpenAI ([GPT](https://chatgpt.com)), or Google ([Gemini](https://gemini.google.com)). You need at least one provider key to run the pipeline. You can mix providers across stages, and you can add providers later without reconfiguring anything else.

## TL;DR

Pick one provider to start. If you have no strong preference, **start with Google AI**: Aparture's default model slots are all Google models that Google's free tier covers, and no credit card is required.

## Pick a provider

The current models from all three providers handle the tasks Aparture performs well. The decision is mostly about cost structure and setup friction.

<div class="landing-cards">

<a class="landing-card" href="/aparture/getting-started/api-keys-anthropic.html">
  <h3>Anthropic Claude</h3>
  <p>New accounts get a one-time ~$5 starter credit. Every current Claude model uses adaptive thinking, and Aparture caches the rubric and your profile on Anthropic calls.</p>
</a>

<a class="landing-card" href="/aparture/getting-started/api-keys-google.html">
  <h3>Google Gemini</h3>
  <p>The free tier covers every default model, and no credit card is needed to start. Only the Gemini 4 Argon upgrade needs billing. An older, unrestricted key needs a restriction to the Gemini API first.</p>
</a>

<a class="landing-card" href="/aparture/getting-started/api-keys-openai.html">
  <h3>OpenAI GPT</h3>
  <p>Calls need prepaid credit, and there's no free trial; $5 is enough to start. OpenAI caches repeated prompt prefixes automatically.</p>
</a>

</div>

## After you get your key

Whichever provider you picked, the steps back in Aparture are the same:

1. Open `.env.local` in the project root. Confirm `ACCESS_PASSWORD` is set; see the [install page](/getting-started/install#_3-set-a-local-access-password) if you skipped that step.
2. Paste your API key under the right variable name:
   - `CLAUDE_API_KEY=sk-ant-api03-...` for Anthropic
   - `GOOGLE_AI_API_KEY=...` for Google (paste it as AI Studio shows it)
   - `OPENAI_API_KEY=sk-proj-...` for OpenAI
3. Restart `npm run dev` if it was already running. Next.js reads `.env.local` at server startup.
4. Run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free) from the UI. It verifies the key, every configured model ID, and (on Anthropic and Google) request syntax for free, without sampling any tokens.
5. Run the [Minimal API Test](/getting-started/verify-setup) from the UI. That's a 5-paper end-to-end test that confirms your key authenticates and the pipeline runs cleanly.

Aparture's defaults are all Google. If you picked Anthropic or OpenAI, the Minimal API Test still calls Google unless you switch at least one model slot in Settings to the provider you just set up. The per-provider pages walk through this.

## How Aparture uses models

Aparture has six pipeline model slots (filter, scoring, post-processing, PDF analysis, briefing, and quick summaries) plus one for the podcast add-on, and each runs at a different point in the pipeline. Which model goes in which slot is the central configuration decision; [Model selection](/concepts/model-selection) covers it, and the per-provider pages below give a recommended single-provider lineup for each.

The lineups share a shape: a fast, cheap model for filtering and quick summaries, a mid-tier model for abstract scoring, and the strongest model you're willing to pay for on PDF analysis and the briefing. The defaults follow it with Gemini models: 3.5 Flash-Lite for the filter and quick summaries, 3.6 Flash for scoring, and 3.8 Flash for PDFs and the briefing.

For a narrated end-to-end tour of what each stage does in the UI, see [Your first briefing](/using/first-briefing).

## Cost at a glance

The quick filter runs on every fetched paper, abstract scoring runs on the papers that pass, PDF analysis runs on the top N (default 30, set by **Papers to Analyze** in Settings), and briefing synthesis plus its audit run once per run. Because Stage 4 stops at the top N, cost flattens at high input volumes.

The tables below use the per-paper token estimates the app uses for its own gate projections. The reference case fetches 100 papers, scores and post-processes 50, and reads 20 in full; the 250-paper column scores 125, post-processes 50 (the default cap), and reads 30, where the PDF cap binds. Totals are list price without caching, and they leave out thinking tokens, which bill as output on thinking models. Rows are rounded to the cent, so a column can sum a cent or two away from its total. Treat them as planning numbers.

### Anthropic

| Stage            | Model              | 100 papers in | 250 papers in |
| ---------------- | ------------------ | ------------: | ------------: |
| Filter           | Claude Haiku 5.5   |         $0.01 |         $0.03 |
| Scoring          | Claude Sonnet 5.5  |         $0.18 |         $0.45 |
| Post-processing  | Gemini 3.6 Flash\* |         $0.10 |         $0.10 |
| PDF analysis     | Claude Opus 5.5    |         $3.00 |         $4.50 |
| Briefing + audit | Claude Opus 5.5    |         $0.63 |         $0.86 |
| Quick summaries  | Claude Haiku 5.5   |         $0.01 |         $0.01 |
| **Total / run**  |                    |    **~$3.93** |    **~$5.95** |

Putting Claude Sonnet 5.5 on PDF analysis instead halves that stage, to about $1.50 on the reference run.

### Google (the defaults)

| Stage            | Model                 | 100 papers in | 250 papers in |
| ---------------- | --------------------- | ------------: | ------------: |
| Filter           | Gemini 3.5 Flash-Lite |         $0.04 |         $0.10 |
| Scoring          | Gemini 3.6 Flash      |         $0.14 |         $0.34 |
| Post-processing  | Gemini 3.6 Flash      |         $0.10 |         $0.10 |
| PDF analysis     | Gemini 3.8 Flash      |         $1.13 |         $1.69 |
| Briefing + audit | Gemini 3.8 Flash      |         $0.24 |         $0.32 |
| Quick summaries  | Gemini 3.5 Flash-Lite |         $0.03 |         $0.04 |
| **Total / run**  |                       |    **~$1.66** |    **~$2.59** |

Those are list prices. Through 2026-12-31 Google sells 3.6 Flash and 3.8 Flash at half price, which brings the totals to about $0.86 and $1.36. Within the free tier's daily caps the run costs nothing.

### OpenAI

| Stage            | Model              | 100 papers in | 250 papers in |
| ---------------- | ------------------ | ------------: | ------------: |
| Filter           | GPT-6 Luna         |         $0.01 |         $0.03 |
| Scoring          | GPT-6.1 Sol        |         $0.18 |         $0.45 |
| Post-processing  | Gemini 3.6 Flash\* |         $0.10 |         $0.10 |
| PDF analysis     | GPT-6.1 Sol        |         $1.50 |         $2.25 |
| Briefing + audit | GPT-6.1 Sol        |         $0.32 |         $0.43 |
| Quick summaries  | GPT-6 Luna         |         $0.01 |         $0.01 |
| **Total / run**  |                    |    **~$2.11** |    **~$3.26** |

\* Post-processing runs on `postProcessingModel`, which stays on its Google default whichever provider you pick for the other slots. Without a Google key, change its **Review Model** drop-down (under **Enable Post-Processing** in Settings) to a model your key covers, or turn post-processing off and leave that row out.

Prompt caching takes something off repeat calls with the same profile. Aparture marks the rubric and your profile as cacheable on Anthropic; OpenAI caches repeated prefixes on its own, and so does Google above a minimum prompt size. The abstracts and PDFs differ from call to call, so the saving applies only to the rubric-and-profile part of each prompt.

## Can I run completely free?

Yes. Every default model (Gemini 3.5 Flash-Lite, 3.6 Flash, and 3.8 Flash) is covered by Google's free tier. The registered Gemini models that aren't are Gemini 4 Argon, which is paid-tier only, and the legacy Gemini 2.5 models, which Google now limits to accounts that used them before.

Two caveats worth knowing up front:

1. **Daily request caps apply on the free tier.** A 25-papers/day run fits comfortably; a 250-papers/day run can trip the cap. Your current per-model limits are visible after signing in at the [AI Studio dashboard](https://aistudio.google.com/), and described at a high level at the [Gemini API rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits).
2. **Google uses free-tier prompts and responses to improve its products.** On the paid tier it doesn't. If your profile contains research notes you'd rather keep out of that, move to paid Tier 1, which takes a $5 prepayment. More on the [Google setup page](/getting-started/api-keys-google#free-tier).

## Reference: provider table

Quick lookup for key formats, env-var names, and signup URLs:

|                             | Anthropic (Claude)                                  | Google (Gemini)                                                         | OpenAI (GPT)                                              |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| **Free tier**               | ~$5 starter credit, one-time                        | Yes (covers every default model)                                        | No free credit                                            |
| **Billing to start**        | Not required for starter credit                     | Not required for free tier                                              | Prepaid credit; $5 to start                               |
| **Key format**              | `sk-ant-api03-...`                                  | `AIza...` for standard keys, which must be restricted to the Gemini API | `sk-proj-...`                                             |
| **Env var in `.env.local`** | `CLAUDE_API_KEY`                                    | `GOOGLE_AI_API_KEY`                                                     | `OPENAI_API_KEY`                                          |
| **Prompt caching**          | Wired in explicitly                                 | Automatic above a minimum prompt size                                   | Automatic                                                 |
| **Signup page**             | [platform.claude.com](https://platform.claude.com/) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey)        | [platform.openai.com](https://platform.openai.com/signup) |

## Next

Key added and dev server restarted? Confirm it works: [Verify your setup →](/getting-started/verify-setup)

---

_Pricing snapshot taken 2026-10-17 from the model registry (`utils/models.js`). Provider pricing, free-tier policies, and rate-limit tiers drift over time. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/docs/about-claude/models), [developers.openai.com/api/docs](https://developers.openai.com/api/docs/pricing), and [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before committing to production volumes._
