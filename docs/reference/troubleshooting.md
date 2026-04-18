# Troubleshooting

Most Aparture problems fall into one of four buckets depending on when they show up: install-time, first-launch, mid-run, or briefing-time. This page walks through each in order, with a master symptom table at the top for quick jumps.

If your symptom isn't here, [file an issue](https://github.com/joshspeagle/aparture/issues) with the relevant terminal + browser-console output.

## Master symptom table

| Symptom                                                            | Likely cause                                                          | Jump to                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm install` fails with `gyp ERR!` or `EACCES`                    | Node version mismatch or missing build deps                           | [Install-time issues](#install-time-issues)                               |
| `npx playwright install chromium` hangs or fails                   | Disk space, system deps, or Apple Silicon / Rosetta                   | [Playwright install failures](#playwright-install-failures)               |
| `Error: listen EADDRINUSE :::3000`                                 | Port 3000 already in use                                              | [Port 3000 already in use](#port-3000-already-in-use)                     |
| Every API call returns `401 Invalid password`                      | `ACCESS_PASSWORD` mismatch, trailing whitespace, or CRLF line endings | [ACCESS_PASSWORD mismatch](#access_password-mismatch)                     |
| `.env.local` edits "don't take effect"                             | Dev server cached old values at startup; needs restart                | [`.env.local` not loading](#env-local-not-loading)                        |
| `401` / `missing credentials` from any route                       | API key env var not set, or key format wrong                          | [API key format issues](#api-key-format-issues)                           |
| `arXiv rate limit: exhausted 3 retries`                            | arXiv's ≥3s-per-request cap was tripped                               | [arXiv rate limits](#arxiv-rate-limits)                                   |
| `Failed to download PDF: HTTP 403` / `reCAPTCHA detected`          | arXiv served reCAPTCHA HTML instead of a PDF                          | [reCAPTCHA on PDF downloads](#recaptcha-on-pdf-downloads)                 |
| End-of-run card: "N papers skipped deep analysis due to reCAPTCHA" | Playwright not installed; fallback unavailable                        | [reCAPTCHA without Playwright](#recaptcha-without-playwright)             |
| `Filter/Score/PDF API error: 429 - ...`                            | Provider rate-limit                                                   | [Provider rate limits](#provider-rate-limits)                             |
| `... context_length_exceeded ...`                                  | Prompt + paper content exceeds model context                          | [Context overflow](#context-overflow)                                     |
| Costs are higher than expected mid-run                             | Expensive model, large batches, or runaway correction loops           | [Cost spike mid-run](#cost-spike-mid-run)                                 |
| Pipeline stuck at one stage for > 5 minutes                        | Hung network request, paused gate, or orphaned browser tab            | [Stuck stage](#stuck-stage)                                               |
| `Briefing generation failed: synthesis failed`                     | Schema validation + repair exhausted, or provider error               | [Briefing schema-validation failure](#briefing-schema-validation-failure) |
| Briefing renders but shows `YES` hallucination badge               | Audit flagged claims; retry disabled or also flagged                  | [Hallucination-retry loop](#hallucination-retry-loop)                     |
| Briefing retries repeatedly but never resolves                     | By design: only one retry per briefing                                | [Hallucination-retry loop](#hallucination-retry-loop)                     |

---

## Install-time issues

### Node version too old

Next.js 14 requires Node 18.17+, but Node 18 has been end-of-life since April 2025 and Node 20 reaches EOL at the end of April 2026. **Use Node 22 LTS** unless you have a reason not to.

Check what you have:

```bash
node -v   # should print v22.x.x
npm -v    # should print 10.x or 11.x
```

If `node -v` prints something older, install Node 22 via nvm (macOS/Linux/WSL2) or fnm (Windows native) — the full recipe is in [Install](/getting-started/install).

### npm install failures

**Permissions errors** (`EACCES`, "permission denied writing to `/usr/local/lib/node_modules`"): you probably installed Node via Homebrew without nvm, or you're running `sudo npm install -g` somewhere. Switch to nvm — its prefix lives under `~/.nvm/` and never needs sudo.

**Proxy / registry errors** (`ECONNRESET`, `ETIMEDOUT` on a corporate network): you may need to configure npm to go through your proxy.

```bash
npm config set proxy http://your-proxy:port
npm config set https-proxy http://your-proxy:port
# If your org runs its own registry, also:
npm config set registry https://your-registry/
```

**Corrupted cache** (random install failures that don't reproduce): clear the cache.

```bash
npm cache clean --force
rm -rf node_modules package-lock.json   # optional — force a fresh resolve
npm install
```

**Native-module build errors** (`gyp ERR!`, `not found: python`): node-gyp needs Python and a C++ toolchain for certain transitive dependencies.

- macOS: `xcode-select --install`; `brew install python@3.12`
- Linux: `sudo apt install -y build-essential` (or distro equivalent)
- Windows native: install the Visual Studio Build Tools (C++ workload)

### Playwright install failures

`npx playwright install chromium` downloads a ~300 MB browser. Common failures:

**Not enough disk space.** Chromium needs ~300 MB in `~/.cache/ms-playwright/` (or `%USERPROFILE%\AppData\Local\ms-playwright\` on Windows). Free up space and retry.

**Missing system libraries (Linux only).** Chromium needs `libnss3`, `libatk-bridge2.0-0`, `libxcomposite1`, and friends. Run:

```bash
npx playwright install-deps chromium
```

This uses sudo to install everything Chromium needs. macOS and Windows don't need this step.

**Apple Silicon hangs.** Check that Rosetta is installed:

```bash
softwareupdate --install-rosetta --agree-to-license
```

Then retry the Playwright install.

**Behind a corporate proxy.** Set the download host:

```bash
PLAYWRIGHT_DOWNLOAD_HOST=https://your-mirror npx playwright install chromium
```

**Playwright is optional.** If you skip it, Aparture will run fine — you just won't have the reCAPTCHA fallback for PDF downloads. Affected papers get a per-paper notice and are ranked by abstract only. See [Install](/getting-started/install) for the trade-off.

---

## First-launch issues

### Port 3000 already in use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Another `next dev` instance (or any other service) is already on port 3000.

**Find what's holding it:**

```bash
# macOS / Linux / WSL2
lsof -i :3000

