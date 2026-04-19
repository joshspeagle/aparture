# API keys

Aparture routes LLM calls through Anthropic (Claude), OpenAI (GPT), or Google (Gemini). You need at least one provider key to run the pipeline. You can mix providers across stages — the default config already does — and you can add more providers later without reconfiguring anything else.

## TL;DR

Pick one provider to start. If you have no strong preference, **start with Google AI** — its free tier covers a full all-Flash-model run end-to-end, and no credit card is required. Aparture's default model slots are all-Google out of the box, so a Google key also requires the least fiddling in Settings.

## Pick a provider

The current-generation models from all three providers are broadly comparable on the tasks Aparture performs. The decision is mostly about cost structure and setup friction.

<div class="landing-cards">

<div class="landing-card">

### Anthropic Claude

New accounts get a one-time ~$5 starter credit. Aparture has prompt caching wired in explicitly for Anthropic, so repeated runs with the same profile typically come in 20–40% below list pricing.

[Set up Anthropic →](/getting-started/api-keys-anthropic)

</div>

<div class="landing-card">

### Google Gemini

Free tier covers an all-Flash model setup end-to-end, and no credit card is needed to start. Using Gemini 3.1 Pro (the stronger model Aparture defaults to for PDF analysis and briefing) requires enabling billing.

[Set up Google AI →](/getting-started/api-keys-google)

</div>

<div class="landing-card">

### OpenAI GPT

Requires a $5 minimum prepaid deposit to activate API access — no free trial. OpenAI's platform caches repeated prompt prefixes automatically, so real cost on repeat runs tracks 20–40% below list.

[Set up OpenAI →](/getting-started/api-keys-openai)

</div>

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

## How Aparture picks models

You configure Aparture's model slots individually in the Settings panel. There are six slots, one per pipeline sub-stage:

- `filterModel` — quick filter (Stage 1)
- `scoringModel` — abstract scoring (Stage 2)
- `pdfModel` — PDF deep analysis (Stage 3)
- `briefingModel` — briefing synthesis + hallucination check (Stage 5)
- `quickSummaryModel` — per-paper quick-summary compression that runs in parallel just before the briefing synthesis call (new; default `gemini-3.1-flash-lite` since it's a lightweight text-compression task)
- `notebookLMModel` — NotebookLM document generation, configured in the NotebookLM card rather than the main Settings panel

Each slot can hold any model from any provider. Out of the box, the first four and the quick-summary slot are all Google: `gemini-2.5-flash-lite` / `gemini-3-flash` / `gemini-3.1-pro` / `gemini-3.1-pro` / `gemini-3.1-flash-lite`.

If you're running an Anthropic-only or OpenAI-only setup, swap `quickSummaryModel` in Settings to a small model from your chosen provider so the quick-summary calls don't need a Google key. Quick-summary failures are non-fatal (the briefing still renders), but you'll lose the inline per-paper expansions if it silently fails.

Throughout these docs we refer to three named configurations as editorial shorthand:

- **Budget** — the cheapest small/mid model at every stage. Fast, inexpensive, the configuration that stays free on Google's free tier.
- **Balanced** — a small model for filtering and scoring, plus a stronger model for PDF analysis and briefing synthesis. What the default all-Google setup approximates.
- **Quality** — the strongest model each provider offers, used across every stage. Noticeably more expensive, in practice only marginally better in output.

These aren't UI presets; you pick models per slot individually. The names are just useful shorthand when comparing costs. Each provider page has full model picks for its Balanced configuration.

## Cost at a glance

All three providers run Aparture's pipeline with the same structure: quick filter runs on every input paper, abstract scoring runs on papers that pass the filter, and PDF analysis runs on the top 30 scoring papers (this cap — `config.maxDeepAnalysis`, default 30 — is set in Settings). Briefing synthesis runs once per run.

Because Stage 3 caps at 30 papers regardless of input volume, cost is dominated by the PDF-analysis and briefing stages at low input volumes (say, 25 papers/day), and by the filter and scoring stages at high input volumes (250+ papers/day).

Typical per-run cost with Balanced-configuration model picks and the default 30-paper cap:

| Provider                 | Per run at 25 papers | Per run at 250 papers     | Notes                                  |
| ------------------------ | -------------------- | ------------------------- | -------------------------------------- |
| **Anthropic** (Balanced) | ~$2.60               | ~$7                       | Opus for PDF + briefing dominates cost |
| **Google** (Balanced)    | ~$1.50               | ~$2                       | Gemini 3.1 Pro for heavier stages      |
| **Google** (all-Flash)   | **$0**               | **$0** (watch daily caps) | Free tier, Flash models only           |
| **OpenAI** (Balanced)    | ~$1.40               | ~$3                       | GPT-5.4 for heavier stages             |

Ranges reflect input volume only. Prompt caching (explicit on Anthropic, automatic on OpenAI, not yet wired for Google) takes another 20–40% off on repeat runs with the same profile.

## Can I run completely free?

Yes, if you configure Aparture's slots to stay within the Gemini Flash family (Flash, Flash-Lite, and the 3.x preview counterparts) — all of those are free for free-tier accounts. The only Gemini model that isn't free is Gemini 3.1 Pro Preview, which Aparture's out-of-the-box defaults use for PDF analysis and briefing. If you want everything free on Google, swap those two slots to a Flash model in Settings.

Two caveats worth knowing up front:

1. **Daily request caps apply on the free tier.** A 25-papers/day Budget run fits comfortably; a 250-papers/day run can trip the cap. Your current per-model limits are visible after signing in at the [AI Studio dashboard](https://aistudio.google.com/), and described at a high level at the [Gemini API rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits).
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

---

_Pricing snapshot taken 2026-04-17. Provider pricing, free-tier policies, and rate-limit tiers drift over time. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/docs/about-claude/models), [developers.openai.com/api/docs](https://developers.openai.com/api/docs/pricing), and [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before committing to production volumes._
