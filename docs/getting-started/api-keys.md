# API keys

Aparture routes LLM calls through Anthropic (Claude), OpenAI (GPT), or Google (Gemini). You need at least one provider key to run the pipeline. You can mix providers across stages (the default config already does), and you can add more providers later without reconfiguring anything else.

## TL;DR

Pick one provider to start. If you have no strong preference, **start with Google AI** — its free tier covers the cheapest, all-Google model combination end-to-end, and no credit card is required. Aparture's default model slots are all-Google out of the box, so a Google key also requires the least fiddling in Settings.

## Pick a provider

The current-generation models from all three providers are broadly comparable on the tasks Aparture performs. The main decision is about cost structure and setup friction, not model quality.

<div class="landing-cards">

<div class="landing-card">

### Anthropic Claude

New accounts get a one-time ~$5 starter credit. Aparture has prompt caching wired in explicitly for Anthropic, so repeated runs with the same profile typically come in 20–40% below list pricing. Balanced-configuration runs are ~$2.60 at 25 papers/day and scale with volume (Opus is used in the heavier stages).

[Set up Anthropic →](/getting-started/api-keys-anthropic)

</div>

<div class="landing-card">

### Google Gemini

Free tier covers an all-Flash model setup end-to-end, and no credit card is needed to start. Using Gemini 3.1 Pro (the stronger model Aparture defaults to for PDF analysis and briefing) requires enabling billing, and costs roughly $1.50–$2.00 per run at any volume. Good first stop if you're new to paid LLM APIs.

[Set up Google AI →](/getting-started/api-keys-google)

</div>

<div class="landing-card">

### OpenAI GPT

Requires a $5 minimum prepaid deposit to activate API access (no free trial). With GPT-5.4 across the heavier stages, cost stays roughly flat from 25 to 250 papers/day (~$1.40–$2.80), because the expensive PDF and briefing stages are capped at top-N regardless of input. OpenAI caches repeated prompt prefixes automatically.

[Set up OpenAI →](/getting-started/api-keys-openai)

</div>

</div>

## After you get your key

Whichever provider you picked, the steps back in Aparture are the same:

1. Open `.env.local` in the project root and paste the key under the right variable name:
   - `CLAUDE_API_KEY=sk-ant-api03-...` for Anthropic
   - `OPENAI_API_KEY=sk-proj-...` for OpenAI
   - `GOOGLE_AI_API_KEY=AIzaSy...` for Google
2. Restart `npm run dev` if it was already running. Next.js reads `.env.local` once at server startup.
3. Run the [Minimal API Test](/getting-started/verify-setup) from the UI. That's a 5-paper end-to-end test that confirms your key authenticates and the pipeline runs cleanly. It costs ~$0.20–$1 on paid tiers and is free on Google's free tier.

That's it. Your key is working; you can generate your first briefing.

## How Aparture picks models

You configure Aparture's model slots individually in the Settings panel — there's a slot for each pipeline stage (filter, scoring, PDF analysis, briefing synthesis, NotebookLM document generation), and each slot can hold any model from any provider. Out of the box the slots are all-Google, using `gemini-2.5-flash-lite` for the lightweight stages and `gemini-3.1-pro` for PDF analysis and briefing.

Throughout these docs we refer to three example configurations as editorial shorthand for common, sensible combinations. They aren't UI presets — they're just named combinations used in the pricing tables and the [Model selection](/concepts/model-selection) page:

- **Budget** — the cheapest small/mid model at every stage. Fast, inexpensive, and the combination that stays free on Google's free tier.
- **Balanced** — a small model for filtering and scoring, plus a stronger model for PDF analysis and briefing synthesis. This is what the defaults approximate with all-Google.
- **Quality** — the strongest model each provider offers, used across all stages. Noticeably more expensive, usually only marginally better in outcome.

The cost numbers below use the Balanced configuration for each provider. The [Model selection](/concepts/model-selection) page has the full model picks for each.

## Pricing at a glance (Balanced configuration)

Cost per daily run, by provider and paper volume:

| Papers/day | Anthropic | Google (Balanced) | Google (Budget)                   | OpenAI |
| ---------- | --------- | ----------------- | --------------------------------- | ------ |
| 25         | ~$2.60    | ~$1.53            | **$0.00**                         | ~$1.37 |
| 100        | ~$9.34    | ~$1.86            | **$0.00** (watch daily caps)      | ~$2.03 |
| 250        | ~$22.83   | ~$1.94            | **$0.00** at pricing; may hit cap | ~$2.79 |

Three things the table says concisely:

- Google's Budget configuration (all Gemini Flash models) stays free within the daily request caps, which makes it ideal for learning the tool or for routine low-volume reading.
- OpenAI's Balanced cost is roughly flat from 25 to 250 papers/day because the expensive stages are capped at top-N regardless of input.
- Anthropic's Balanced cost grows with volume because Opus is used for both PDF analysis and briefing. Switching the PDF slot to Sonnet drops cost significantly with a modest quality hit.

Caching takes another 20–40% off these numbers on repeated runs with the same profile. Aparture caches explicitly on Anthropic routes; OpenAI's platform caches automatically; Google caching isn't wired in yet.

## Can I run completely free?

Yes, if you configure Aparture's slots to stay within the Gemini Flash family (Flash, Flash-Lite, and the 3.x preview counterparts). All of those are free for free-tier accounts. The only Gemini model that isn't free is Gemini 3.1 Pro Preview, which Aparture's out-of-the-box defaults use for PDF analysis and briefing — so if you want everything free on Google, swap those two slots to a Flash model in Settings.

Two caveats worth knowing up front:

1. **Daily request caps apply on the free tier.** A 25-papers/day Budget run fits comfortably; a 250-papers/day run can trip the cap. Your current per-model limits are visible at the [AI Studio dashboard](https://aistudio.google.com/) after signing in, or documented generally at the [Gemini API rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits).
2. **Free-tier users cannot opt out of training-data collection.** If your profile contains sensitive research notes, upgrade to paid Tier 1 (a $10 prepaid credit) to enable opt-out. More details are on the [Google setup page](/getting-started/api-keys-google).

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

---

_Pricing snapshot taken 2026-04-17. Provider pricing, free-tier policies, and rate-limit tiers drift over time. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/docs/about-claude/models), [developers.openai.com/api/docs](https://developers.openai.com/api/docs/pricing), and [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before committing to production volumes._
