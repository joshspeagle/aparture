# API keys

Aparture routes LLM calls through Anthropic (Claude), OpenAI (GPT), or Google (Gemini). You need at least one provider key to run the pipeline, and you can mix providers across stages — the default config already does.

## TL;DR

One key is enough to start; add more later if you want to mix. If you're picking your first provider and have no particular preference, **start with Google AI** — its free tier covers Aparture's Budget preset end-to-end, with no credit card required. See [Google (Gemini)](/getting-started/api-keys-google).

The workflow for any provider is the same: get a key, add it to `.env.local` under the right variable name, then verify with the [Minimal API Test](/getting-started/verify-setup).

## Which provider?

|                              | Anthropic (Claude)                                  | OpenAI (GPT)                                              | Google (Gemini)                                                  |
| ---------------------------- | --------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| **Free tier**                | ~$5 starter credit, one-time                        | None                                                      | Yes — covers Budget preset                                       |
| **Billing to start**         | Not required for starter credit                     | $5 minimum deposit                                        | Not required for free tier                                       |
| **Key format**               | `sk-ant-api03-...`                                  | `sk-proj-...`                                             | `AIzaSy...`                                                      |
| **Env var**                  | `CLAUDE_API_KEY`                                    | `OPENAI_API_KEY`                                          | `GOOGLE_AI_API_KEY`                                              |
| **Speed (typical)**          | Fast; rate-limit trap on Tier 1 ITPM                | Fast on paid tiers                                        | Fastest on Flash-family                                          |
| **Quality (PDF stage)**      | Highest on Opus 4.7                                 | Highest on GPT-5.4                                        | Strong on Gemini 3.1 Pro                                         |
| **Prompt caching wired in?** | Yes                                                 | Automatic                                                 | Not yet                                                          |
| **Signup page**              | [platform.claude.com](https://platform.claude.com/) | [platform.openai.com](https://platform.openai.com/signup) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

## Pricing at a glance

Cost estimates for a daily Aparture run using the **Balanced preset** (Flash-Lite filter → Flash scoring → Pro-class PDF + briefing), computed per provider using each provider's native Balanced-tier models.

| Papers/day | Anthropic (Balanced) | OpenAI (Balanced) | Google (Balanced) | Google (Budget)                   |
| ---------- | -------------------- | ----------------- | ----------------- | --------------------------------- |
| 25         | ~$2.60               | ~$1.37            | ~$1.53            | **$0.00**                         |
| 100        | ~$9.34               | ~$2.03            | ~$1.86            | **$0.00** (watch RPD)             |
| 250        | ~$22.83              | ~$2.79            | ~$1.94            | **$0.00** at pricing; may hit RPD |

Per-provider details are on the pages below. The broad-strokes takeaways:

- Google's Budget preset costs nothing on the free tier, as long as you stay inside the daily request-per-day (RPD) allowances. That makes it ideal for learning the tool.
- OpenAI's Balanced config scales more or less flatly with volume (~$2-3 per run whether you analyse 25 or 250 papers), because the expensive Pro-tier calls are capped at top-N regardless of input.
- Anthropic's Balanced config is the most expensive of the three because it uses Claude Opus 4.7 for both PDF analysis and briefing synthesis. Switching the PDF slot to Sonnet 4.6 drops cost by ~30% with a modest quality hit.

All three providers support prompt caching (Anthropic explicitly, OpenAI automatically, Google via manual cache — not yet wired in Aparture). Real-world costs with warm caches typically run 20-40% below the table above.

## Can I run completely free?

Yes, on Google's Budget preset. The Gemini Flash family (Flash, Flash-Lite, and the 3.x preview counterparts) is listed as "Free of charge" for free-tier accounts. The only Gemini model that isn't free is **Gemini 3.1 Pro Preview**, so if you pick the Balanced or Quality preset you'll need to enable billing.

Two caveats on the Google free tier worth knowing up front:

1. **Daily request caps (RPD) apply.** A 25-papers/day Budget run fits comfortably; a 250-papers/day run may trip the cap. The live numbers are in the [AI Studio rate-limit dashboard](https://aistudio.google.com/rate-limit).
2. **Free-tier users cannot opt out of training-data collection.** If your profile contains sensitive or proprietary research notes, upgrade to paid Tier 1 (a $10 prepaid credit) to enable opt-out.

## Per-provider setup

Pick one to start. You can add the others later without restarting the project.

<div class="landing-cards">

<div class="landing-card">

### Google Gemini — start here

Free tier covers the Budget preset end-to-end. Recommended for first-time users unless you're specifically evaluating Claude or GPT. [Google setup →](/getting-started/api-keys-google)

</div>

<div class="landing-card">

### Anthropic Claude — highest quality

Best PDF analysis and briefing synthesis, with prompt caching wired in so repeated runs cost less than the sticker price suggests. [Anthropic setup →](/getting-started/api-keys-anthropic)

</div>

<div class="landing-card">

### OpenAI GPT — flat-rate scaling

Per-run cost stays roughly flat from 25 to 250 papers. Requires a $5 prepaid deposit to activate the API (no free trial). [OpenAI setup →](/getting-started/api-keys-openai)

</div>

</div>

## After you have a key

1. Paste it into `.env.local` under the correct variable name (see the table above).
2. Restart `npm run dev` if it's already running — Next.js reads `.env.local` at server startup, not per-request.
3. Run the [Minimal API Test](/getting-started/verify-setup) to confirm the key authenticates. This takes ~30 seconds and costs about $0.01-0.05 on paid tiers, or $0 on Google's free tier.

---

_Pricing snapshot taken 2026-04-17. Provider pricing, free-tier policies, and rate-limit tiers drift over time. Verify against [platform.claude.com/docs](https://platform.claude.com/docs/en/docs/about-claude/models), [developers.openai.com/api/docs](https://developers.openai.com/api/docs/pricing), and [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) before committing to production volumes._