# Windows PowerShell
netstat -ano | findstr :3000
```

**Fix:** either kill the other process, or set `PORT=3001` in `.env.local` and restart `npm run dev`. The port env var is also honored by most Next.js tooling.

### `.env.local` not loading

Edits to `.env.local` often _don't_ hot-reload on Next.js 14. The dev server reads the file once at startup and caches the values. You change `CLAUDE_API_KEY`, the change "doesn't take effect," and every request keeps using the old value silently.

**Always restart `npm run dev` after editing `.env.local`.** Ctrl-C in the terminal, then re-run.

Location rules:

- `.env.local` must live at the **project root** (next to `package.json`), not inside a subdirectory.
- Not `.env`, not `.env.development`, not `.env.prod` — specifically `.env.local`.
- File must be UTF-8 without BOM, LF line endings, no multi-line values.

Quick diagnostic — what does the file actually resolve to?

```bash
# From the project root
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.CLAUDE_API_KEY?.slice(0, 10))"
```

If this prints the first 10 characters of your key, the file is readable. If it prints `undefined`, the file is in the wrong place, misnamed, or the key isn't in it.

### ACCESS_PASSWORD mismatch

Every API call returns `401 Invalid password`, usually right after entering the password on the login screen.

**Common causes:**

1. **Trailing whitespace in `.env.local`.** `ACCESS_PASSWORD=correct-horse ` (note the trailing space) does not equal what you type into the browser. Open `.env.local` in an editor that shows invisible characters; trim.
2. **CRLF line endings on Windows.** A `\r` leaks into the end of the password value. `ACCESS_PASSWORD=correct-horse\r` breaks the comparison silently. Configure your editor to save `.env*` files as LF.
3. **BOM at the top of the file.** Windows Notepad adds one by default. Use VS Code and "Save with encoding → UTF-8" (no BOM).
4. **Case-sensitivity.** `Correct-Horse` ≠ `correct-horse`.
5. **You restarted the browser but not the dev server.** The dev server cached the old value. Restart `npm run dev`.

### API key format issues

If a request gets past `ACCESS_PASSWORD` but you see `missing credentials` or `401` from the provider route, the API key env var for the route's provider is probably unset or malformed.

Check the expected prefix for each provider:

| Provider  | Env var             | Prefix                      |
| --------- | ------------------- | --------------------------- |
| Anthropic | `CLAUDE_API_KEY`    | `sk-ant-api03-...`          |
| OpenAI    | `OPENAI_API_KEY`    | `sk-proj-...` (or `sk-...`) |
| Google    | `GOOGLE_AI_API_KEY` | `AIzaSy...`                 |

If the prefix is wrong, you probably pasted the wrong kind of secret (e.g. a Google OAuth token instead of an AI Studio key). See the per-provider pages: [Anthropic](/getting-started/api-keys-anthropic) · [OpenAI](/getting-started/api-keys-openai) · [Google](/getting-started/api-keys-google).

If the key looks right but still fails, verify it authenticates by running the [Minimal API Test](/getting-started/verify-setup#minimal-api-test) — its error message is usually more specific than the generic `401`.

---

## Mid-run issues

### arXiv rate limits

```
arXiv rate limit: exhausted 3 retries
```

arXiv caps metadata fetches at **one request per 3 seconds across all your machines**. The rate limit is endpoint-wide, so parallelizing across categories doesn't help — Aparture's fetch path already serializes with a 3-second delay.

You'll hit this when:

- You run two Aparture analyses concurrently (from two browser tabs, or from a CLI run alongside a web run).
- You selected many categories (the serialized fetch simply takes longer; three retries at 5/15/45 seconds isn't long enough).
- arXiv is rate-limiting your IP from other unrelated traffic.

**Fix:** wait ~5 minutes, then rerun with fewer categories. Don't run two analyses concurrently. If you see persistent 503s rather than 429s, check [arxiv.org](https://arxiv.org) for maintenance announcements.

### reCAPTCHA on PDF downloads

arXiv's PDF endpoint starts serving reCAPTCHA HTML after ~10-20 rapid downloads. Aparture detects this automatically (the response doesn't start with `%PDF-`) and falls back to a Playwright browser session, which uses a persistent cookie jar at `temp/playwright-profile/` to bypass the challenge.

**With Playwright installed.** The fallback fires transparently. In the terminal you'll see:

```
Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...
Attempting PDF download via Playwright (reCAPTCHA bypass)...
PDF downloaded via Playwright: 123456 bytes
```

The first call after a fresh `temp/playwright-profile/` may take 5-10 seconds while the browser launches and solves the challenge interactively. Subsequent calls reuse the profile and are fast.

**If Playwright itself is blocked.** Rare — usually means the persistent profile has been invalidated. Delete it and rerun:

```bash
rm -rf temp/playwright-profile/
npm run dev
```

The first PDF download will re-solve the challenge.

**Never delete `temp/notebooklm-profile/`** — that's a Google session for podcast generation, not arXiv. Losing it forces an interactive Google re-login.

### reCAPTCHA without Playwright

If Playwright isn't installed, the reCAPTCHA fallback can't run. Each affected paper surfaces a per-paper notice in the Progress Timeline:

> PDF for _Paper Title_ blocked by reCAPTCHA — install Playwright to enable fallback.

At the end of the run, a summary card appears below the results:

> 3 papers skipped deep analysis due to reCAPTCHA. Run `npx playwright install chromium` to enable the workaround.

The papers aren't lost — they stay in the briefing ranked by their abstract score, with a note that deep analysis was unavailable. If you want deep analysis on them, install Playwright and rerun:

```bash
npx playwright install chromium
```

See [Install → Playwright](/getting-started/install#playwright-optional) for the full recipe.

### Provider rate limits

Every provider has multiple flavors of rate limit, each with a different fix:

**Anthropic 429** (`anthropic request failed (429)`). Three sub-flavors:

- **Input/output token limit** — you burned through the tokens-per-minute cap. Wait 60 seconds, reduce `filterBatchSize` / `scoringBatchSize`, or switch to a higher-tier key.
- **Requests-per-minute** — fewer but longer calls would help; increase batch sizes so you make fewer requests.
- **Acceleration limit** — Anthropic throttles sharp usage spikes. Ramp up slowly with small runs before large ones.

**OpenAI 429** (`openai request failed (429)`). Two sub-flavors:

- **"Rate limit reached for requests"** — transient; back off and retry. Aparture's built-in retry loop handles this automatically up to 3 times.
- **"You exceeded your current quota"** — billing issue, not transient. Log into [platform.openai.com](https://platform.openai.com) and check usage limits + billing status.

Free-tier OpenAI accounts (~3 RPM on GPT-5.4-class) will 429 on almost any real Aparture run. Move to a paid tier before trying more than the Minimal API Test.

**Google 429** (`google request failed (429)` with `RESOURCE_EXHAUSTED`). The error body names the exhausted quota. Google's free tier is 60 RPM across all models per API key — Aparture's default pipeline (filter batches + scoring batches + PDF analysis + quick-summary fan-out) can easily exceed this on a medium run.

If you see persistent 429s on Google, enable the quick-filter stage (it reduces the number of downstream calls) or reduce batch sizes. For heavy daily use, move to a paid tier.

### Context overflow

```
... context_length_exceeded ...
... FAILED_PRECONDITION ...
```

Your prompt + paper content exceeded the model's context window. Most commonly happens with PDF analysis on large papers + a small-context model.

**Fix:** switch `pdfModel` (in Settings) to a larger-context model:

- Claude Opus / Sonnet 4.x (1M context)
- Gemini 3.1 Pro (2M context)
- GPT-5.4 (1M context)

For other stages, also reduce `scoringBatchSize` (default 3) and shorten your profile if it's multiple paragraphs.

### Cost spike mid-run

Aparture doesn't currently surface real-time spend. To check mid-run:

- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) → Usage tab.
- **OpenAI:** [platform.openai.com/usage](https://platform.openai.com/usage).
- **Google:** [aistudio.google.com](https://aistudio.google.com) → Billing (or console.cloud.google.com for paid tier).

If spend is higher than expected:

- **Correction loops.** A malformed-JSON response triggers up to 12 LLM calls per batch in the worst case (2 backend corrections × 3 client retries × 2 extra backend calls). If you see repeated `validation failed` in the terminal, switch to a stronger model.
- **Premium model on PDF analysis.** Claude Opus on 100 papers is expensive. See [Model selection](/concepts/model-selection) for cheaper per-stage configs.
- **Deep analysis on too many papers.** The `maxDeepAnalysis` config limits how many PDFs get full analysis. Lower it.

### Stuck stage

Pipeline appears frozen for > 5 minutes with no terminal output.

**First check — are you actually paused?** The review gates (Pause after filter, Pause before briefing) stop the pipeline and wait for you to click Continue. The UI shows a pause banner; the terminal goes quiet. If you're paused, click Continue (or open [Review gates](/using/review-gates) to learn the UX).

**If not paused:** open the browser devtools → Network tab. Look for a pending request to `/api/*`:

- `synthesize` pending > 5 min → the briefing model hung (rare, 1M-context Anthropic requests have a 10-min TCP timeout). Refresh the page and retry with a smaller `maxDeepAnalysis` or a different `briefingModel`.
- `analyze-pdf` pending > 2 min → likely Playwright hung. Check `temp/playwright-profile/` isn't corrupted (delete + rerun).
- No pending request → the pipeline may have crashed silently. Check the terminal for an exception trace; if none, reload the browser.

---

## Briefing-time issues

### Briefing schema-validation failure

```
Briefing generation failed: synthesis failed
```

The synthesis response didn't match the briefing schema, and the repair pass (a second LLM call showing the validation errors) also failed. You'll see this as a red banner in the UI.

**What to check:**

1. Open browser devtools → Network tab → click the failed `synthesize` request.
2. Look at the response body's `details` field. It will contain the zod validation errors.
3. Common errors:
   - `arxivId not in input list` — the model cited a paper that wasn't in the input. Not fixable via retry; the synthesis prompt or the model is confused. Switch `briefingModel` to a stronger one.
   - `required field missing` — model returned a partial object. Retry usually works.
   - `model did not return structured output` — the provider silently fell back to plain text. Seen with Google models on complex schemas. Switch to Anthropic or OpenAI for briefing.

**Token budget block.** Occasionally you'll see `synthesis prompt exceeds token budget` (400). This means the estimated token count is above the configured threshold. Shorten your profile, reduce `maxDeepAnalysis`, or pass `allowOverBudget: true` (not currently surfaced in the UI — requires editing the request).

### Hallucination-retry loop

After briefing synthesis, Aparture runs a separate LLM call to audit the briefing against the source papers. Each briefing shows a hallucination badge in the `GenerationDetails` disclosure: **YES** (flagged), **MAYBE** (uncertain), or **NO** (clean).

**What triggers a retry.** In Settings → Review & confirmation, you can enable "Retry on YES" and/or "Retry on MAYBE." If the audit verdict matches an enabled setting, Aparture calls synthesis a second time with a retry hint and re-runs the audit.

**Only one retry per briefing, ever.** This is deliberate — preventing infinite loops at the cost of allowing one stuck YES verdict to stand. If the retry also flags, you see the second briefing's audit result.

**When to accept a flagged briefing.** The audit surfaces specific claims in the `flaggedClaims` list. Click the disclosure and read them. If they're phrased cautiously, reflect a reasonable synthesis from the papers, or are just the model being conservative, the briefing is probably fine. If they're genuinely unsupported, switch `briefingModel` to a stronger one and rerun.

**When to change your prompt.** Persistent hallucinations across multiple briefings from the same `briefingModel` suggest the synthesis prompt needs tightening. Edit `prompts/synthesis.md` — changes take effect on the next call with no rebuild. See [Prompts](/reference/prompts).

---

## How to read the logs

Most signal lives in the terminal where `npm run dev` is running. The browser console also helps.

### Browser console (devtools)

Open devtools (F12 or Cmd-Option-I) → Console tab. During a run, search for these prefixes:

- `Fetching papers for N categories:` — fetch stage entered.
- `  Query: (cat:astro-ph.*) AND submittedDate:[... TO ...]` — the arXiv query being issued (per-category, indented 2 spaces).
- `=== FILTER SUMMARY ===` / `=== SCORING SUMMARY ===` / `=== POST-PROCESSING SUMMARY ===` / `=== SELECTION SUMMARY ===` — end-of-stage summaries with counts and percentages.
- `Downloading PDF from: <url>` — per-paper.
- `PDF downloaded via direct fetch: { sizeBytes: N, sizeKB: X }` — direct-fetch success path.
- `Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...` — expected occasionally, not an error.
- `PDF downloaded via Playwright: <bytes> bytes` — Playwright success path.
- `[Phase 1.5.1] Hallucination check failed:` — non-fatal audit-route failure (briefing still renders without a badge).

**Errors worth worrying about:**

- Red network-tab entries for `/api/*` routes with 500 status.
- `Uncaught (in promise) Error:` not prefixed with `Operation aborted` (aborts are expected when you click Stop).

### Terminal output

The terminal running `npm run dev` shows everything the backend logs.

**Per-request LLM dispatch:**

- `Sending request to Anthropic: { model, promptLength, structured, cacheable?, hasPdf? }` — every LLM call logs a dispatch line.
- `[anthropic cache] read=N create=N` — Anthropic prompt-cache metrics. `read > 0` on calls 2+ means caching is working. `read=0 create=N` on every call means caching is broken — check that the `cachePrefix + prompt === fullRendered` invariant holds.
- `[openai cache] read=N` — OpenAI automatic cache hits (OpenAI caches prefixes automatically; no code change needed).

**Per-route logs:**

- `Proxying arXiv request: <query>` — every arXiv metadata fetch.
- `arXiv rate-limited (429), Retry-After: X` — rate-limit with the server's backoff value.
- `[anthropic] API error 429: { ... }` / `[openai] API error 400: { ... }` / `[google] API error 503: { ... }` — raw provider error text (server-side only; the client sees a sanitized `<provider> request failed (<status>)`).
- `Initial PDF analysis response validation failed: [<errors>]` — correction pass triggered.
- `PDF analysis response still invalid after correction: [<errors>]` — backend correction failed; client still has 3 more retries.

**Useful greps when debugging:**

```bash
# In the terminal scrollback, or piping `npm run dev 2>&1 | tee run.log` to a file:
grep "API error"           # every provider error
grep "429"                 # all rate-limit events
grep "validation failed"   # every correction-path trigger
grep "Playwright"          # reCAPTCHA fallback activity
grep "cache] read"         # cache effectiveness
grep "=== .* SUMMARY"      # stage transitions
```

### What a healthy run looks like

In rough order for a standard run on Anthropic:

1. `Proxying arXiv request:` × N categories (one per selected category).
2. `Sending request to Anthropic: { ..., cacheable: true }` × filter batches.
3. `[anthropic cache] read=<big number>` from call 2 onward (cache warming).
4. `=== FILTER SUMMARY ===` with YES / MAYBE / NO counts.
5. `Sending request to ...:` × scoring batches.
6. `=== SCORING SUMMARY ===`.
7. `Downloading PDF from:` + `PDF downloaded via direct fetch:` for most papers; the occasional `Playwright fallback` is normal.
8. `=== SELECTION SUMMARY ===`.
9. `Sending request to ...:` × PDF analysis calls (one per paper).
10. `Sending request to ...:` × quick-summary fan-out (5 at a time).
11. `Sending request to ...:` — the synthesize call.
12. `Sending request to ...:` — the check-briefing (audit) call.
13. Optional: `Sending request to ...:` × 2 — retry synthesis + recheck, if the audit flagged and retry is enabled.

**Red flags:**

- `[anthropic cache] read=0` on calls 2, 3, 4 — caching broken.
- `API error 429` repeated on the same provider — back off or switch provider.
- `validation failed` on more than ~10% of calls — model is struggling; upgrade the model for that stage.

---

## Where to file an issue

[GitHub issues → joshspeagle/aparture](https://github.com/joshspeagle/aparture/issues)

Include:

- Your platform (macOS, Linux, Windows native, WSL2) and Node version (`node -v`).
- The full terminal output of the failing run (redact API keys!).
- The relevant browser-console block if the error surfaced in the UI.
- What you were trying to do and what happened instead.

---

_Snapshot taken 2026-04-17. Provider error tables reflect Anthropic, OpenAI, and Google documentation as of that date. Rate-limit specifics and free-tier quotas may have shifted since._
