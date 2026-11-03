# Troubleshooting

Issues in Aparture typically arise during package installation, initial server startup, mid-run pipeline execution, or briefing synthesis and auditing. Use the category cards or the master symptom table below to jump directly to the relevant fix.

<div class="landing-cards">

<div class="landing-card">

### Install-time

`npm install` errors, Playwright browser download issues, outdated Node.js versions, or proxy and cache failures.

[Go to install-time issues →](#install-time-issues)

</div>

<div class="landing-card">

### First-launch

Port `3000` conflicts, `.env.local` changes not loading, `ACCESS_PASSWORD` mismatches, or invalid API key formats.

[Go to first-launch issues →](#first-launch-issues)

</div>

<div class="landing-card">

### Mid-run

arXiv rate limits, reCAPTCHA challenges on PDF downloads, provider HTTP 429s, context-window overflows, cost spikes, or paused stages.

[Go to mid-run issues →](#mid-run-issues)

</div>

<div class="landing-card">

### Briefing-time

Synthesis schema validation failures, hallucination audits returning `YES`, or audit retry questions.

[Go to briefing-time issues →](#briefing-time-issues)

</div>

</div>

If your symptom is not listed below, [open an issue on GitHub](https://github.com/joshspeagle/aparture/issues) with the terminal log output (redacting any API keys) and the relevant browser console message.

## Master symptom table

| Symptom                                                              | Likely cause                                                           | Jump to                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm install` fails with `gyp ERR!` or `EACCES`                      | Node version mismatch, missing build tools, or `sudo` install          | [npm install failures](#npm-install-failures)                                   |
| `npx playwright install chromium` hangs or fails                     | Insufficient disk space, missing Linux libraries, or corporate proxy   | [Playwright install failures](#playwright-install-failures)                     |
| `Error: listen EADDRINUSE :::3000`                                   | Port 3000 is already bound by another process                          | [Port 3000 already in use](#port-3000-already-in-use)                           |
| The app loads on this machine but not from another device            | The server binds to `127.0.0.1` by default                             | [Reaching the app from another device](#reaching-the-app-from-another-device)   |
| Every API call returns `401 Invalid password`                        | `ACCESS_PASSWORD` mismatch, trailing whitespace, or CRLF line endings  | [ACCESS_PASSWORD mismatch](#access-password-mismatch)                           |
| `.env.local` edits do not take effect                                | Development server cached initial environment values at startup        | [`.env.local` not loading](#env-local-not-loading)                              |
| `no API key for <provider>` or provider `401`                        | API key variable unset, or wrong key format pasted                     | [API key format issues](#api-key-format-issues)                                 |
| `arXiv rate limit: exhausted 3 retries`                              | arXiv's 3-second request spacing limit was exceeded                    | [arXiv rate limits](#arxiv-rate-limits)                                         |
| Run reports `arXiv: auto-atom`, much slower than usual               | OAI-PMH failed and Auto mode fell back to Atom                         | [arXiv rate-limited](#arxiv-rate-limited)                                       |
| `Failed to download PDF: HTTP 403` (or 404 / timeout)                | Direct HTTP download failure reported after retries                    | [reCAPTCHA on PDF downloads](#recaptcha-on-pdf-downloads)                       |
| `reCAPTCHA detected` / Playwright fallback firing                    | arXiv served a reCAPTCHA HTML page on a PDF URL                        | [reCAPTCHA on PDF downloads](#recaptcha-on-pdf-downloads)                       |
| End-of-run notice: "N papers skipped deep analysis due to reCAPTCHA" | Playwright is not installed, so the fallback could not run             | [reCAPTCHA without Playwright](#recaptcha-without-playwright)                   |
| `google: rate limited (429) - retry in 23s` (any provider)           | Provider rate limit reached                                            | [Provider rate limits](#provider-rate-limits)                                   |
| `anthropic: overloaded (529)`                                        | Temporary Anthropic capacity shortage handled via rate-limit backoff   | [Provider rate limits](#provider-rate-limits)                                   |
| A stage fails on its first attempt with the provider's message       | Invalid key, unknown model ID, or malformed/oversized request          | [Errors that fail on the first attempt](#errors-that-fail-on-the-first-attempt) |
| `Run halted: … refusalPolicy is 'fail'`                              | A provider safety classifier declined a call under the `fail` policy   | [Safety refusal](#a-provider-declined-the-content-safety-refusal)               |
| `context_length_exceeded` / `FAILED_PRECONDITION`                    | Prompt plus paper content exceeded the model's context window          | [Context overflow](#context-overflow)                                           |
| Costs are higher than expected mid-run                               | Frontier model on large PDF set, or repeated validation retries        | [Cost spike mid-run](#cost-spike-mid-run)                                       |
| Pipeline appears frozen for > 5 minutes                              | Waiting at a review gate, hung network request, or closed tab          | [Stuck stage](#stuck-stage)                                                     |
| `Briefing generation failed: repair failed: …`                       | Briefing failed validation checks and both repair and salvage failed   | [Briefing schema-validation failure](#briefing-schema-validation-failure)       |
| Header says `claims check did not run`                               | The audit call failed twice, so the briefing was saved unaudited       | [Hallucination-retry loop](#hallucination-retry-loop)                           |
| Briefing renders with a `YES` hallucination badge                    | Audit flagged unsupported claims (with retry disabled or also flagged) | [Hallucination-retry loop](#hallucination-retry-loop)                           |
| Briefing retries once and stops                                      | Synthesis retry is capped at one pass to prevent runaway billing       | [Hallucination-retry loop](#hallucination-retry-loop)                           |

---

## Install-time issues

### Node version too old

Aparture requires Node.js 22 or newer (enforced by `engines` in `package.json`, with CI testing Node 22 and Node 24; Node 20 reached end of life on 2026-04-30):

```bash
node -v   # should print v22.x.x
npm -v    # should print 10.x or 11.x
```

If `node -v` reports an older release, install Node 22 using `nvm` (on macOS, Linux, or WSL2) or `fnm` (on native Windows) following the [Install guide](/getting-started/install).

### npm install failures

- **Permission errors** (`EACCES`, `"permission denied writing to /usr/local/lib/node_modules"`): Node is installed in a system directory requiring root privileges. Install Node through `nvm` so global and project packages live inside `~/.nvm/` under your user account.
- **Corporate proxy or custom registry errors** (`ECONNRESET`, `ETIMEDOUT`): Configure `npm` to route requests through your proxy:

  ```bash
  npm config set proxy http://your-proxy:port
  npm config set https-proxy http://your-proxy:port
  # If your organization uses an internal registry:
  npm config set registry https://your-registry/
  ```

- **Corrupted npm cache** (intermittent install errors that fail to reproduce cleanly):

  ```bash
  npm cache clean --force
  rm -rf node_modules package-lock.json
  npm install
  ```

- **Native module build errors** (`gyp ERR!`, `not found: python`): Transitive native dependencies require Python and a C++ compiler toolchain:
  - **macOS:** Run `xcode-select --install` and `brew install python@3.12`.
  - **Linux:** Run `sudo apt install -y build-essential` (or your distribution's equivalent package group).
  - **Windows native:** Install the Visual Studio Build Tools with the C++ workload enabled.
- **Missing rolldown native binding (ARM64 only):** When `npm test` fails with `Cannot find module '@rolldown/binding-linux-arm64-gnu'` (or `win32-arm64-msvc` / `darwin-arm64`), npm's optional-dependency resolver skipped the platform binary for Vitest's `rolldown` bundler ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). `npm run dev` is unaffected, and you can install the binding directly:

  ```bash
  # Direct fix for Linux ARM64 (substitute your platform slug if different):
  npm install --no-save @rolldown/binding-linux-arm64-gnu

  # Or reinstall from scratch:
  rm -rf node_modules package-lock.json && npm install
  ```

### Playwright install failures

Running `npx playwright install chromium` downloads a ~300 MB browser archive:

- **Insufficient disk space:** Playwright stores browser binaries under `~/.cache/ms-playwright/` on macOS and Linux, and under `%USERPROFILE%\AppData\Local\ms-playwright\` on Windows.
- **Missing system shared libraries (Linux only):** Chromium requires `libnss3`, `libatk-bridge2.0-0`, `libxcomposite1`, and related system libraries; install them via `sudo`:

  ```bash
  npx playwright install-deps chromium
  ```

  macOS (including native Apple Silicon builds) and Windows do not require this step.

- **Corporate proxy mirror:** Point the Playwright installer at your internal mirror:

  ```bash
  PLAYWRIGHT_DOWNLOAD_HOST=https://your-mirror npx playwright install chromium
  ```

::: info Playwright is optional
Aparture runs without Playwright; installing it simply enables the automatic headless browser fallback when arXiv serves a reCAPTCHA page on a PDF download. Without Playwright, affected papers log a notice and remain ranked by their abstract scores ([Install → Playwright](/getting-started/install)).
:::

---

## First-launch issues

### Port 3000 already in use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Another `next dev` process or local service is already listening on port `3000`:

```bash
# macOS / Linux / WSL2
lsof -i :3000

# Windows PowerShell
netstat -ano | findstr :3000
```

Stop the existing process, or set `PORT=3001` in `.env.local` and restart `npm run dev`.

### Reaching the app from another device

Because `npm run dev` and `npm start` bind to `127.0.0.1` by default, only the local machine can connect. To access the interface from another device on your local network, bind to all interfaces:

```bash
npm run dev -- -H 0.0.0.0
```

Then open `http://<this-machine-ip>:3000` from the other device. Because any device on the local network can reach the login prompt, set a strong `ACCESS_PASSWORD` in `.env.local` first, and never expose this port directly to the public internet.

### `.env.local` not loading

Next.js reads `.env.local` once when `npm run dev` starts, so edits made while the server is running do not take effect until you restart the server.

::: warning Always restart after editing `.env.local`
Press `Ctrl-C` in the terminal running `npm run dev` and run `npm run dev` again after saving changes to `.env.local`.
:::

Verify that your `.env.local` file meets these requirements:

- Located in the repository root alongside `package.json`.
- Named `.env.local` exactly (not `.env`, `.env.development`, or `.env.prod`).
- Saved as UTF-8 without BOM, with LF line endings and unquoted values ([Environment → File format rules](/reference/environment#file-format-rules)).

You can test whether Node parses `.env.local` cleanly by running:

```bash
# From the project root
node --env-file=.env.local -e "console.log(process.env.CLAUDE_API_KEY?.slice(0, 10))"
```

If that command prints the first 10 characters of your key, the file is formatted and located properly; if it prints `undefined`, check the filename, path, and variable spelling.

### ACCESS_PASSWORD mismatch

When every API request returns `401 Invalid password` immediately after logging in, check for these causes:

1. **Trailing whitespace:** `ACCESS_PASSWORD=correct-horse ` with a trailing space does not match `correct-horse`; remove any trailing spaces in `.env.local`.
2. **Windows CRLF line endings:** A trailing `\r` character at the end of the line becomes part of the password string on Linux/WSL2; save `.env.local` with LF line endings.
3. **UTF-8 BOM header:** A byte-order mark at the start of `.env.local` corrupts the first key name; save the file as UTF-8 without BOM.
4. **Case sensitivity:** Password comparison is case-sensitive.
5. **Stale server process:** Restart `npm run dev` so the server loads the current value from `.env.local`.

### API key format issues

When a request passes the `ACCESS_PASSWORD` check and returns `no API key for <provider>` or a provider `401` error, either the provider's environment variable is unset in `.env.local` or the key value is invalid.

Check that your key matches the expected variable name and prefix:

| Provider  | Env var             | Prefix                    |
| --------- | ------------------- | ------------------------- |
| Anthropic | `CLAUDE_API_KEY`    | `sk-ant-api03-...`        |
| OpenAI    | `OPENAI_API_KEY`    | `sk-proj-...` or `sk-...` |
| Google    | `GOOGLE_AI_API_KEY` | `AIza...` (standard keys) |

Pasting an OAuth token or organization ID instead of an API key causes a `401` error. For Google, note that auth keys issued by AI Studio since 2026-05-28 use a different format from legacy `AIza...` standard keys and work as issued, whereas legacy `AIza...` keys labeled **Unrestricted** in AI Studio must be restricted to the Gemini API ([Google setup](/getting-started/api-keys-google#_2-create-an-api-key)). See the provider setup guides for full details: [Anthropic](/getting-started/api-keys-anthropic), [OpenAI](/getting-started/api-keys-openai), and [Google](/getting-started/api-keys-google).

Run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free) and [Minimal API Test](/getting-started/verify-setup#minimal-api-test) to inspect the exact error message returned by the provider.

---

## Mid-run issues

### Briefing disk writes failing

```
[useBriefing] failed to persist briefing to disk: <reason>
```

Each completed briefing is written to `reports/briefings/<id>.json` via `POST /api/briefings`. Even if the disk write fails, the briefing remains in browser state for the current session; however, refreshing the page or loading the briefing from history later will show a placeholder if the file could not be written to disk.

Check these common causes:

- **Filesystem permissions on `reports/`:** Run `chmod u+w reports/` or ensure the user running `npm run dev` owns the repository directory.
- **Disk space:** Check free space with `df -h` (each briefing file is 200 KB to 1 MB, totaling under 1 GB per year of daily runs).
- **Invalid `APARTURE_REPORTS_DIR`:** Unset `APARTURE_REPORTS_DIR` or verify that its target directory exists and is writable.
- **`ACCESS_PASSWORD` mismatch:** If the server log shows `401 Invalid password` on `POST /api/briefings`, restart `npm run dev` and re-authenticate.

### Session disk writes failing

```
[useAnalyzerPersistence] failed to persist session to disk: <reason>
```

Full analyzer session state (`allPapers`, `scoredPapers`, and filter verdicts) is saved to `reports/sessions/<sessionId>.json` via `POST /api/sessions` on each debounced update, while browser `localStorage` (`arxivAnalyzerState`) stores a compact summary (`config`, the top-30 `finalRanking`, and filter counts) so the live UI continues operating even if disk writes fail. Restoring the full paper list after a browser refresh requires the disk file, so resolve any permission, disk-space, `APARTURE_REPORTS_DIR`, or `ACCESS_PASSWORD` issues using the steps above.

### Browser localStorage quota

Exceeding the browser's `localStorage` quota never aborts a pipeline run because heavy fields live on disk, the hot `arxivAnalyzerState` summary stays under ~600 KB, and `safeSetItem` automatically trims older entries and logs a single `console.warn` if storage is full.

If the warning persists across runs because of a legacy `arxivAnalyzerState` entry from an older version, clear it in the browser DevTools console by running `localStorage.removeItem('arxivAnalyzerState')` and refreshing the page.

### arXiv rate limits

```
arXiv rate limit: exhausted 3 retries
OAI rate limit exhausted after 3 retries
```

The first message comes from the Atom query proxy and the second from the OAI-PMH harvesting proxy. arXiv enforces a rate limit of roughly one request every 3 seconds across all connections from an IP address. Aparture serializes metadata requests with a 3–5 second jittered delay and backs off for 5, 15, and 45 seconds on HTTP 429 responses, so a single run rarely triggers rate limiting unless one of the following occurs:

- Two Aparture harvests ran concurrently (for example, in two browser tabs or a CLI script alongside the web UI).
- A run across many categories encountered sustained upstream throttling that exhausted the 5 / 15 / 45-second retry ladder.
- Other traffic from the same IP address is querying `arxiv.org` simultaneously.

Wait five minutes and start a single run with a smaller category set. Upstream HTTP 5xx errors from arXiv are mapped onto the same retry ladder and log format (`arXiv rate limit`) with the upstream status code printed alongside; sustained 5xx responses indicate arXiv server maintenance ([arxiv.org](https://arxiv.org)).

::: tip Reduce your chance of being throttled
Set `ARXIV_CONTACT_EMAIL` in `.env.local` ([Environment](/reference/environment#arxiv-contact-email)) so Aparture sends an identifying `From` header on every request, which arXiv's rate-limit heuristics weight more favorably (particularly for `.edu` and `.ac.*` addresses).
:::

### arXiv rate-limited

When `npm run dev` logs repeated `OAI 429` or `arXiv 429` messages and the run badge displays `arXiv: auto-atom` with slower harvesting, OAI-PMH encountered throttling and `auto` mode fell back to the Atom `/api/query` endpoint (which arXiv rate-limits more strictly). Wait 30–60 minutes before re-running, and test connectivity manually with `node scripts/probe-arxiv.mjs`. Full diagnostic details are in [arXiv ingestion](../concepts/arxiv-ingestion.md#troubleshooting).

### reCAPTCHA on PDF downloads

arXiv's PDF servers occasionally return an HTML reCAPTCHA challenge page instead of PDF bytes after a burst of downloads. To minimize challenges, Aparture spaces all `arxiv.org` page and PDF requests 15 seconds apart (matching the crawl delay in `arxiv.org/robots.txt`), with a Playwright fallback consuming two spacing slots (one for the abstract page and one for the PDF). Whenever a `200 OK` PDF response does not start with `%PDF-`, Aparture detects the reCAPTCHA interstitial and invokes Playwright, which reuses cookies stored in `temp/playwright-profile/` to clear the challenge automatically.

Standard HTTP errors (`403`, `404`, network timeouts, or exhausted `429` retries) are retried through the standard HTTP retry ladder and reported with their actual status code (such as `Failed to download PDF: HTTP 403`).

- **When Playwright is installed:** The fallback executes automatically and logs:

  ```
  Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...
  Attempting PDF download via Playwright (reCAPTCHA bypass)...
  PDF downloaded via Playwright: 123456 bytes
  ```

  The first fallback call on a fresh `temp/playwright-profile/` directory takes 5–10 seconds to initialize the browser session, and subsequent calls reuse the saved cookies.

- **If the Playwright session itself is rejected:** Delete the cached browser profile and restart the server so the next download establishes a fresh cookie session:

  ```bash
  rm -rf temp/playwright-profile/
  npm run dev
  ```

### reCAPTCHA without Playwright

When Playwright is not installed and arXiv serves a reCAPTCHA page, the affected paper logs a notice in the Progress Timeline:

> PDF for _Paper Title_ blocked by reCAPTCHA (install Playwright to enable fallback).

At the end of the run, a summary card lists the affected papers:

> 3 papers skipped deep analysis due to reCAPTCHA. Run `npx playwright install chromium` to enable the workaround.

Those papers remain in the final ranking using their Stage 3 abstract scores and are included in the briefing without a Stage 4 full-PDF report. To enable full-PDF analysis on future runs, install Playwright's Chromium binary ([Install → Playwright](/getting-started/install#_5-playwright-optional-fallback-for-recaptcha)):

```bash
npx playwright install chromium
```

### Provider rate limits

Aparture honors `Retry-After` headers from all providers and pauses all concurrent workers for a provider via a shared barrier whenever any worker receives HTTP 429, 503, or Anthropic's 529 (because provider rate limits apply at the project or organization level). The retry ladder honors `Retry-After` up to 60 seconds, or uses exponential backoff with $\pm 20\%$ jitter capped at 30 seconds across up to `maxRetries` attempts (default 4, for 5 total attempts). At the end of each stage, the activity log reports how many batches experienced rate limiting so you can tune concurrency or tier settings.

When a stage uses a Gemini Flash-Lite model with a batch count and concurrency that would exceed roughly 60 requests per minute, Aparture logs a pre-flight notice before the stage starts and recovers automatically through the rate-limit barrier if throttled.

In the activity log, HTTP 429 responses appear as `<provider>: rate limited (429)` and Anthropic HTTP 529 responses appear as `anthropic: overloaded (529)` (indicating temporary provider capacity load that resolves automatically), while the terminal prints the raw response body:

- **Anthropic 429** (`anthropic: rate limited (429)`):
  - _Input or output tokens-per-minute limit:_ Wait 60 seconds, lower `filterBatchSize` or `scoringBatchSize`, or move to a higher usage tier.
  - _Requests-per-minute limit:_ Increase batch sizes so the stage sends fewer, larger requests.
  - _Acceleration limit:_ Anthropic throttles sudden traffic spikes; start with a smaller run before launching a large multi-category harvest.
- **OpenAI 429** (`openai: rate limited (429)`):
  - _"Rate limit reached for requests":_ Handled automatically by the client retry loop and `Retry-After` backoff; lower concurrency in Settings if your account is on the initial usage tier.
  - _"You exceeded your current quota":_ Indicates a zero prepaid credit balance or reached monthly spend cap; check billing status at [platform.openai.com](https://platform.openai.com).
- **Google 429** (`google: rate limited (429)` with `RESOURCE_EXHAUSTED`): The raw error body names the specific quota reached. Because Google enforces rate limits per Cloud project and per model (visible at [aistudio.google.com](https://aistudio.google.com/)), medium-to-large runs can reach free-tier limits; keep the Stage 2 quick filter enabled, lower concurrency, or link a billing account.
- **HTTP 429 during Stage 4 (PDF analysis):** Stage 4 defaults to 3 concurrent workers (`pdfAnalysisConcurrency`). If 429 errors occur on PDF calls, lower **Settings → Parallel PDF Calls** to `2` or `1` (or raise it up to `20` on high-tier paid accounts).
- **HTTP 429 during quick-summary fan-out:** Briefing preparation runs quick summaries at concurrency 5 (`quickSummaryConcurrency`). If 429 errors occur during quick summaries, lower **Parallel Quick-Summary Calls** under **Settings → Advanced Options → Briefing Options**.

### Errors that fail on the first attempt

Deterministic request errors fail immediately on the first attempt without retrying because repeating the identical request would fail again and waste tokens:

- **HTTP 401 or 403:** Missing, malformed, or revoked API key, or lacked model access ([API key format issues](#api-key-format-issues)).
- **HTTP 400 or 404:** Unrecognized model ID or malformed request payload; verify your model slots in Settings and run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free).
- **HTTP 413:** Request payload exceeds the provider's size limit; lower the stage's batch size or select a model with a larger context window.
- **HTTP 422** (other than a content-safety refusal or reCAPTCHA fallback notice).

When a batch fails with a non-retryable error, the stage logs the provider's error message, records the failed batch, and continues processing the remaining batches.

### A provider declined the content (safety refusal)

```
anthropic declined this request (cyber)
google blocked the prompt (SAFETY)
```

These messages indicate that a provider's safety classifier declined the prompt on content-policy grounds. Because safety classifiers are deterministic and bill input tokens on every attempt, Aparture never retries a refusal on the same model.

How the pipeline proceeds is governed by **Settings → Query Options → On Safety Refusal** (`refusalPolicy`, defaulting to `skip`): under `skip`, the stage drops and records the affected paper or batch and continues the run; under `fail`, the run halts immediately with `Run halted: anthropic declined scoring (batch 3 …) on content grounds (cyber), and refusalPolicy is 'fail'.` along with instructions for switching to `skip` or `fallback`. An end-of-run summary card lists any declined batches, stages, and categories ([Tuning the pipeline](/using/tuning-the-pipeline#when-a-provider-declines-on-content-grounds)).

If safety refusals occur repeatedly:

- **Switch the stage to a different model or provider**, because classifier false-positive rates vary across model families.
- **Set `refusalPolicy` to `fallback`** and choose a `refusalFallbackModel` from another provider so declined calls are re-issued once automatically on the fallback model.
- **Note subfield sensitivity in `cs.CR` and `q-bio`:** Cybersecurity and quantitative biology abstracts occasionally trigger general-purpose safety classifiers, whereas astronomy, statistics, and general machine-learning abstracts rarely do.

Because briefing synthesis (`/api/synthesize`) combines all final-round papers into a single call, a safety refusal during synthesis cannot skip a single paper and instead reports an explicit failure so you can regenerate the briefing on another `briefingModel`.

**Note on Claude Fable HTTP 400 errors:** `claude-fable-5.1` and `claude-fable-5` require your Anthropic organization's data retention to be set to 30 days; under zero-data-retention settings, every request fails with HTTP 400.

### Context overflow

```
... context_length_exceeded ...
... FAILED_PRECONDITION ...
```

This error indicates that the prompt plus paper content exceeded the selected model's context window, most commonly during Stage 4 full-PDF analysis on long manuscripts.

Switch `pdfModel` in Settings to a 1M-context model ([Model selection](/concepts/model-selection)), or for abstract stages reduce `scoringBatchSize` (default `3`).

### Cost spike mid-run

Aparture displays projected stage costs at the score-review and pre-briefing gates and computes post-run token cost estimates on the Download Report card using registry list prices. To inspect live billed usage during or after a run, check your provider's console:

- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) → Usage.
- **OpenAI:** [platform.openai.com/usage](https://platform.openai.com/usage).
- **Google:** [aistudio.google.com](https://aistudio.google.com) (free tier) or `console.cloud.google.com` (paid billing accounts).

Higher-than-expected token usage typically comes from one of three sources:

- **Validation correction loops:** When a model's response fails schema validation, the backend route runs one correction pass and the client retries failed requests up to `maxRetries` times (default 4). If you see repeated `validation failed` messages in the terminal, switch that stage to a more capable model that follows structured schemas reliably.
- **Frontier model on a large PDF set:** Running a high-cost model across dozens of full PDFs accumulates input tokens quickly; see [Model selection](/concepts/model-selection) for cost-effective Stage 4 options.
- **High `maxDeepAnalysis` cap:** Lower `maxDeepAnalysis` (default `30`) in Settings to cap the number of full-PDF reads per run.

### Stuck stage

If the pipeline appears inactive for more than five minutes with no terminal output:

1. **Check whether the pipeline is waiting at a review gate:** By default, **Pause after filter**, **Pause before deep analysis**, and **Pause before briefing** are all enabled. When paused at a gate, the UI displays a banner with a **Continue** button at the top of the review section, the browser tab title updates to indicate it is waiting, and terminal logging pauses until you click **Continue** ([Review gates](/using/review-gates)).
2. **If no gate banner is active, inspect the browser DevTools Network tab** for pending `/api/*` requests:
   - `/api/synthesize` pending for over 5 minutes: Large-context synthesis calls can take several minutes (1M-context Anthropic requests allow a 10-minute TCP timeout). If it hangs beyond that, refresh and retry with a smaller `maxDeepAnalysis` or a faster `briefingModel`.
   - `/api/analyze-pdf` pending for over 2 minutes: Playwright may be stalled on a reCAPTCHA challenge; remove `temp/playwright-profile/` and restart the server if needed.
   - No pending network requests: Check the terminal for an unhandled exception and reload the page.

To cancel an active run at any point, click **Stop**. The pipeline aborts at the next checkpoint and unlocks the UI controls immediately (any LLM request already in flight at the provider completes and is billed, while its response is discarded).

---

## Briefing-time issues

### Briefing schema-validation failure

```
Briefing generation failed: repair failed: paper "2510.01234" is not in any theme
```

Before a briefing renders, Aparture runs deterministic checks (`lib/synthesis/validator.js`): it normalizes card titles and scores from the input paper metadata and rejects briefings that cite unknown arXiv IDs (in cards, themes, or prose), omit an input paper, duplicate a card, or leave a card unassigned to any theme. When validation fails, Aparture runs one LLM repair call (`lib/synthesis/repair.js`) with the specific validation errors; if repair also fails, `salvageBriefing` repairs the structure deterministically in code (removing unknown IDs, adding labeled placeholder cards for omitted papers, grouping unthemed cards under `"Other papers"`, and replacing unknown prose IDs with `[unverified arXiv ID removed]`), logging `[synthesize] repair failed (…); salvaged deterministically:` in the terminal.

The error above appears only when the model's response fails basic JSON schema parsing even after repair and salvage ([Briefing anatomy](/concepts/briefing-anatomy#checks-before-display)):

1. Open browser DevTools → Network, select the failed `synthesize` request, and inspect the response body's `details` array.
2. Match the error detail to its fix:
   - `references unknown arxivId` or `mentions arXiv id "…"`: The model cited an arXiv ID outside the input set; switch `briefingModel` to a stronger model.
   - `has no card` or `is not in any theme`: The model omitted papers from the briefing structure; retry or lower `maxDeepAnalysis`.
   - `repair callModel returned no structured output` or `model did not return structured output`: The provider failed to return valid JSON matching the schema; switch `briefingModel` to another model or provider.

**Token budget pre-flight block (`synthesis prompt exceeds token budget`, HTTP 400):** `/api/synthesize` estimates prompt length at roughly 4 characters per token and blocks requests exceeding 500,000 estimated tokens by default; shorten your profile or lower `maxDeepAnalysis`.

### Hallucination-retry loop

After synthesis completes, `/api/check-briefing` audits the generated briefing against the untruncated source papers and records a hallucination verdict badge in Generation details: `NO` (clean), `MAYBE` (borderline), or `YES` (unsupported claims flagged), reflected in the header as _claims checked_, _claims check flagged N claims_, or _claims check did not run_.

- **`claims check did not run`:** The audit call and its automatic retry both failed (typically due to a transient provider error or rate limit), so the briefing was saved as unaudited with the error recorded in Generation details. Regenerate the briefing once the provider recovers or switch `briefingModel`.
- **Automatic synthesis retry:** Under **Settings → Review & confirmation**, `briefingRetryOnYes` (enabled by default) and `briefingRetryOnMaybe` (disabled by default) control whether a flagged audit triggers a second synthesis pass with the flagged claims attached as retry feedback. When a retry runs, the badge displays `"(after retry)"` alongside the second audit's verdict.

::: info One retry per briefing, maximum
Automatic synthesis retry is capped at one pass per briefing to prevent runaway token spend. If the second synthesis pass still flags claims, Aparture displays the second briefing and its audit report directly.
:::

- **Evaluating a flagged briefing:** Expand `flaggedClaims` in Generation details to inspect the auditor's specific objections. If the flagged sentences represent reasonable cross-paper synthesis or conservative phrasing, you can read the briefing as-is; if the model invented specific numbers or methods, switch `briefingModel` to a stronger frontier model and regenerate.
- **Persistent audit flags across runs:** If the same `briefingModel` repeatedly triggers audit flags across multiple days, tighten the sourcing instructions in `prompts/synthesis.md` ([Prompts](/reference/prompts)).

---

## How to read the logs

Diagnostic output is split between the terminal running `npm run dev` (which logs server-side LLM calls, caching, and arXiv proxy requests) and the browser DevTools console.

### Browser console (devtools)

Open DevTools (`F12` or `Cmd-Option-I`) → Console to inspect client-side stage summaries:

- `=== FILTER SUMMARY ===`, `=== SCORING SUMMARY ===`, `=== POST-PROCESSING SUMMARY ===`, and `=== SELECTION SUMMARY ===`: End-of-stage paper counts.
- `harvest-arxiv proxy unreachable` / `fetch-arxiv proxy unreachable`: The browser could not reach the local Next.js API server.
- `Hallucination check failed:` or `Hallucination check returned a non-JSON body`: Non-fatal audit errors (the briefing still renders and displays `claims check did not run` in the header).

Detailed batch progress, retries, and skipped papers appear directly in the in-app Pipeline activity log. Investigate any red HTTP 500 entries for `/api/*` in the Network tab or `Uncaught (in promise) Error:` messages in the console (note that `Operation aborted` errors are normal when clicking **Stop**).

### Terminal output

The terminal running `npm run dev` logs every backend LLM call and arXiv request:

- **LLM dispatch lines:**
  - `Sending request to Anthropic: { model, promptLength, structured, cacheable?, hasPdf? }` logs at the start of every LLM request.
  - `[anthropic cache] read=N create=N` reports Anthropic prompt-cache token counts (`read > 0` on call 2 and later confirms that the `cachePrefix` split is hitting the cache).
  - `[openai cache] read=N` reports automatic OpenAI prefix-cache hits.
- **Route and download lines:**
  - `Proxying OAI-PMH request: <url>` (and `Proxying arXiv request: <query>` on the Atom fallback) logs each metadata harvest page.
  - `OAI 429 retry-after=X` / `arXiv 429, Retry-After: X` logs upstream arXiv rate-limit responses and backoff durations.
  - `Downloading PDF from: <url>` followed by `PDF downloaded via direct fetch: { ... }` logs direct Stage 4 PDF downloads.
  - `Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...` and `PDF downloaded via Playwright: <bytes> bytes` log headless browser fallback downloads.
  - `[anthropic] API error 429` / `[openai] API error 400` / `[google] API error 503` logs the raw provider error response.
  - `Initial PDF analysis response validation failed: [<errors>]` (and matching filter, scoring, and rescore lines) logs when a route triggers its single backend correction call before returning HTTP 502 if correction also fails.

When debugging a run, you can pipe terminal output to a log file (`npm run dev 2>&1 | tee run.log`) and filter with `grep`:

```bash
grep "API error"           # every provider error
grep "429"                 # all rate-limit events
grep "validation failed"   # every correction-path trigger
grep "Playwright"          # reCAPTCHA fallback activity
grep "cache] read"         # cache effectiveness
grep "=== .* SUMMARY"      # stage transitions
```

### What a healthy run looks like

During a normal run on a single provider, terminal and browser logs follow this sequence:

1. `Proxying OAI-PMH request:` once per top-level archive group and pagination token (or `Proxying arXiv request:` per category on the Atom fallback).
2. `Sending request to <Provider>: { ..., cacheable: true }` across Stage 2 filter batches.
3. `[anthropic cache] read=<N>` (with `N > 0`) from the second batch onward when using Anthropic.
4. `=== FILTER SUMMARY ===` with `YES`, `MAYBE`, and `NO` counts.
5. `Sending request to <Provider>:` across Stage 3 scoring batches, followed by `=== SCORING SUMMARY ===`.
6. `Downloading PDF from:` and `PDF downloaded via direct fetch:` for selected papers (with occasional Playwright fallback lines if arXiv serves a reCAPTCHA challenge).
7. `=== SELECTION SUMMARY ===`.
8. `Sending request to <Provider>:` once per selected paper for Stage 4 full-PDF analysis.
9. `Sending request to <Provider>:` across parallel quick-summary calls (concurrency 5 by default).
10. `Sending request to <Provider>:` for `/api/synthesize`.
11. `Sending request to <Provider>:` for `/api/check-briefing`.
12. Optionally, two additional `Sending request to <Provider>:` calls if the hallucination audit triggered a synthesis retry and re-audit.

Investigate further if you observe `[anthropic cache] read=0` across all batches within a stage, repeated `API error 429` lines that exhaust retries, or `validation failed` notices on more than ~10% of batches.

---

## Where to file an issue

Report bugs or unexpected behavior at [GitHub issues → joshspeagle/aparture](https://github.com/joshspeagle/aparture/issues) and include:

- Your operating system (macOS, Linux, native Windows, or WSL2) and Node version (`node -v`).
- The terminal output from the failing run (with API keys redacted).
- Any relevant error stack trace from the browser DevTools console.
- A brief description of the configuration and steps that triggered the issue.

---

_Snapshot taken 2026-04-19. Provider error codes reflect Anthropic, OpenAI, and Google API documentation as of that date._
