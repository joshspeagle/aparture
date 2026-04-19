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

| Symptom                                                            | Likely cause                                                      | Jump to                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm install` fails with `gyp ERR!` or `EACCES`                    | Node version mismatch, missing build deps, or sudo install        | [npm install failures](#npm-install-failures)                             |
| `npx playwright install chromium` hangs or fails                   | Disk space, missing system libs, or Apple Silicon without Rosetta | [Playwright install failures](#playwright-install-failures)               |
| `Error: listen EADDRINUSE :::3000`                                 | Port 3000 already in use                                          | [Port 3000 already in use](#port-3000-already-in-use)                     |
| Every API call returns `401 Invalid password`                      | `ACCESS_PASSWORD` mismatch, trailing whitespace, or CRLF          | [ACCESS_PASSWORD mismatch](#access_password-mismatch)                     |
| `.env.local` edits don't appear to take effect                     | Dev server cached old values at startup                           | [`.env.local` not loading](#env-local-not-loading)                        |
| `missing credentials` or provider `401`                            | API key env var unset, or wrong prefix pasted                     | [API key format issues](#api-key-format-issues)                           |
| `arXiv rate limit: exhausted 3 retries`                            | ArXiv's 3s-per-request cap was tripped                            | [arXiv rate limits](#arxiv-rate-limits)                                   |
| `Failed to download PDF: HTTP 403` / `reCAPTCHA detected`          | ArXiv served reCAPTCHA HTML instead of PDF bytes                  | [reCAPTCHA on PDF downloads](#recaptcha-on-pdf-downloads)                 |
| End-of-run notice: "N papers skipped deep analysis due to reCAPTCHA" | Playwright not installed; fallback unavailable                  | [reCAPTCHA without Playwright](#recaptcha-without-playwright)             |
| `Filter/Score/PDF API error: 429`                                  | Provider rate-limit                                               | [Provider rate limits](#provider-rate-limits)                             |
| `context_length_exceeded` / `FAILED_PRECONDITION`                  | Prompt + content exceeded the model's context window              | [Context overflow](#context-overflow)                                     |
| Costs are higher than expected mid-run                             | Expensive model, large batches, or runaway correction loops       | [Cost spike mid-run](#cost-spike-mid-run)                                 |
| Pipeline frozen for > 5 minutes                                    | Hung network request, unrecognised pause, or orphaned browser tab | [Stuck stage](#stuck-stage)                                               |
| `Briefing generation failed: synthesis failed`                     | Schema validation + repair both failed                            | [Briefing schema-validation failure](#briefing-schema-validation-failure) |
| Briefing renders with a `YES` hallucination badge                  | Audit flagged claims; retry disabled or also flagged              | [Hallucination-retry loop](#hallucination-retry-loop)                     |
| Briefing retries repeatedly and still fails                        | By design — at most one retry per briefing                        | [Hallucination-retry loop](#hallucination-retry-loop)                     |

---

## Install-time issues

### Node version too old

Next.js 14 requires Node 18.17+, but Node 18 is end-of-life and Node 20 hits EOL at the end of April 2026. Use Node 22 LTS unless you have a reason not to.

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

### Playwright install failures

`npx playwright install chromium` downloads a ~300 MB browser. Common failures:

**Not enough disk space.** Chromium lands in `~/.cache/ms-playwright/` on macOS and Linux, `%USERPROFILE%\AppData\Local\ms-playwright\` on Windows.

**Missing system libraries (Linux only).** Chromium needs `libnss3`, `libatk-bridge2.0-0`, `libxcomposite1`, and friends:

```bash
npx playwright install-deps chromium
```

This uses sudo to install everything Chromium needs. macOS and Windows don't need this step.

**Apple Silicon hangs.** Check that Rosetta is installed:

```bash
softwareupdate --install-rosetta --agree-to-license
```

Then retry the Playwright install.

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

### `.env.local` not loading

Edits to `.env.local` often don't hot-reload on Next.js 14. The dev server reads the file once at startup and keeps the values cached; edits go unnoticed until restart.

::: warning Always restart after editing `.env.local`
Ctrl-C in the terminal running `npm run dev`, then re-run. Env-file hot-reload is unreliable on Next 14.
:::

Location rules:

- Must live at the project root, next to `package.json`. Not inside a subdirectory.
- Must be named `.env.local` exactly — not `.env`, not `.env.development`, not `.env.prod`.
- Must be UTF-8 without BOM, LF line endings, no quotes around values. See [Environment → File format rules](/reference/environment#file-format-rules).

Quick diagnostic — does the file actually parse?

```bash
# From the project root
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.CLAUDE_API_KEY?.slice(0, 10))"
```

If this prints the first 10 characters of your key, the file is readable. If it prints `undefined`, the file is in the wrong place, misnamed, or doesn't contain the variable.

### ACCESS_PASSWORD mismatch

Every API call returns `401 Invalid password`, typically right after entering the password on the login screen.

Common causes:

1. **Trailing whitespace.** `ACCESS_PASSWORD=correct-horse ` with a trailing space does not equal `correct-horse`. Open `.env.local` in an editor that shows invisible characters and trim.
2. **CRLF line endings on Windows.** A `\r` at end-of-line leaks into the password value — `ACCESS_PASSWORD=correct-horse\r` breaks comparison silently. Configure your editor to save `.env*` files as LF.
3. **BOM at the top of the file.** Windows Notepad's default UTF-8 save adds one. Use VS Code with UTF-8 (no BOM).
4. **Case sensitivity.** `Correct-Horse` is not the same as `correct-horse`.
5. **Dev server cached the old value.** Browser-side password storage updated, server-side didn't. Restart `npm run dev`.

### API key format issues

A request gets past `ACCESS_PASSWORD` but you see `missing credentials` or a provider `401`. The env var for the route's provider is probably unset or malformed.

Expected prefixes:

| Provider  | Env var             | Prefix                      |
| --------- | ------------------- | --------------------------- |
| Anthropic | `CLAUDE_API_KEY`    | `sk-ant-api03-...`          |
| OpenAI    | `OPENAI_API_KEY`    | `sk-proj-...` or `sk-...`   |
| Google    | `GOOGLE_AI_API_KEY` | `AIzaSy...`                 |

A wrong prefix usually means you pasted the wrong kind of secret — a Google OAuth token instead of an AI Studio key, for example. See the per-provider pages: [Anthropic](/getting-started/api-keys-anthropic) · [OpenAI](/getting-started/api-keys-openai) · [Google](/getting-started/api-keys-google).

If the prefix looks right but the key still fails, run the [Minimal API Test](/getting-started/verify-setup#minimal-api-test). Its error message is usually more specific than the generic `401`.

---

## Mid-run issues

### arXiv rate limits

```
arXiv rate limit: exhausted 3 retries
```

ArXiv caps metadata fetches at roughly one request per 3 seconds across all clients on your IP. Parallelising across categories doesn't help — the fetch path already serialises at that rate.

You'll hit this when:

- You ran two Aparture runs concurrently (two tabs, or a CLI run alongside a web run).
- You selected many categories and the serialised fetch exhausted the 5 / 15 / 45-second retry ladder.
- ArXiv is rate-limiting your IP from other traffic.

Wait five minutes or so, then rerun with fewer categories and no concurrent runs. Persistent 503s rather than 429s suggest arXiv-side maintenance — check [arxiv.org](https://arxiv.org) for announcements.

### reCAPTCHA on PDF downloads

ArXiv's PDF endpoint starts serving reCAPTCHA HTML after roughly 10–20 rapid downloads. Aparture detects this automatically (the response doesn't begin with `%PDF-`) and falls back to Playwright, which reuses a persistent cookie jar at `temp/playwright-profile/` to clear the challenge.

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

The papers aren't lost — they stay in the briefing ranked by their abstract score, with a note that deep analysis was unavailable. To enable deep analysis on them, install Playwright and rerun:

```bash
npx playwright install chromium
```

See [Install → Playwright](/getting-started/install#_4-playwright-optional-fallback-for-recaptcha) for the full recipe.

### Provider rate limits

Each provider has several flavours of 429, each with its own fix.

**Anthropic 429** (`anthropic request failed (429)`).

- _Input/output token limit_ — you burned through the tokens-per-minute cap. Wait 60 seconds, reduce `filterBatchSize` or `scoringBatchSize`, or move to a higher tier.
- _Requests-per-minute_ — fewer, larger calls help; increase batch sizes.
- _Acceleration limit_ — Anthropic throttles sharp usage spikes. Ramp up slowly, small runs before large ones.

**OpenAI 429** (`openai request failed (429)`).

- _"Rate limit reached for requests"_ — transient. Aparture's client-side retry loop handles this automatically up to 3 times.
- _"You exceeded your current quota"_ — billing issue, not transient. Check usage limits and billing status at [platform.openai.com](https://platform.openai.com).

Free-tier OpenAI accounts (approximately 3 RPM on GPT-5.4-class models) will 429 on almost any real run. Move to a paid tier before attempting more than the Minimal API Test.

**Google 429** (`google request failed (429)` with `RESOURCE_EXHAUSTED`). The error body names the exhausted quota. Google's free tier is 60 RPM across all models per API key — the default pipeline (filter batches + scoring + PDF analysis + quick-summary fan-out) can exceed this on a medium run. Enable quick-filter to reduce downstream calls, reduce batch sizes, or move to a paid tier.

**429 specifically during Stage 3 (PDF analysis).** Aparture runs PDF analyses in parallel with a default concurrency of 3 (`pdfAnalysisConcurrency`). If 429s land on PDF calls specifically, drop Settings → Parallel PDF analyses from 3 to 2 or 1. If your tier is generous and the stage feels slow, you can raise it up to 20.

**429 during briefing prep (quick-summary fan-out).** The briefing stage fans out quick-summary calls with default concurrency 5 (`quickSummaryConcurrency`). If 429s land there, drop Settings → Parallel calls in the Briefing section.

### Context overflow

```
... context_length_exceeded ...
... FAILED_PRECONDITION ...
```

Prompt + content exceeded the model's context window. Most common on Stage 3 PDF analysis with large papers and a small-context model.

Switch `pdfModel` in Settings to a larger-context model:

- Claude Opus 4.x / Sonnet 4.x (1M context)
- Gemini 3.1 Pro (2M context)
- GPT-5.4 (1M context)

For other stages, also reduce `scoringBatchSize` (default 3) and shorten your profile if it runs to multiple paragraphs of prose.

### Cost spike mid-run

Aparture doesn't yet surface real-time spend. To check during a run:

- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) → Usage.
- **OpenAI:** [platform.openai.com/usage](https://platform.openai.com/usage).
- **Google:** [aistudio.google.com](https://aistudio.google.com) for free tier, `console.cloud.google.com` for paid.

Common drivers:

- **Correction loops.** A malformed-JSON response can trigger up to 12 LLM calls per batch in the worst case (2 backend corrections × 3 client retries × 2 extra backend calls). Repeated `validation failed` in the terminal suggests the model is struggling — switch to a stronger slot for that stage.
- **Premium model on Stage 3.** Claude Opus on 100 PDFs is expensive. [Model selection](/concepts/model-selection) has cheaper per-stage configs.
- **Deep analysis on too many papers.** Lower `maxDeepAnalysis` (default 30).

### Stuck stage

The pipeline appears frozen for more than 5 minutes with no terminal output.

**First, check whether you're at a review gate.** The Pause after filter and Pause before briefing checkboxes (both on by default) stop the pipeline and wait for you to continue. The UI shows a pause banner; the terminal goes quiet. Click Continue to proceed, or see [Review gates](/using/review-gates) for the gate UX.

**If not paused:** open browser devtools → Network tab. Look for a pending request to `/api/*`:

- `/api/synthesize` pending > 5 min — the briefing model hung. Rare; 1M-context Anthropic requests have a 10-minute TCP timeout. Refresh and retry with a smaller `maxDeepAnalysis` or a different `briefingModel`.
- `/api/analyze-pdf` pending > 2 min — likely Playwright hung on a reCAPTCHA challenge. Check that `temp/playwright-profile/` isn't corrupted; delete it and rerun if so.
- No pending request — the pipeline may have crashed silently. Check the terminal for an exception trace; if none, reload the page.

---

## Briefing-time issues

### Briefing schema-validation failure

```
Briefing generation failed: synthesis failed
```

The synthesis response didn't match the briefing schema, and the repair pass (a second LLM call showing the validation errors) also failed. The UI surfaces a red banner.

What to check:

1. Open browser devtools → Network → click the failed `synthesize` request.
2. Look at the response body's `details` field — it contains the zod validation errors.
3. Common errors:
   - `arxivId not in input list` — the model cited a paper that wasn't in the input. Not fixable via retry; the model is confused. Switch `briefingModel` to a stronger option.
   - `required field missing` — the model returned a partial object. Retry usually works.
   - `model did not return structured output` — the provider silently fell back to plain text. Seen occasionally with Google on complex schemas. Switch to Anthropic or OpenAI for `briefingModel`.

**Token budget block.** Occasionally you'll see `synthesis prompt exceeds token budget` (400). The estimated token count is above the configured threshold. Shorten your profile, reduce `maxDeepAnalysis`, or pass `allowOverBudget: true` (not currently exposed in the UI — requires editing the request).

### Hallucination-retry loop

After synthesis, Aparture runs a separate LLM call that audits the briefing against the source papers. Each briefing displays a hallucination badge in the Generation details expandable section: `NO` (clean), `MAYBE` (uncertain), or `YES` (flagged).

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

Open devtools (F12 or Cmd-Option-I) → Console. During a run, useful prefixes:

- `Fetching papers for N categories:` — fetch stage entered.
- `  Query: (cat:astro-ph.*) AND submittedDate:[... TO ...]` — arXiv query, per category, indented.
- `=== FILTER SUMMARY ===` / `=== SCORING SUMMARY ===` / `=== POST-PROCESSING SUMMARY ===` / `=== SELECTION SUMMARY ===` — end-of-stage summaries with counts.
- `Downloading PDF from: <url>` — per paper.
- `PDF downloaded via direct fetch: { sizeBytes: N, sizeKB: X }` — direct-fetch success.
- `Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...` — expected occasionally; not an error.
- `PDF downloaded via Playwright: <bytes> bytes` — Playwright-fallback success.
- `[Phase 1.5.1] Hallucination check failed:` — non-fatal; briefing still renders without a badge.

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

- `Proxying arXiv request: <query>` — every arXiv metadata fetch.
- `arXiv rate-limited (429), Retry-After: X` — rate limit with the server's backoff value.
- `[anthropic] API error 429` / `[openai] API error 400` / `[google] API error 503` — raw provider error (server-side only; the browser sees a sanitised `<provider> request failed (<status>)`).
- `Initial PDF analysis response validation failed: [<errors>]` — backend correction pass triggered.
- `PDF analysis response still invalid after correction: [<errors>]` — backend correction failed; the client has 3 more retries.

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

Rough order for a standard run on a single provider:

1. `Proxying arXiv request:` × N (one per selected category).
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

_Snapshot taken 2026-04-18. Provider error-code tables reflect Anthropic, OpenAI, and Google documentation as of that date. Rate-limit specifics and free-tier quotas may have shifted since._
