# API keys

Aparture routes LLM requests through Anthropic ([Claude](https://claude.com)), OpenAI ([GPT](https://chatgpt.com)), or Google ([Gemini](https://gemini.google.com)). You need at least one provider API key to run the pipeline, and you can mix providers across pipeline stages or add additional keys later without changing your existing setup.

## TL;DR

Choose one provider to get started. If you do not have an existing preference, **start with Google AI** because Aparture's default model slots use Gemini models that are covered by Google's free tier without requiring a credit card.

## Pick a provider

Current models from all three providers perform well across Aparture's filtering, scoring, PDF reading, and synthesis stages, so your initial choice primarily comes down to billing structure and account setup.

<div class="landing-cards">

<a class="landing-card" href="/aparture/getting-started/api-keys-anthropic.html">
  <h3>Anthropic Claude</h3>
  <p>New accounts receive a one-time ~$5 starter credit. Every current Claude model supports adaptive thinking, and Aparture caches the rubric and your profile across Anthropic calls.</p>
</a>

<a class="landing-card" href="/aparture/getting-started/api-keys-google.html">
  <h3>Google Gemini</h3>
  <p>The free tier covers every default model without requiring a credit card, and only the Gemini 4 Argon upgrade requires a paid billing account. Older unrestricted keys must be restricted to the Gemini API.</p>
</a>

<a class="landing-card" href="/aparture/getting-started/api-keys-openai.html">
  <h3>OpenAI GPT</h3>
  <p>API calls require prepaid credit ($5 is sufficient for several runs), and OpenAI caches repeated prompt prefixes automatically.</p>
</a>

</div>

## After you get your key

Once you have generated an API key from your chosen provider, complete these steps in Aparture:

1. Open `.env.local` in the repository root and confirm that `ACCESS_PASSWORD` is set (see the [install page](/getting-started/install#_3-set-a-local-access-password) if you have not set a password yet).
2. Add your API key under the corresponding environment variable name:
   - `CLAUDE_API_KEY=sk-ant-api03-...` for Anthropic
   - `GOOGLE_AI_API_KEY=...` for Google (pasted exactly as shown in Google AI Studio)
   - `OPENAI_API_KEY=sk-proj-...` for OpenAI
3. Restart `npm run dev` if the server is already running, because Next.js loads `.env.local` at startup.
4. Run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free) in the UI to verify your key, configured model IDs, and request syntax at zero token cost.
5. Run the [Minimal API Test](/getting-started/verify-setup) in the UI to execute a five-paper end-to-end test run.

Because Aparture's default model slots all point to Google Gemini models, users starting with Anthropic or OpenAI should switch their active model slots in Settings to their configured provider before running the Minimal API Test, as detailed in the provider-specific guides.

## How Aparture uses models

Aparture provides six pipeline model slots (filter, scoring, post-processing, PDF analysis, briefing, and quick summaries) plus one slot for the podcast add-on. Assigning appropriate model tiers to each stage balances synthesis quality and daily cost; [Model selection](/concepts/model-selection) explains the trade-offs in detail, and each provider guide recommends a complete single-provider lineup.

Every recommended lineup pairs a fast, low-cost model for initial filtering and quick summaries with a mid-tier model for abstract scoring and a frontier model for full-PDF reading and briefing synthesis. Aparture's default configuration follows this pattern with Gemini 3.5 Flash-Lite on the filter and quick summaries, Gemini 3.6 Flash on scoring and post-processing, and Gemini 3.8 Flash on PDF analysis and the briefing.

For a walkthrough of how each stage appears during a run, see [Your first briefing](/using/first-briefing).

## Cost at a glance

During a run, the quick filter evaluates every fetched abstract, abstract scoring evaluates the papers that pass the filter, PDF analysis reads the top $N$ papers in full (defaulting to 30, controlled by **Papers to Analyze** in Settings), and briefing synthesis and auditing run once at the end. Because Stage 4 caps full-PDF reads at the top $N$ papers, total run cost flattens out even when daily submission volume is large.

The tables below use the same per-paper token planning estimates that power the in-app review gate projections. The 100-paper reference run fetches 100 papers, scores and post-processes 50, and reads 20 PDFs in full; the 250-paper run scores 125, post-processes 50 (the default cap), and reads 30 PDFs (where the default PDF cap binds). Figures reflect uncached list pricing and exclude adaptive-thinking or reasoning tokens, which are billed at output token rates. Individual stage rows are rounded to the nearest cent, so column sums may differ from the unrounded total by a cent or two.

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

Assigning Claude Sonnet 5.5 to PDF analysis reduces that stage's cost by half (to roughly $1.50 on the 100-paper reference run).

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

Through 2026-12-31, Google offers promotional half-price rates on Gemini 3.6 Flash and 3.8 Flash, reducing those totals to roughly $0.86 and $1.36 on paid accounts, while runs that stay within the free tier's daily request caps cost $0.

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

\* Stage 3.5 post-processing uses `postProcessingModel`, which remains on its Google default (`gemini-3.6-flash`) unless changed explicitly. If you do not have a Google API key configured, change the **Review Model** selector under **Enable Post-Processing** in Settings to match your active provider, or disable post-processing.

Prompt caching reduces input token costs on repeated calls within a run: Aparture marks the rubric template and research profile as cacheable on Anthropic calls, while OpenAI and Google apply automatic prefix caching once prompts exceed their minimum token thresholds. Because paper abstracts and PDFs change on every call, caching discounts apply specifically to the shared rubric-and-profile prefix.

## Can I run completely free?

Yes. Every default model slot (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, and `gemini-3.8-flash`) is covered by Google's free tier. Only `gemini-4-argon` (which requires a paid billing account) and the legacy `gemini-2.5-*` models (restricted to accounts with prior usage) fall outside the standard free tier.

When using the free tier, keep the daily request caps and Google's data-usage policy in mind:

1. **Daily request caps apply on the free tier:** A 25-paper daily run fits comfortably within free-tier quotas, whereas a 250-paper run can reach the daily request limit. You can inspect your live per-model quotas in the [AI Studio dashboard](https://aistudio.google.com/) and review general tier policies on the [Gemini API rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits).
2. **Free-tier prompts and responses are used for Google product improvement:** Paid-tier requests are excluded from model training. If your research profile contains unpublished notes that you prefer to keep private, upgrade to paid Tier 1 with a $5 prepayment, as described on the [Google setup page](/getting-started/api-keys-google#free-tier).

## Reference: provider table

Use the table below to look up key prefixes, environment variable names, and console URLs:

|                             | Anthropic (Claude)                                  | Google (Gemini)                                                         | OpenAI (GPT)                                              |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| **Free tier**               | ~$5 starter credit, one-time                        | Yes (covers every default model)                                        | No free credit                                            |
| **Billing to start**        | Not required for starter credit                     | Not required for free tier                                              | Prepaid credit; $5 to start                               |
| **Key format**              | `sk-ant-api03-...`                                  | `AIza...` for standard keys, which must be restricted to the Gemini API | `sk-proj-...`                                             |
| **Env var in `.env.local`** | `CLAUDE_API_KEY`                                    | `GOOGLE_AI_API_KEY`                                                     | `OPENAI_API_KEY`                                          |
| **Prompt caching**          | Wired in explicitly                                 | Automatic above a minimum prompt size                                   | Automatic                                                 |
| **Signup page**             | [platform.claude.com](https://platform.claude.com/) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey)        | [platform.openai.com](https://platform.openai.com/signup) |

## Next

Once you have added your key to `.env.local` and restarted `npm run dev`, continue to [Verify your setup](/getting-started/verify-setup).

---

_Pricing snapshot taken 2026-10-17 from the model registry (`utils/models.js`). Provider pricing, free-tier policies, and rate-limit tiers evolve over time; check [platform.claude.com/docs](https://platform.claude.com/docs/en/docs/about-claude/models), [developers.openai.com/api/docs](https://developers.openai.com/api/docs/pricing), and [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before running large volumes._
