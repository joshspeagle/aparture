# Verify setup

Two checkpoint tests sit between "I added my key to `.env.local`" and "I'm ready for a real run." Use them in order — the second is only enabled after the first passes.

- **Dry Run** exercises the full pipeline with mocked LLM responses, validating UI flow and the pipeline's error-recovery paths. Cost: $0.
- **Minimal API Test** runs 5 fixed test papers through the full pipeline with real API calls — filter, score, PDF analysis, briefing synthesis, and hallucination check — validating that your key authenticates and that the provider responds end-to-end. Cost: ~$0.20–$1 on paid tiers depending on your model choices (free on Google's free tier).

Both are UI-driven — you'll find them in the Control Panel after starting the dev server.

## Getting to the tests

1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000` in a browser.
3. Enter the value of `ACCESS_PASSWORD` from your `.env.local`.
4. In the Control Panel, find the **Testing** section near the bottom. You'll see two buttons: **Run Dry Test** and **Run Minimal Test** (disabled until Dry Run completes).

## Dry Run

### What it validates

- **End-to-end UI flow.** Every pipeline stage (fetch → filter → score → PDF analysis → briefing) renders correctly.
- **Mock response parsing.** JSON parsing, schema validation, and the malformed/missing-field/wrong-type correction loops.
- **Error recovery.** Retry logic, correction prompts, failure escalation.
- **Pause/abort controls.** The Stop button and the optional `pauseAfterFilter` / `pauseBeforeBriefing` gates.

### What it does not validate

- arXiv connectivity (papers are user-supplied fixtures, not fetched).
- Your API keys (all LLM calls are mocked).
- Network latency (mock delays are 50-200ms, not real API round-trip).

### What to expect

Duration: 10-30 seconds.

You'll see:

- A **TEST MODE** badge (yellow) on the briefing card.
- **TEST DATA** badges on the filter results, analysis results, and download report cards.
- Status messages stepping through each stage: `"Mock filter batch 1/10"`, `"initial-scoring"`, `"Mock PDF API Call N"`, `"Synthesizing briefing"`, and finally `"Dry run test completed successfully — click Download Report to save."`
- Intentional failure scenarios cycle through the test data — expect to see `"Mock parse failed: Response is not an array"` followed by `"Mock correction 1/3 succeeded"` at least once. These aren't real errors; they're there to exercise the retry path.
- A green checkmark on the test card when it finishes.

### If it fails

::: info No real API calls happen here
Dry Run failures are always code or environment issues, never API-related. If something breaks during a Dry Run, the cause is local.
:::

Common causes:

| Symptom                                       | Likely cause                    | Fix                                                                                      |
| --------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Button stays disabled or greyed out           | Another test is already running | Wait, or reload the page                                                                 |
| "Dry run test was cancelled"                  | You clicked Stop                | Re-click Run Dry Test                                                                    |
| "Dry run test failed: Mock retries exhausted" | Code or fixture bug             | Check browser console for stack trace; see [troubleshooting](/reference/troubleshooting) |
| No TEST MODE badges appear                    | React state not updating        | Hard-refresh (Ctrl-Shift-R); if persistent, restart `npm run dev`                        |

## Minimal API Test

The Minimal Test button unlocks only after Dry Run completes successfully. This enforcement is deliberate — it prevents running up real API spend against a broken UI.

### What it validates

- **API key authentication.** A bad key surfaces as `401 - Unauthorized` immediately.
- **Billing and quota.** Insufficient credits or hit quotas return `402` or provider-specific errors.
- **Provider latency and rate limits.** Real round-trip times; provider rate-limit backoff if hit.
- **Real LLM response parsing.** Validates that the provider's output parses against Aparture's schemas.

### What it does not validate

- arXiv connectivity (papers are a fixed 5-paper test set: Word2Vec, Adam, U-Net, Transformer, Mamba).
- Paper fetch timing (skipped; the fixture is loaded directly).

### What to expect

Duration: 30-120 seconds, dominated by API latency and model processing.

Cost: ~$0.20–$1 on paid tiers depending on your model choices. The PDF analysis stage dominates — 5 real papers get fetched and read in full. Google's free tier covers the whole run at $0.

You'll see:

- Status messages: `"Starting minimal test with real API calls"`, `"Filter batch 1/1"`, `"initial-scoring"`, `"pdf-analysis"`, `"synthesizing"`, and finally `"Minimal test completed successfully — click Download Report to save."`
- No TEST MODE badges on this run — it uses real data and produces a real (small) briefing.
- A timestamp on the test card showing when it last completed.

Open the terminal where `npm run dev` is running to see the real-time log:

```
Sending request to Google: { model: 'gemini-3-flash', promptLength: 4821, structured: true, cacheable: false, hasPdf: false }
[google] ... (no cache line on Google; caching isn't wired yet)
```

Cache-hit metrics (Anthropic/OpenAI) show as `[anthropic cache] read=N create=N` lines. A `read` value greater than 0 on call 2+ means caching is working.

### If it fails

The error surface here is real — most failures indicate a real issue with keys or billing.

| Symptom                                                                 | Likely cause                                    | Fix                                                                                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Filter API error: 401 - Invalid password`                              | Password mismatch in `.env.local`               | Verify `ACCESS_PASSWORD`, restart `npm run dev`                                                                                     |
| `Filter API error: 401 - Unauthorized` (or `UNAUTHENTICATED` on Google) | Bad or missing API key                          | Verify the key, restart `npm run dev`. See the relevant [API keys page](/getting-started/api-keys)                                  |
| `429 insufficient_quota` (OpenAI)                                       | No credit balance                               | Add $5+ at **Settings → Billing**. See [OpenAI keys](/getting-started/api-keys-openai)                                              |
| `429 rate_limit_exceeded`                                               | Provider throttled your request                 | Wait 60s; pipeline retries with backoff. Move to higher tier if persistent. See [troubleshooting](/reference/troubleshooting)       |
| `402` / `billing_error` (Anthropic)                                     | Billing issue or unpaid invoice                 | Log into console, fix billing                                                                                                       |
| `PERMISSION_DENIED` (Google)                                            | Model gated (e.g., Gemini 3.1 Pro on free tier) | Either enable billing or switch the affected slots to a Flash model in Settings                                                     |
| `Failed to download PDF: HTTP 403` / `reCAPTCHA detected`               | arXiv blocked a PDF download                    | Expected for some papers. Install Playwright for fallback, or accept abstract-only ranking. See [install](/getting-started/install) |
| `Initial parse failed: JSON.parse error`                                | Provider returned malformed JSON                | Often retries cleanly. If persistent, the model is struggling with the schema — try a different scoring model                       |
| Hangs on "Filter batch 1/1" with no terminal output                     | Route stuck; network blocked; firewall          | Check terminal for provider error. Try a curl smoke test from the provider page                                                     |

Deep dives for each of these live on the [troubleshooting page](/reference/troubleshooting) (in progress).

## What success looks like

When both tests pass:

- The Dry Run card shows a green check and `"Dry run test completed successfully"`.
- The Minimal Test card shows a green check, a last-run timestamp, and `"Minimal test completed successfully"`.
- A small test briefing is available via the Download Report button — the content is uninteresting (5 arbitrary papers), but its existence proves the briefing pipeline works end-to-end.
- The terminal log shows a clean sequence of `Sending request to ...` lines per stage, no red errors, and no repeated `API error 429` or validation-failed messages.

At that point, you're ready for a real run. Next: [first briefing](/getting-started/first-briefing).
