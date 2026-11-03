# Verify setup

Between adding your API key to `.env.local` and starting a full daily run, you can verify your setup using the free API Setup Check (which probes each configured provider without sampling tokens), the mocked Dry Run (which exercises the UI and arXiv harvesting at zero LLM cost), and the five-paper Minimal API Test (which makes live provider calls on a fixed benchmark set). All three checks run from the **System Tests** section of the Control Panel, which is collapsed by default.

Running the Dry Run and Minimal API Test also introduces Aparture's interactive review gates, where you can inspect and adjust paper selections between stages during daily runs.

## Getting to the tests

1. Start the development server with `npm run dev`.
2. Open `http://localhost:3000` in your browser.
3. Log in using the `ACCESS_PASSWORD` value from `.env.local`.
4. In the Control Panel, click **System Tests** to expand the test panel, which displays the **API Setup Check**, **Dry Run Test**, and **Minimal API Test** cards with their **Check API Setup**, **Run Dry Test**, and **Run API Test** buttons (the **Run API Test** button remains disabled and labeled _Run Dry Test First_ until the Dry Run succeeds).

![The Pipeline view with the System Tests section expanded shows three cards side by side: API Setup Check with a Check API Setup button, Dry Run Test with a Run Dry Test button, and Minimal API Test with a disabled Run Dry Test First button.](/screenshots/system-tests.png)

_The expanded System Tests panel shows the API Setup Check, Dry Run Test, and Minimal API Test cards, where the Minimal API Test unlocks once a Dry Run completes._

## Step 0: API Setup Check (free)

Clicking **Check API Setup** probes every provider configured in your active model slots (filter, scoring, post-processing, PDF analysis, briefing, quick summaries, and podcast) without generating any output tokens. The check deduplicates slots that share the same model and sends one zero-cost probe per unique provider/model pair.

### What it validates

- **Anthropic:** Sends a complete Messages payload built by the production adapter (including the structured-output schema and adaptive-thinking configuration) to Anthropic's free `count_tokens` endpoint, which validates your API key, model ID, and request syntax without billing tokens.
- **Google:** Sends the adapter's formatted message payload to the Gemini API's free `countTokens` endpoint, verifying your API key, model ID, and message syntax.
- **OpenAI:** Queries the OpenAI model metadata endpoint to verify your API key and model ID (because OpenAI does not expose a free count-tokens endpoint, full request syntax is verified during the Minimal API Test).

