# Anthropic (Claude) API key

Claude models (Opus 4.7, Sonnet 4.6, Haiku 4.5) give Aparture the highest-quality PDF analysis and briefing synthesis among the three providers, and Anthropic is the one provider where prompt caching is explicitly wired in. Repeated runs share a cached prefix, so actual cost is typically 20-40% below the sticker price.

Use this page if you want to run Aparture on Claude. If you're not sure which provider to pick, start with [Google AI](/getting-started/api-keys-google) — it has a free tier.

## 1. Sign up

Signup page: **[platform.claude.com](https://platform.claude.com/)** (the old `console.anthropic.com` now redirects here).

Requirements:

- Email (or Google/GitHub SSO).
- **SMS-capable mobile phone.** VoIP numbers (Google Voice, burner apps) are rejected, and the verified number cannot be changed later — treat this as durable account setup.
- Organization name (can be "Personal"). Anthropic asks for industry + use case, but these don't gate API access.

Some accounts get routed through **photo-ID verification via Persona**, typically triggered by risk signals like a VPN, region mismatch, or rapid signup cadence. Most individual researchers don't hit it. If you do, expect a 5-10 minute flow with a government ID and selfie.

## 2. Billing status

New accounts receive ~$5 in free API credits, which is enough to:

- Run Aparture's [Minimal API Test](/getting-started/verify-setup) (under $0.05).
- Try a few 25-paper runs using the Balanced preset (~$2.60/run — see pricing below).

This is a one-time starter credit, not a recurring free tier. Once it's consumed the API stops until you purchase more. The minimum top-up is $5, which activates Tier 1.

::: warning Starter credit expires
Anthropic's starter credit has an expiration (typically 14-30 days). If you signed up months ago without using it, check **Settings → Billing → Credit history** before debugging "my free credits aren't working".
:::

## 3. Create an API key

Menu path: **platform.claude.com → Settings (left nav) → API Keys → Create Key**.

1. Click **Settings** in the left sidebar.
2. Click **API Keys** in the submenu.
3. Click **Create Key** (top-right).
4. Fill in the dialog:
   - **Name:** something distinguishable like `aparture-dev`. This shows up in Usage logs.
   - **Workspace:** the default workspace is fine for solo use.
   - **Key type:** Standard.
   - **Spending limit:** optional per-key monthly cap. For a personal Aparture key, $20-50 is a reasonable safety net.
5. Click **Create Key**.
6. **Copy the key immediately.** The full key is shown exactly once. If you close the dialog without copying, revoke and recreate — Anthropic shows only a masked preview afterwards.

Key format: `sk-ant-api03-<~90 chars>-AAAA`. The `sk-ant-` prefix is the stable identifier Aparture uses for provider validation.

## 4. Add to `.env.local`

Open `.env.local` in the project root and add:

```bash
CLAUDE_API_KEY=sk-ant-api03-your-actual-key-here-AAAA
```

Rules:

- No quotes, no spaces around `=`.
- One key per line. Comments start with `#` at column 0.
- **Restart `npm run dev`** after editing — `.env.local` is read once at dev-server startup, and hot-reload is unreliable.

You'll also need `ACCESS_PASSWORD` set in the same file. See [reference/environment](/reference/environment) for the full list.

## 5. Set spend caps

Aparture can run up tens of dollars per day in hands-off mode, so spend caps are strongly recommended.

::: tip Use per-key spending limits
For a hands-off Aparture deployment, the per-key spending limit (finest-grained, set at key creation or edited later) is the one to actually use. Organization-wide and workspace caps are broader safety nets, but a per-key cap means a runaway Aparture run can't drain your other Anthropic work.
:::

There are three levels of control:

**Organization-wide cap** (broadest) — **Settings → Limits → Spend limits → Change Limit**. Set this below your tier ceiling. On Tier 1 (ceiling $100/month), a cap of $25 is a safe starting point.

**Per-key spending limit** (finest-grained) — **Settings → API Keys → [click key row] → Edit → Spending limit**. Can be set at key creation (step 3 above) or edited later.

**Per-workspace cap** (team/multi-key setups) — **Settings → Workspaces → [workspace] → Limits → Change Limit**. Workspace caps must be ≤ org cap. You cannot set a limit on the default workspace — it always matches the org cap.

## 6. Rate-limit tiers

New accounts start on **Tier 1** the moment they have credit (starter or paid):

| Model class         | RPM | ITPM (input/min) | OTPM (output/min) |
| ------------------- | --- | ---------------- | ----------------- |
| Opus 4.x (pooled)   | 50  | 30,000           | 8,000             |
| Sonnet 4.x (pooled) | 50  | 30,000           | 8,000             |
| Haiku 4.5           | 50  | 50,000           | 10,000            |

::: warning Tier 1 ITPM trap on Opus PDF analysis
A single PDF call can consume ~60k input tokens. At 30k ITPM, Aparture can only issue one Opus PDF call every ~2 minutes, so a 20-paper Stage 3 pass takes ~40 minutes on Tier 1 purely from rate limits.
:::

Two ways around the ITPM trap:

1. **Advance to Tier 2** ($40 cumulative purchase). Tier 2 = 1,000 RPM, 450k ITPM. A 250-paper run fits without rate pauses. Advancement is automatic — no approval wait.
2. **Use Sonnet 4.6 for `pdfModel` instead.** Sonnet shares Opus's pooled limit but uses roughly half the tokens per call, and Tier 1 Sonnet runs usually complete in reasonable time.

::: info Prompt caching to the rescue
Aparture enables Anthropic prompt caching on all supported routes. Cached input tokens do not count toward ITPM, so a well-cached run effectively processes 2-5× the token volume within the same rate limit. Confirm caching is working by grepping the dev-server terminal for `[anthropic cache] read=N` — if `read` is `>0` on call 2+, caching is hitting.
:::

## 7. Pricing for a Balanced-config run on Anthropic

Balanced preset with all-Anthropic models:

- **Stage 1 (quick filter):** Claude Haiku 4.5 — $1 / $5 per MTok
- **Stage 2 (scoring):** Claude Sonnet 4.6 — $3 / $15 per MTok
- **Stage 3 (PDF analysis):** Claude Opus 4.7 — $5 / $25 per MTok
- **Briefing (synthesis + hallucination check):** Claude Opus 4.7 — $5 / $25 per MTok
- **Briefing quick summaries:** Claude Haiku 4.5 — $1 / $5 per MTok

Daily cost (no caching savings applied — worst case):

| Papers/day | Stage 1 | Stage 2 | Stage 3 | Briefing summaries | Briefing fixed | **Total/day** |
| ---------- | ------- | ------- | ------- | ------------------ | -------------- | ------------- |
| 25         | $0.06   | $0.30   | $1.88   | $0.02              | $0.35          | **~$2.60**    |
| 100        | $0.22   | $1.20   | $7.50   | $0.07              | $0.35          | **~$9.34**    |
| 250        | $0.55   | $3.00   | $18.75  | $0.18              | $0.35          | **~$22.83**   |

Stage 3 dominates cost at every volume. Real-world caching takes 20-30% off these figures on runs after the first.

**Monthly projections** (30 daily runs): ~$78 at 25/day, ~$280 at 100/day, ~$685 at 250/day. A solo researcher at 25-100 papers/day fits comfortably in Tier 1 ($100 cap) to Tier 2 ($500 cap).

**Cost-cutting levers:**

- Switch `pdfModel` to Sonnet 4.6 → Stage 3 drops ~40% with a modest quality hit.
- Switch `briefingModel` to Sonnet 4.6 → fixed briefing cost drops to ~$0.20/run.
- Use Haiku 4.5 for Stage 2 scoring → Stage 2 drops ~66%.

See [concepts/model-selection](/concepts/model-selection) for the full tuning guide.

## 8. Verify

After restarting `npm run dev`, run the [Minimal API Test](/getting-started/verify-setup) from the UI. If the key is valid, you'll see real API calls succeed against Anthropic — expect ~$0.01-0.05 spend on 5 test papers.

If the key is invalid you'll see `"Anthropic API key not found"` (env var missing or misspelled) or HTTP 401 (key is malformed or revoked).

## Common gotchas

1. **Forgot to restart `npm run dev`.** The single most common "my key isn't working" issue. Next.js reads `.env.local` at startup; after editing, Ctrl-C and restart.
2. **Copied only a masked preview.** The full key is shown exactly once at creation. If you missed it, revoke and recreate — there's no "show full key" button.
3. **Tier 1 ITPM trap.** If Aparture seems stuck on Stage 3 for a new account, it's the 30k ITPM cap. Solution above (§6).
4. **VPN during signup.** Using a VPN at signup time is a common trigger for Persona ID verification. Turn off your VPN during initial signup if you'd rather skip the photo-ID flow.
5. **Starter credit expired.** The $5 starter credit expires in 14-30 days. Check **Settings → Billing → Credit history**.
6. **Workspace vs. default keys.** You don't need workspaces for solo use. Keys created inside a workspace only work for calls tagged to that workspace's spend bucket.

---

_Snapshot taken 2026-04-17. Anthropic pricing, tier thresholds, and signup flow may change. Verify against [platform.claude.com/docs/en/api/overview](https://platform.claude.com/docs/en/api/overview) and [claude.com/pricing](https://claude.com/pricing)._
