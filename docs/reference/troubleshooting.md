# Troubleshooting

Most Aparture problems show up at one of four points: install, first launch, mid-run, or briefing time. The cards below jump to the relevant section; the master table below them is a direct symptom lookup.

<div class="landing-cards">

<div class="landing-card">

### Install-time

`npm install` fails, Playwright won't download Chromium, Node is too old, proxy or cache errors.

[Go to install-time issues →](#install-time-issues)

</div>

<div class="landing-card">

### First-launch

Port 3000 in use, `.env.local` edits not taking effect, `ACCESS_PASSWORD` mismatch, malformed API keys.

[Go to first-launch issues →](#first-launch-issues)

</div>

<div class="landing-card">

### Mid-run

ArXiv rate limits, reCAPTCHA on PDF downloads, provider 429s, context-window overflow, cost spikes, stuck stages.

[Go to mid-run issues →](#mid-run-issues)

</div>

<div class="landing-card">

### Briefing-time

Synthesis schema failures, hallucination audit returned `YES`, retries that don't resolve.

[Go to briefing-time issues →](#briefing-time-issues)

</div>

</div>

If your symptom isn't here, [file an issue](https://github.com/joshspeagle/aparture/issues) with the full terminal output and the relevant browser-console block.

## Master symptom table

| Symptom                                                              | Likely cause                                                           | Jump to                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm install` fails with `gyp ERR!` or `EACCES`                      | Node version mismatch, missing build deps, or sudo install             | [npm install failures](#npm-install-failures)                                   |
| `npx playwright install chromium` hangs or fails                     | Disk space, missing system libs, or a corporate proxy                  | [Playwright install failures](#playwright-install-failures)                     |
| `Error: listen EADDRINUSE :::3000`                                   | Port 3000 already in use                                               | [Port 3000 already in use](#port-3000-already-in-use)                           |
| The app loads on this machine but not from another device            | The server listens on 127.0.0.1 only                                   | [Reaching the app from another device](#reaching-the-app-from-another-device)   |
| Every API call returns `401 Invalid password`                        | `ACCESS_PASSWORD` mismatch, trailing whitespace, or CRLF               | [ACCESS_PASSWORD mismatch](#access-password-mismatch)                           |
| `.env.local` edits don't appear to take effect                       | Dev server cached old values at startup                                | [`.env.local` not loading](#env-local-not-loading)                              |
| `no API key for <provider>` or provider `401`                        | API key env var unset, or wrong prefix pasted                          | [API key format issues](#api-key-format-issues)                                 |
| `arXiv rate limit: exhausted 3 retries`                              | ArXiv's 3s-per-request cap was tripped                                 | [arXiv rate limits](#arxiv-rate-limits)                                         |
| Run reports `arXiv: auto-atom`, much slower than usual               | OAI-PMH failed; Auto mode fell back to Atom                            | [arXiv rate-limited](#arxiv-rate-limited)                                       |
| `Failed to download PDF: HTTP 403` (or 404 / timeout)                | Genuine download failure — retried, then reported with the real status | [reCAPTCHA on PDF downloads](#recaptcha-on-pdf-downloads)                       |
| `reCAPTCHA detected` / Playwright fallback firing                    | ArXiv served a reCAPTCHA interstitial instead of PDF bytes             | [reCAPTCHA on PDF downloads](#recaptcha-on-pdf-downloads)                       |
| End-of-run notice: "N papers skipped deep analysis due to reCAPTCHA" | Playwright not installed; fallback unavailable                         | [reCAPTCHA without Playwright](#recaptcha-without-playwright)                   |
| `google: rate limited (429) — retry in 23s` (any provider)           | Provider rate-limit                                                    | [Provider rate limits](#provider-rate-limits)                                   |
| `anthropic: overloaded (529)`                                        | Anthropic is overloaded; handled like a rate limit                     | [Provider rate limits](#provider-rate-limits)                                   |
| A stage fails on its first attempt with the provider's message       | A bad key, unknown model, or malformed or oversized request            | [Errors that fail on the first attempt](#errors-that-fail-on-the-first-attempt) |
| `Run halted: … refusalPolicy is 'fail'`                              | A safety classifier declined a call, and the policy stops the run      | [Safety refusal](#a-provider-declined-the-content-safety-refusal)               |
| `context_length_exceeded` / `FAILED_PRECONDITION`                    | Prompt + content exceeded the model's context window                   | [Context overflow](#context-overflow)                                           |
| Costs are higher than expected mid-run                               | Expensive model, large batches, or runaway correction loops            | [Cost spike mid-run](#cost-spike-mid-run)                                       |
| Pipeline frozen for > 5 minutes                                      | Hung network request, unrecognised pause, or orphaned browser tab      | [Stuck stage](#stuck-stage)                                                     |
| `Briefing generation failed: repair failed: …`                       | The briefing failed its checks, and repair and salvage failed too      | [Briefing schema-validation failure](#briefing-schema-validation-failure)       |
| Header says `claims check did not run`                               | The audit call failed twice; the briefing is unaudited                 | [Hallucination-retry loop](#hallucination-retry-loop)                           |
| Briefing renders with a `YES` hallucination badge                    | Audit flagged claims; retry disabled or also flagged                   | [Hallucination-retry loop](#hallucination-retry-loop)                           |
| Briefing retries repeatedly and still fails                          | By design — at most one retry per briefing                             | [Hallucination-retry loop](#hallucination-retry-loop)                           |

---

## Install-time issues

### Node version too old

Aparture requires Node 22 or newer (the `engines` field in `package.json`), and CI tests Node 22 and 24. Node 20 reached end of life on 2026-04-30. Use Node 22 LTS unless you have a reason not to.

```bash
node -v   # should print v22.x.x
npm -v    # should print 10.x or 11.x
```

If `node -v` prints something older, install Node 22 via nvm (macOS / Linux / WSL2) or fnm (Windows native). [Install](/getting-started/install) has the full recipe.

### npm install failures

**Permissions errors** (`EACCES`, "permission denied writing to `/usr/local/lib/node_modules`"): you probably have Node installed outside a user-owned prefix, or you're running `sudo npm install -g` somewhere. Switch to nvm — its prefix lives under `~/.nvm/` and never needs sudo.

**Proxy or registry errors** (`ECONNRESET`, `ETIMEDOUT` on a corporate network): configure npm to route through your proxy.

```bash
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
# If your org runs its own registry, also:
npm config set registry https://your-registry/
```

**Corrupted cache** (intermittent install failures that don't reproduce):

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Native-module build errors** (`gyp ERR!`, `not found: python`): node-gyp needs Python and a C++ toolchain for some transitive dependencies.

- macOS: `xcode-select --install` then `brew install python@3.12`
- Linux: `sudo apt install -y build-essential` (or your distro's equivalent)
- Windows native: install the Visual Studio Build Tools, C++ workload

**Missing rolldown native binding (ARM64 only).** Surfaces as `npm test` failing with `Cannot find module '@rolldown/binding-linux-arm64-gnu'` (or `win32-arm64-msvc` / `darwin-arm64`). This is [npm/cli#4828](https://github.com/npm/cli/issues/4828) — npm occasionally fails to install the correct platform-specific binding from vitest's optional dependencies. Only affects vitest; `npm run dev` is fine either way.

```bash
# Direct fix for Linux ARM64 (substitute your platform slug if different):
npm install --no-save @rolldown/binding-linux-arm64-gnu

# Or reinstall from scratch:
rm -rf node_modules package-lock.json && npm install
```

### Playwright install failures

`npx playwright install chromium` downloads a ~300 MB browser. Common failures:

**Not enough disk space.** Chromium lands in `~/.cache/ms-playwright/` on macOS and Linux, `%USERPROFILE%\AppData\Local\ms-playwright\` on Windows.

**Missing system libraries (Linux only).** Chromium needs `libnss3`, `libatk-bridge2.0-0`, `libxcomposite1`, and friends:

```bash
npx playwright install-deps chromium
```

This uses sudo to install everything Chromium needs. macOS and Windows don't need this step. Playwright ships native builds for Apple Silicon, so Rosetta isn't needed.

**Corporate proxy.** Point the Playwright downloader at your mirror:

```bash
PLAYWRIGHT_DOWNLOAD_HOST=https://your-mirror npx playwright install chromium
```

::: info Playwright is optional
If you skip it, Aparture still runs — you just lose the reCAPTCHA fallback for PDF downloads. Affected papers get a per-paper notice and are ranked on their abstracts. See [Install → Playwright](/getting-started/install) for the full trade-off.
:::

---

## First-launch issues

### Port 3000 already in use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Another `next dev` instance or some other service is on port 3000.

```bash
# macOS / Linux / WSL2
lsof -i :3000

# Windows PowerShell
netstat -ano | findstr :3000
```

Either kill that process or set `PORT=3001` in `.env.local` and restart `npm run dev`.

### Reaching the app from another device

`npm run dev` and `npm start` listen on 127.0.0.1, so only the machine running the server can open the app. To reach it from another device on your network, start the server on all interfaces:

```bash
npm run dev -- -H 0.0.0.0
```

Then open `http://<this-machine's-address>:3000` from the other device. Anyone who can reach that address gets the login screen, so set a long `ACCESS_PASSWORD` first. Don't expose the app to the public internet this way.

### `.env.local` not loading

A running dev server may not pick up edits to `.env.local`, and nothing tells you when it hasn't.

::: warning Always restart after editing `.env.local`
Ctrl-C in the terminal running `npm run dev`, then re-run. Don't rely on env-file hot reload.
:::

Location rules:

- Must live at the project root, next to `package.json`. Not inside a subdirectory.
- Must be named `.env.local` exactly — not `.env`, not `.env.development`, not `.env.prod`.
- Must be UTF-8 without BOM, LF line endings, no quotes around values. See [Environment → File format rules](/reference/environment#file-format-rules).

Quick diagnostic — does the file actually parse?

```bash
# From the project root
node --env-file=.env.local -e "console.log(process.env.CLAUDE_API_KEY?.slice(0, 10))"
```

`--env-file` is built into Node, so this needs no extra package. If it prints the first 10 characters of your key, the file is readable. If it prints `undefined`, the file is in the wrong place, misnamed, or doesn't contain the variable.

### ACCESS_PASSWORD mismatch

Every API call returns `401 Invalid password`, typically right after entering the password on the login screen.

Common causes:

1. **Trailing whitespace.** `ACCESS_PASSWORD=correct-horse ` with a trailing space does not equal `correct-horse`. Open `.env.local` in an editor that shows invisible characters and trim.
2. **CRLF line endings on Windows.** A `\r` at end-of-line leaks into the password value — `ACCESS_PASSWORD=correct-horse\r` breaks comparison silently. Configure your editor to save `.env*` files as LF.
3. **BOM at the top of the file.** Windows Notepad's default UTF-8 save adds one. Use VS Code with UTF-8 (no BOM).
4. **Case sensitivity.** `Correct-Horse` is not the same as `correct-horse`.
5. **Dev server cached the old value.** Browser-side password storage updated, server-side didn't. Restart `npm run dev`.

### API key format issues

A request gets past `ACCESS_PASSWORD` but you see `no API key for <provider>` or a provider `401`. The first means the env var for the route's provider is unset, and the message names it; the second usually means the key is malformed or revoked.

Expected prefixes:

| Provider  | Env var             | Prefix                    |
| --------- | ------------------- | ------------------------- |
| Anthropic | `CLAUDE_API_KEY`    | `sk-ant-api03-...`        |
| OpenAI    | `OPENAI_API_KEY`    | `sk-proj-...` or `sk-...` |
| Google    | `GOOGLE_AI_API_KEY` | `AIza...` (standard keys) |

A wrong prefix usually means you pasted the wrong kind of secret, such as an OAuth token or an organization ID. Google is the exception: it doesn't document the format of the auth keys AI Studio has issued since 2026-05-28, so a Google key that doesn't start with `AIza` isn't wrong for that reason alone. A Google key with the right shape can still be refused: the Gemini API rejects unrestricted standard keys, so an older key that AI Studio labels Unrestricted needs a restriction to the Gemini API first ([Google setup](/getting-started/api-keys-google#_2-create-an-api-key) has the steps). See the per-provider pages: [Anthropic](/getting-started/api-keys-anthropic) · [OpenAI](/getting-started/api-keys-openai) · [Google](/getting-started/api-keys-google).

If the prefix looks right but the key still fails, run the [Minimal API Test](/getting-started/verify-setup#minimal-api-test). Its error message is usually more specific than the generic `401`.

---

## Mid-run issues

### Briefing disk writes failing

```
[useBriefing] failed to persist briefing to disk: <reason>
```

Each briefing is written to `reports/briefings/<id>.json` via `POST /api/briefings`. The in-memory state is preserved even when disk writes fail — the live briefing renders normally. The only symptom is that opening the briefing after a page refresh or in a later session returns a "briefing not available" placeholder (the file is missing).

Common causes:

- **Permission denied on `reports/`.** Fix with `chmod u+w reports/` or run Aparture from a directory you own.
- **Disk full.** Check `df -h`. Each briefing is typically 200 KB to 1 MB; a year of daily runs is well under 1 GB.
- **`APARTURE_REPORTS_DIR` points somewhere invalid.** Unset it or confirm the path exists and is writable.
- **`ACCESS_PASSWORD` not set or mismatched.** The POST auth check is the same as every other API route — if the server log shows `401 Invalid password` on `POST /api/briefings`, rotate the env var and restart `npm run dev`.

### Session disk writes failing

```
[useAnalyzerPersistence] failed to persist session to disk: <reason>
```

Analyzer session state (full `allPapers` + `scoredPapers` + filter verdicts) is written to `reports/sessions/<sessionId>.json` via `POST /api/sessions` on every debounced save. The hot tier (localStorage `arxivAnalyzerState`) carries only a small summary — `config`, `finalRanking` (top 30), and filter counts — so the live UI keeps working even when the cold tier write fails. After a page refresh, however, the cold tier is consulted to restore `allPapers`/`scoredPapers`; if it's missing, the page renders with the summary only.

Same fixes as briefings disk writes (permissions, disk full, `APARTURE_REPORTS_DIR`, `ACCESS_PASSWORD`).

### Browser localStorage quota

A full browser quota doesn't abort a run. Heavy session fields live on the filesystem, the localStorage hot entry stays under ~600 KB, and when the quota is hit anyway the `safeSetItem` ladder (shared with the briefings tier) logs a single `console.warn` and keeps going.

If you still see the warning repeatedly, you likely have a very old `arxivAnalyzerState` blob from a previous Aparture install that's not being shrunk. Clear it: in DevTools console run `localStorage.removeItem('arxivAnalyzerState')` and refresh.

### arXiv rate limits

```
arXiv rate limit: exhausted 3 retries
OAI rate limit exhausted after 3 retries
```

The first comes from the Atom path, the second from OAI-PMH. ArXiv caps metadata fetches at roughly one request per 3 seconds across all clients on your IP. Aparture serialises at that rate (with 3–5s jitter between consecutive requests) and back-off for 5 / 15 / 45 seconds on a 429, so a single run in isolation rarely trips the cap. Parallelising across categories doesn't help — the fetch path already serialises.

You'll hit this when:

- You ran two Aparture runs concurrently (two tabs, or a CLI run alongside a web run).
- You selected many categories and the serialised fetch exhausted the 5 / 15 / 45-second retry ladder.
- ArXiv is rate-limiting your IP from other traffic.

Wait five minutes or so, then rerun with fewer categories and no concurrent runs. Persistent 503s surface as the same `arXiv rate limit` error — Aparture maps upstream 5xx onto the same retry path as 429 because arXiv's `Retry-After` semantics are identical — with the upstream status logged alongside. Sustained 5xx rather than 429 suggests arXiv-side maintenance; check [arxiv.org](https://arxiv.org) for announcements.

::: tip Reduce your chance of being throttled
Set `ARXIV_CONTACT_EMAIL` in `.env.local` ([Environment](/reference/environment#arxiv-contact-email)) — arXiv weights requests from identified clients more leniently in their abuse heuristics. Academic `.edu`/`.ac.*` addresses tend to get the best treatment. Not a fix once you're already blocked, but a meaningful reduction in how often you hit this to begin with.
:::

### arXiv rate-limited

Symptoms: `npm run dev` logs show `OAI 429` or `arXiv 429` repeatedly, run reports `arXiv: auto-atom`, much slower than usual. Cause: OAI-PMH failed or was throttled, so Auto mode fell back to Atom, whose `/api/query` endpoint arXiv throttles more aggressively. Fix: wait 30-60 minutes; verify with the manual probe `node scripts/probe-arxiv.mjs`. See [arXiv ingestion](../concepts/arxiv-ingestion.md#troubleshooting) for full diagnosis steps.

### reCAPTCHA on PDF downloads

ArXiv's PDF endpoint can serve reCAPTCHA HTML instead of a PDF, typically after a burst of downloads. Aparture spaces PDF downloads 15 seconds apart, the crawl delay arXiv's robots.txt sets, which makes this less likely; a Playwright fallback uses two of those slots, one for the abstract page and one for the PDF. Aparture detects the interstitial automatically — an HTTP-OK response whose body doesn't begin with `%PDF-` is treated as the interstitial — and falls back to Playwright, which reuses a persistent cookie jar at `temp/playwright-profile/` to clear the challenge.

Genuine network/HTTP failures (a 403, a 404, a timeout, an exhausted 429) are **not** treated as reCAPTCHA: they go through the normal retry ladder and are reported with their real HTTP status, so a `Failed to download PDF: HTTP 403` line means the download itself failed, not that a challenge fired.

**With Playwright installed.** The fallback fires transparently. Terminal output:

```
Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...
Attempting PDF download via Playwright (reCAPTCHA bypass)...
PDF downloaded via Playwright: 123456 bytes
```

The first call after a fresh `temp/playwright-profile/` can take 5–10 seconds while the browser launches and the challenge resolves. Subsequent calls reuse the profile and are fast.

**If Playwright itself is blocked.** Rare — usually the persistent profile has been invalidated. Delete it and rerun:

```bash
rm -rf temp/playwright-profile/
npm run dev
```

The next PDF download will re-solve the challenge.

::: danger Don't delete `temp/notebooklm-profile/`
That's a Google session used for podcast generation, unrelated to arXiv. Deleting it forces an interactive Google re-login on the next podcast run.
:::

### reCAPTCHA without Playwright

If Playwright isn't installed, the fallback can't run. Each affected paper gets a per-paper notice in the Progress Timeline:

> PDF for _Paper Title_ blocked by reCAPTCHA — install Playwright to enable fallback.

At the end of the run a summary card appears below the results:

> 3 papers skipped deep analysis due to reCAPTCHA. Run `npx playwright install chromium` to enable the workaround.

The papers aren't lost. They stay in the ranking on their abstract score and still reach the briefing, without a full report. To enable deep analysis on them, install Playwright and rerun:

```bash
npx playwright install chromium
```

See [Install → Playwright](/getting-started/install#_5-playwright-optional-fallback-for-recaptcha) for the full recipe.

### Provider rate limits

Aparture honors `Retry-After` from every provider and pauses ALL concurrent
workers for the same provider when one batch trips a 429, a 503, or Anthropic's
529 (Gemini's RPM cap is project-scoped, so siblings are about to trip too). The retry ladder uses
exponential backoff with ±20 % jitter capped at 30 s, with up to
`maxRetries` retries (default 4 → 5 attempts). On a 429 with `Retry-After`,
the ladder honors that value first (capped at 60 s). End-of-stage activity-log
lines call out how many batches were rate-limited so you know whether to
adjust concurrency or upgrade tier.

When a stage runs on a Gemini Flash-Lite model with enough batches and
parallelism to pass about 60 requests a minute, Aparture also logs a pre-flight
warning before the stage starts. The run still proceeds and self-heals via the
barrier, but expect more retries.

Each provider has several flavours of 429, each with its own fix. The activity log shows a 429 as `<provider>: rate limited (429)` and Anthropic's 529 as `anthropic: overloaded (529)`, followed by `— retry in Ns` when the provider sent a retry time; the terminal shows the provider's raw error body. A 529 means Anthropic is short of capacity, not that you hit your limit, so it usually clears on its own.

**Anthropic 429** (`anthropic: rate limited (429)`).

- _Input/output token limit_ — you burned through the tokens-per-minute cap. Wait 60 seconds, reduce `filterBatchSize` or `scoringBatchSize`, or move to a higher tier.
- _Requests-per-minute_ — fewer, larger calls help; increase batch sizes.
- _Acceleration limit_ — Anthropic throttles sharp usage spikes. Ramp up slowly, small runs before large ones.

**OpenAI 429** (`openai: rate limited (429)`).

- _"Rate limit reached for requests"_ — transient. Aparture's client-side retry loop handles this automatically up to `maxRetries` times (default 4) with exponential backoff + provider `Retry-After` honoring.
- _"You exceeded your current quota"_ — billing issue, not transient. Check usage limits and billing status at [platform.openai.com](https://platform.openai.com).

New OpenAI accounts start on the lowest usage tier, and its per-minute limits are easy to exceed on a full run. Lower the concurrency settings until OpenAI moves the account up a tier as spend accumulates.

**Google 429** (`google: rate limited (429)`, with `RESOURCE_EXHAUSTED` in the raw error). The error body names the exhausted quota. Google applies rate limits per project, not per API key, and each model has its own limits; the free tier's are the lowest, and your current numbers are on the [AI Studio](https://aistudio.google.com/) dashboard. The default pipeline (filter batches + scoring + PDF analysis + quick-summary fan-out) can exceed free-tier limits on a medium run. Enable quick-filter to reduce downstream calls, reduce batch sizes, or move to a paid tier.

**429 specifically during Stage 4 (PDF analysis).** Aparture runs PDF analyses in parallel with a default concurrency of 3 (`pdfAnalysisConcurrency`). If 429s land on PDF calls specifically, drop Settings → **Parallel PDF Calls** from 3 to 2 or 1. If your tier is generous and the stage feels slow, you can raise it up to 20.

**429 during briefing prep (quick-summary fan-out).** The briefing stage fans out quick-summary calls with default concurrency 5 (`quickSummaryConcurrency`). If 429s land there, lower **Parallel Quick-Summary Calls** under Settings → Advanced Options → Briefing Options.

### Errors that fail on the first attempt

Some provider errors give the same answer however often the request is repeated, so Aparture doesn't retry them. The batch fails at once, and the activity log shows the provider's own message:

- **401 or 403:** the key is missing, malformed, revoked, or lacks access. See [API key format issues](#api-key-format-issues).
- **400 or 404:** the model ID is unknown to the provider, or the request is malformed. Check the slot in Settings, then run the [API Setup Check](/getting-started/verify-setup#step-0-api-setup-check-free).
- **413:** the request is too large for the provider. Lower the stage's batch size, or pick a model with a larger context window.
- **422** other than a safety refusal or the reCAPTCHA notice.

The stage records the failed batch and carries on with the rest, as it does when the retry ladder runs out.

### A provider declined the content (safety refusal)

```
anthropic declined this request (cyber)
google blocked the prompt (SAFETY)
```

A safety classifier refused the call. This is a content-policy decision by the provider — not a bug, not a malformed request, and not something a retry will fix (the same prompt to the same classifier gets the same answer, which is exactly why Aparture doesn't retry it).

What happens next depends on **Settings → Query Options → On Safety Refusal** (`refusalPolicy`, default `skip`). Under `skip`, the affected paper or batch is dropped, recorded, and the run continues. Under `fail`, the run stops with a message that starts `Run halted: anthropic declined scoring (batch 3 …) on content grounds (cyber), and refusalPolicy is 'fail'.` and goes on to say how to switch to `skip` or `fallback`. At the end of the run a summary card lists what was declined, at which stage, and under which category. See [Tuning the pipeline](/using/tuning-the-pipeline#when-a-provider-declines-on-content-grounds) for the full policy table.

If it keeps happening:

- **Switch the model for the affected stage.** Classifier sensitivity varies a lot between providers and between model tiers within a provider.
- **Set `refusalPolicy` to `fallback`** and pick a `refusalFallbackModel` — the call is re-issued once on that model, which may be a different provider.
- **Expect it if your profile overlaps cs.CR or q-bio.** Benign research abstracts in cybersecurity and parts of quantitative biology are the most likely to trip a classifier tuned for something else. Astronomy and mainstream ML profiles rarely see this at all.

Note the briefing stage can't skip: synthesis is a single call for the whole briefing, so a refusal there fails the briefing with an explicit message. Your papers and their analyses are unaffected — regenerate on a different `briefingModel`.

**A Claude Fable request that always 400s is a different problem.** `claude-fable-5.1` and `claude-fable-5` require your Anthropic organization's data retention to be set to 30 days; under zero data retention every request fails with a 400 that looks like a malformed payload. Check the org setting before debugging the request.

### Context overflow

```
... context_length_exceeded ...
... FAILED_PRECONDITION ...
```

Prompt + content exceeded the model's context window. Most common on Stage 4 PDF analysis with large papers and a small-context model.

Switch `pdfModel` in Settings to a model with a larger context window; [Model selection](/concepts/model-selection) lists the current options. For other stages, also reduce `scoringBatchSize` (default 3) and shorten your profile if it runs to multiple paragraphs of prose.

### Cost spike mid-run

Aparture estimates spend but doesn't read your provider bill. The score-review and pre-briefing gates show the projected cost of the stage they hold back, and after a run the Download Report card shows an estimated cost per stage from the tokens each stage used (list prices from the model registry, not a bill). For actual spend during a run, check the provider console:

- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) → Usage.
- **OpenAI:** [platform.openai.com/usage](https://platform.openai.com/usage).
- **Google:** [aistudio.google.com](https://aistudio.google.com) for free tier, `console.cloud.google.com` for paid.

Common drivers:

- **Correction loops.** A batch whose responses keep failing validation is retried, not dropped. The route makes one correction call before it gives up on a request, and the client re-sends the request up to `maxRetries` times (default 4), so one stubborn batch can cost about ten LLM calls. Repeated `validation failed` in the terminal suggests the model is struggling with the schema, so switch that stage to a stronger model.
- **Expensive model on Stage 4.** A top-tier model on 100 PDFs adds up fast. [Model selection](/concepts/model-selection) has cheaper per-stage picks.
- **Deep analysis on too many papers.** Lower `maxDeepAnalysis` (default 30).

### Stuck stage

The pipeline appears frozen for more than 5 minutes with no terminal output.

**First, check whether you're at a review gate.** Three checkboxes, all on by default, stop the pipeline and wait for you: Pause after filter, Pause before deep analysis, and Pause before briefing. The UI shows a banner with a Continue button at the head of the section under review, the browser tab title changes to a waiting message, and the terminal goes quiet. Click Continue to proceed, or see [Review gates](/using/review-gates) for the gate UX.

**If not paused:** open browser devtools → Network tab. Look for a pending request to `/api/*`:

- `/api/synthesize` pending > 5 min — the briefing model hung. Rare; 1M-context Anthropic requests have a 10-minute TCP timeout. Refresh and retry with a smaller `maxDeepAnalysis` or a different `briefingModel`.
- `/api/analyze-pdf` pending > 2 min — likely Playwright hung on a reCAPTCHA challenge. Check that `temp/playwright-profile/` isn't corrupted; delete it and rerun if so.
- No pending request — the pipeline may have crashed silently. Check the terminal for an exception trace; if none, reload the page.

**To abandon the run,** click Stop. The run ends at its next checkpoint and the controls free up at once, so you can start again. Requests already sent to a provider still finish and are billed; their results are discarded.

---

## Briefing-time issues

### Briefing schema-validation failure

```
Briefing generation failed: repair failed: paper "2510.01234" is not in any theme
```

Every briefing goes through deterministic checks before it renders: titles and scores are corrected from the input, and a briefing fails if it cites an unknown arXiv ID (in a card, a theme, or the prose), leaves out a paper, gives one paper two cards, or leaves a card in no theme. A failed briefing gets one LLM repair call that sees the errors. If the repair fails, Aparture salvages the briefing in code instead: it removes cards for unknown IDs, adds labelled placeholder cards for left-out papers, groups unthemed cards under "Other papers", and replaces unknown IDs in prose with _[unverified arXiv ID removed]_. The terminal logs `[synthesize] repair failed (…); salvaged deterministically:` with the list of fixes.

You see the error above only when even the salvaged briefing fails, usually because the model's output didn't match the schema at all. [Briefing anatomy](/concepts/briefing-anatomy#checks-before-display) lists every check.

What to check:

1. Open browser devtools → Network → click the failed `synthesize` request.
2. Look at the response body's `details` field. It lists the failed checks or the schema errors.
3. Common errors:
   - `references unknown arxivId` or `mentions arXiv id …, which is not in today's input`: the model cited a paper that wasn't in the input. Switch `briefingModel` to a stronger option.
   - `has no card` or `is not in any theme`: the model left papers out. A retry usually works; on large runs, a stronger model or a lower `maxDeepAnalysis` helps.
   - `repair callModel returned no structured output` or `model did not return structured output`: the provider fell back to plain text. Seen occasionally with Google on complex schemas. Switch to Anthropic or OpenAI for `briefingModel`.

**Token budget block.** Occasionally you'll see `synthesis prompt exceeds token budget` (400). The route estimates the prompt's size at about four characters per token, for every provider, and the estimate is above the block threshold (500,000 tokens by default). Shorten your profile, reduce `maxDeepAnalysis`, or pass `allowOverBudget: true` (not currently exposed in the UI — requires editing the request).

### Hallucination-retry loop

After synthesis, Aparture runs a separate LLM call that audits the briefing against the source papers. Each briefing displays a hallucination badge in the Generation details expandable section: `NO` (clean), `MAYBE` (uncertain), or `YES` (flagged). The header of the reading view repeats the outcome as _claims checked_, _claims check flagged N claims_, or _claims check did not run_.

**`claims check did not run`.** The audit call failed, and so did its one retry, so the briefing was saved unaudited. Generation details gives the reason, which is usually a provider error or a rate limit on the briefing model. Regenerate the briefing once the provider recovers, or switch `briefingModel`.

When retry fires: in Settings → Review & confirmation, `briefingRetryOnYes` (on by default) and `briefingRetryOnMaybe` (off by default) control whether a flagged verdict triggers a second synthesis pass with a retry hint. When retry happens, the badge shows "(after retry)" — you're reading the second attempt, and the audit ran again on it.

::: info One retry per briefing, maximum
The retry cap is one, to prevent runaway loops. If the retry also flags, you see the second briefing's audit result and that's the end of it.
:::

**When to accept a flagged briefing.** The audit surfaces specific claims in the `flaggedClaims` list. Expand it and read them. If they're phrased cautiously, reflect reasonable synthesis across the papers, or represent the auditor being unusually strict, the briefing is probably fine. If they're genuinely unsupported, switch `briefingModel` to a stronger option and rerun.

**When to change the prompt.** Persistent hallucinations across multiple briefings from the same `briefingModel` point at the synthesis prompt rather than the model. Edit `prompts/synthesis.md` — changes take effect on the next call. See [Prompts](/reference/prompts).

---

## How to read the logs

Most of the signal lives in the terminal running `npm run dev`. The browser console fills in the rest.

### Browser console (devtools)

Open devtools (F12 or Cmd-Option-I) → Console. During a run, useful lines:

- `=== FILTER SUMMARY ===` / `=== SCORING SUMMARY ===` / `=== POST-PROCESSING SUMMARY ===` / `=== SELECTION SUMMARY ===`: end-of-stage summaries with counts.
- `harvest-arxiv proxy unreachable` / `fetch-arxiv proxy unreachable`: the page couldn't reach the local arXiv proxy route.
- `Hallucination check failed:` or `Hallucination check returned a non-JSON body`: non-fatal; the briefing still renders, and Generation details says the check did not run.

Stage progress (fetching, batches, retries, skipped papers) goes to the activity log in the Pipeline view rather than the console.

Worth worrying about:

- Red network-tab entries for `/api/*` with 500 status.
- `Uncaught (in promise) Error:` not prefixed with `Operation aborted` (aborts are expected when you click Stop).

### Terminal output

The backend logs show up in the terminal running `npm run dev`.

Per-request LLM dispatch:

- `Sending request to Anthropic: { model, promptLength, structured, cacheable?, hasPdf? }` — every LLM call logs a dispatch line.
- `[anthropic cache] read=N create=N` — Anthropic prompt-cache metrics. `read > 0` on calls 2+ means caching is working. `read=0 create=N` on every call means caching is broken — check that the `cachePrefix + prompt === fullRendered` invariant holds in the calling route.
- `[openai cache] read=N` — OpenAI automatic prefix-cache hits (no code changes needed to enable).

Per-route logs:

- `Proxying OAI-PMH request: <url>`: every OAI-PMH page (the primary path). `Proxying arXiv request: <query>` is the same for the Atom fallback.
- `OAI 429 retry-after=X` / `arXiv 429, Retry-After: X` (or a 5xx status): arXiv rate-limited or failed upstream, with the server's backoff value. Both trigger the same 5 / 15 / 45-second client retry ladder.
- `Downloading PDF from: <url>`, then `PDF downloaded via direct fetch: { ... }`: per-paper PDF download.
- `Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...` and `PDF downloaded via Playwright: <bytes> bytes`: the reCAPTCHA fallback. Expected occasionally; not an error.
- `[anthropic] API error 429` / `[openai] API error 400` / `[google] API error 503`: the raw provider error body. In the activity log, a 429 or 503 shows as `<provider>: rate limited (<status>)` and other statuses show the provider's error text.
- `Initial PDF analysis response validation failed: [<errors>]` (and the matching filter, scoring, and rescore lines): the route's one backend correction call was triggered. If the corrected response also fails, the route returns a 502 (`PDF analysis validation failed after correction`) and the client retries the request up to `maxRetries` times (default 4).

Useful greps when debugging (pipe the dev server into a file: `npm run dev 2>&1 | tee run.log`):

```bash
grep "API error"           # every provider error
grep "429"                 # all rate-limit events
grep "validation failed"   # every correction-path trigger
grep "Playwright"          # reCAPTCHA fallback activity
grep "cache] read"         # cache effectiveness
grep "=== .* SUMMARY"      # stage transitions
```

### What a healthy run looks like

Rough order for a standard run on a single provider, with the terminal and the browser console read side by side:

1. `Proxying OAI-PMH request:` once per top-level group and results page (or `Proxying arXiv request:` once per category on the Atom fallback).
2. `Sending request to <Provider>: { ..., cacheable: true }` × filter batches.
3. `[anthropic cache] read=<big number>` from call 2 onward — cache is warming.
4. `=== FILTER SUMMARY ===` with YES / MAYBE / NO counts.
5. `Sending request to <Provider>:` × scoring batches, then `=== SCORING SUMMARY ===`.
6. `Downloading PDF from:` + `PDF downloaded via direct fetch:` for most papers; the occasional Playwright fallback is normal.
7. `=== SELECTION SUMMARY ===`.
8. `Sending request to <Provider>:` × PDF-analysis calls (one per selected paper).
9. `Sending request to <Provider>:` × quick-summary fan-out (5 at a time by default).
10. `Sending request to <Provider>:` — synthesize.
11. `Sending request to <Provider>:` — check-briefing (audit).
12. Optional: `Sending request to <Provider>:` × 2 — retry synthesis + recheck, if the audit flagged and retry is enabled.

Red flags:

- `[anthropic cache] read=0` on calls 2, 3, 4 — caching broken, check the route's cache-prefix split.
- `API error 429` repeating on the same provider — back off or switch provider.
- `validation failed` on more than ~10% of calls — the model is struggling; upgrade the slot.

---

## Where to file an issue

[GitHub issues → joshspeagle/aparture](https://github.com/joshspeagle/aparture/issues)

Include:

- Your platform (macOS, Linux, Windows native, WSL2) and Node version (`node -v`).
- The full terminal output of the failing run (redact API keys).
- The relevant browser-console block if the error surfaced in the UI.
- What you were trying to do and what happened instead.

---

_Snapshot taken 2026-04-19. Provider error-code tables reflect Anthropic, OpenAI, and Google documentation as of that date. Rate-limit specifics and free-tier quotas may have shifted since._