Each slot's result row reports **Key**, **Model**, and **Syntax** status alongside the provider's error message if a check fails; a dash in a column indicates that the free probe does not cover that check (such as OpenAI's Syntax column).

### What it does not validate

- **OpenAI structured request shape:** Exercised by the Minimal API Test below.
- **Prepaid billing balance and rate-limit quotas:** An API key can authenticate against the metadata probe and still fail a billed request with `429 insufficient_quota`, which the Minimal API Test catches.
- **Provider latency, PDF downloads, and response parsing:** Verified during the Minimal API Test.

If any row fails in the API Setup Check, update the key in `.env.local` (and restart `npm run dev`) or change the model slot in Settings, then click **Check API Setup** again.

## Dry Run

The Dry Run connects a live Stage 1 arXiv harvest to a mocked LLM pipeline so you can verify that arXiv harvesting, stage transitions, review gates, and UI components work end to end before spending provider credit.

### What it validates

- **arXiv connectivity:** Stage 1 queries arXiv live for papers in your selected categories, surfacing network or proxy issues immediately.
- **End-to-end UI flow:** Every pipeline stage (`fetch` → `filter` → `score` → `PDF analysis` → `briefing`) renders in the UI, exercising the filter-override pills, star and dismiss buttons, and Download Report card.
- **Mock response parsing and error recovery:** Exercises JSON schema validation, retry backoff, and malformed-response correction loops.
- **Review gates and cancellation:** Exercises the Stop button alongside the `pauseAfterFilter`, `pauseBeforeDeepAnalysis`, and `pauseBeforeBriefing` review gates.

### What it does not validate

- **API keys, billing, or provider latency:** All LLM calls use local mock generators.
- **Live PDF downloads and reCAPTCHA fallback:** Stage 4 uses mock PDF analysis responses during a Dry Run.
- **Briefing prose quality:** The Dry Run synthesizes placeholder text to test layout and validation wiring.

### What to expect

During the Dry Run, the UI displays:

- A yellow **TEST MODE** badge on the briefing card once synthesis finishes.
- **TEST DATA** badges on the filter results, analysis results, and Download Report cards.
- Activity log messages stepping through `"Mock filter batch 1/10"`, `"initial-scoring"`, `"Mock PDF API Call N"`, and `"Generating briefing..."`.
- Simulated parse failures such as `"Mock parse failed: Response is not an array"` followed by `"Mock correction 1/3 succeeded"`, which verify the client retry loop.
- A green checkmark on the Dry Run card upon completion.

### ⚠️ You'll need to click through three review gates

Because `pauseAfterFilter`, `pauseBeforeDeepAnalysis`, and `pauseBeforeBriefing` are enabled by default, the pipeline pauses three times during the Dry Run and waits for your confirmation:

1. **After filtering:** The UI displays the <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-no">NO</span> filter buckets; you can click any paper's verdict pill to cycle its bucket, then click **Continue to scoring →** at the top of the main area.
2. **After scoring, before PDF analysis:** The scored paper list appears with star and dismiss controls for adjusting which papers receive full-PDF analysis; click **Continue to PDF analysis →** to proceed.
3. **After PDF analysis, before briefing synthesis:** You can star, dismiss, or comment on any analyzed paper, then click **Continue to briefing →**.

If a run appears paused with no terminal activity, check the top of the main area for a review gate banner. You can disable any gate under **Settings → Review & confirmation**.

### If it fails

::: info No real API calls happen here
Because the Dry Run makes no LLM provider calls, any failure during a Dry Run comes from local environment state or arXiv network connectivity.
:::

Use the table below to resolve Dry Run issues:

| Symptom                                       | Likely cause                    | Fix                                                                                        |
| --------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| Button stays disabled or greyed out           | Another test is already running | Wait for the active run to finish, or reload the page                                      |
| Pipeline halts at "fetching" indefinitely     | arXiv API unreachable           | Check your network connection and retry after a minute                                     |
| "Dry run test was cancelled"                  | You clicked Stop                | Click **Run Dry Test** again                                                               |
| "Dry run test failed: Mock retries exhausted" | Code or fixture bug             | Inspect the browser console stack trace; see [troubleshooting](/reference/troubleshooting) |
| No TEST MODE badges appear                    | React state not updating        | Hard-refresh (`Ctrl-Shift-R`), or restart `npm run dev`                                    |

## Minimal API Test

Once the Dry Run succeeds, the **Run API Test** button unlocks and runs the full LLM pipeline against a fixed five-paper benchmark set using live provider calls and live arXiv PDF downloads.

### What it validates

- **API key authentication:** Reports `no API key for <provider>` when an environment variable is unset, or displays the provider's authentication error when a key is invalid.
- **Billing and quota state:** Surfaces `402` or `429 insufficient_quota` responses when an account lacks credit.
- **Provider latency, rate limits, and retry backoff:** Exercises live round-trip requests and rate-limit recovery.
- **Structured LLM output parsing:** Verifies that live responses from your configured models conform to Aparture's schemas (`output_config.format`, `responseSchema`, or `response_format`).
- **Live arXiv PDF download and reCAPTCHA fallback:** Downloads the five benchmark PDFs directly from `arxiv.org` during Stage 4, exercising the Playwright fallback if arXiv serves a reCAPTCHA challenge.
- **Prompt caching:** Logs cache write and read token counts in the terminal from the second request onward on Anthropic and OpenAI.

### What it does not validate

- **Live arXiv metadata harvesting:** The five benchmark papers use bundled metadata and abstracts so Stage 1 (`fetchPapers()`) is skipped, while Stage 4 fetches the five PDFs live from `arxiv.org`.

### What to expect

The Minimal API Test costs roughly $0.20–$1.00 on paid tiers depending on your selected models (because Stage 4 reads up to five full PDFs), and costs $0 on Google's free tier when all model slots use default Flash models.

During the test run, you will observe:

- Activity log status lines progressing through `"Starting minimal test with real API calls"`, `"Filter batch 1/1"`, `"initial-scoring"`, `"pdf-analysis"`, `"synthesizing"`, and `"Minimal test completed successfully"`.
- A rendered briefing saved with the `testRun` flag so that any stars, dismissals, or comments you test during the run are tagged as test feedback and excluded from future profile suggestions.
- A completion timestamp recorded on the Minimal API Test card.

In the terminal running `npm run dev`, each LLM call logs a dispatch line:

```
Sending request to Google: { model: 'gemini-3.5-flash-lite', promptLength: 4821, structured: true }
```

The log entry includes `cacheable: true` or `hasPdf: true` whenever those options apply, and Anthropic and OpenAI calls log `[anthropic cache] read=N create=N` or `[openai cache] read=N` lines where `read > 0` on subsequent calls confirms that prompt caching is active.

### ⚠️ You may need to manually override the filter results

The five benchmark papers are foundational machine-learning papers (Word2Vec, Adam, U-Net, the original Transformer paper, and Mamba). If your research profile focuses on another discipline (such as observational astronomy or theoretical statistics), the Stage 2 quick filter may classify all five papers as <span class="verdict is-no">NO</span>, leaving zero papers for Stage 3 scoring and Stage 4 PDF analysis.

When the Minimal API Test pauses at the filter-review gate:

1. Check the <span class="verdict is-yes">YES</span> and <span class="verdict is-maybe">MAYBE</span> buckets; if both are empty, promote a few papers manually so the downstream stages run.
2. **Click any paper's verdict pill** to cycle its verdict through <span class="verdict is-yes">YES</span> → <span class="verdict is-maybe">MAYBE</span> → <span class="verdict is-no">NO</span>. Each click records a `filter-override` event (tagged as test-only during this test run, and used to train profile suggestions during live runs).
3. Promote **at least 2–3 papers into <span class="verdict is-yes">YES</span> or <span class="verdict is-maybe">MAYBE</span>** so Stage 3 scoring and Stage 4 PDF analysis receive sufficient input.
4. Click **Continue to scoring →** to resume the test.

This step also demonstrates how filter overrides work during daily runs to rescue borderline papers ([profile refinement](/using/refining-over-time)). You can configure gate behavior via `pauseAfterFilter` under **Settings → Review & confirmation**, and choose which verdict buckets advance under **Advanced Options → Filter Options**.

### If it fails

Failures during the Minimal API Test reflect live provider authentication, billing, or network errors:

| Symptom                                                               | Likely cause                                                              | Fix                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Filter batch 1 failed: … Invalid password`                           | Password mismatch in `.env.local`                                         | Verify `ACCESS_PASSWORD` and restart `npm run dev`                                                                                    |
| `… no API key for <provider>`, or the provider's authentication error | Missing or invalid API key                                                | Check the key in `.env.local` and restart `npm run dev`; see the [API keys page](/getting-started/api-keys)                           |
| `429 insufficient_quota` (OpenAI)                                     | Zero prepaid credit balance                                               | Add $5+ under **Settings → Billing**; see [OpenAI keys](/getting-started/api-keys-openai)                                             |
| `429 rate_limit_exceeded`                                             | Provider throttled your request rate                                      | Wait 60 seconds while the pipeline retries with backoff, or lower concurrency; see [troubleshooting](/reference/troubleshooting)      |
| `402` / `billing_error` (Anthropic)                                   | Billing issue or expired credit                                           | Check billing status in the Anthropic console                                                                                         |
| Google refuses one model while the others work                        | Model requires billing (`gemini-4-argon`) or prior usage (`gemini-2.5-*`) | Enable billing for Argon, or switch the slot to a current Flash model in Settings                                                     |
| `Failed to download PDF: HTTP 403` / `reCAPTCHA detected`             | arXiv blocked a direct PDF download                                       | Install Playwright for the automatic fallback, or allow abstract-only ranking for that paper; see [install](/getting-started/install) |
| `Initial parse failed: JSON.parse error`                              | Provider returned malformed JSON                                          | The pipeline retries automatically; if persistent, switch the stage to a stronger model                                               |
| Hangs on "Filter batch 1/1" with no terminal output                   | Network blocked or firewall intercepting requests                         | Inspect the terminal for connection errors                                                                                            |

Detailed diagnostic steps for each error appear on the [troubleshooting page](/reference/troubleshooting).

## What success looks like

When both verification tests pass:

- The Dry Run card displays a green checkmark and `"Dry run test completed successfully"`.
- The Minimal API Test card displays a green checkmark, a completion timestamp, and `"Minimal test completed successfully"`.
- The main area renders a complete **Briefing** view with an executive summary, thematic groupings, and paper cards for the benchmark papers.
- The **Download Report** card provides a standalone Markdown export alongside the interactive in-app Briefing view.
- The terminal log shows a clean sequence of `Sending request to ...` lines across all stages without unhandled errors.

Your setup is now verified and ready for daily use: continue to [Your first briefing](/using/first-briefing).
