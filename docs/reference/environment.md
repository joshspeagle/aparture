# Environment variables

Aparture reads its authentication secrets and runtime configuration flags from `.env.local` in the repository root. This file is gitignored; if you have not created it yet, follow the steps in [Install](/getting-started/install).

For standard local use, you configure `ACCESS_PASSWORD` and at least one provider API key (`CLAUDE_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_AI_API_KEY`), alongside optional runtime settings (`PORT`, `NODE_ENV`, `ARXIV_CONTACT_EMAIL`, and `APARTURE_REPORTS_DIR`). The table below also documents test-only overrides used by the automated Vitest suite.

```bash
# .env.local (gitignored, repository root)
ACCESS_PASSWORD=change-me
CLAUDE_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=

# Optional
# PORT=3001
# ARXIV_CONTACT_EMAIL=you@example.edu
```

::: warning Restart after editing
Next.js reads `.env.local` once when the development server starts. Whenever you edit `.env.local` while `npm run dev` is running, stop the server (`Ctrl-C`) and start it again so the new values take effect.
:::

## Quick reference

| Variable                                | Required                  | Read by                                                                                         | Default                                  |
| --------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `ACCESS_PASSWORD`                       | Yes                       | Every route in `pages/api/`                                                                     | None (unset causes every request to 401) |
| `CLAUDE_API_KEY`                        | At least one of the three | All LLM-calling routes, via the shared `lib/llm/resolveRouteAuth.js` helper                     | Anthropic models unavailable if unset    |
| `OPENAI_API_KEY`                        | At least one of the three | All LLM-calling routes, via the shared `lib/llm/resolveRouteAuth.js` helper                     | OpenAI models unavailable if unset       |
| `GOOGLE_AI_API_KEY`                     | At least one of the three | All LLM-calling routes, via the shared `lib/llm/resolveRouteAuth.js` helper                     | Google models unavailable if unset       |
| `PORT`                                  | No                        | Next.js CLI (not read from source)                                                              | `3000`                                   |
| `NODE_ENV`                              | No                        | `lib/llm/resolveCallModelMode.js` · `pages/api/analyze-pdf.js` (test gates)                     | `development` (set by Next)              |
| `ARXIV_CONTACT_EMAIL`                   | No                        | `pages/api/harvest-arxiv.js` · `fetch-arxiv.js` · `bin/aparture.mjs`                            | Unset (no `From` header sent)            |
| `APARTURE_REPORTS_DIR`                  | No                        | `lib/persistence/coldStore.js` · `pages/api/{briefings,sessions}/*.js` · `lib/figures/store.js` | `<cwd>/reports`                          |
| `APARTURE_TEST_PROMPT_OVERRIDE`         | Test only                 | Most LLM-calling routes · `lib/llm/loadRubricPrompt.js`                                         | Unset                                    |
| `APARTURE_TEST_PDF_OVERRIDE`            | Test only                 | `lib/llm/callModel.js`                                                                          | Unset                                    |
| `APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE` | Test only                 | `pages/api/suggest-profile.js`                                                                  | Unset                                    |
| `APARTURE_TEST_CHECK_PROMPT_OVERRIDE`   | Test only                 | `pages/api/check-briefing.js`                                                                   | Unset                                    |

## Required

### `ACCESS_PASSWORD`

`ACCESS_PASSWORD` gates every API route in the application. The web UI sends this password in the `password` field of the JSON request body on `POST` and `PATCH` calls, and in the percent-encoded `x-aparture-password` HTTP header on `GET` and `DELETE` calls (keeping the password out of URL query strings so it never appears in server logs or browser history). Each route compares the supplied value against `process.env.ACCESS_PASSWORD` in constant time and returns `401 Invalid password` on a mismatch. The check fails closed: when `ACCESS_PASSWORD` is unset or empty, every request is rejected. The server never sends `ACCESS_PASSWORD` to the browser; the client stores only what the user entered at login.

```bash
ACCESS_PASSWORD=correct-horse-battery-staple
```

A random passphrase of 12 or more characters is well suited for a single-user local or LAN deployment. Because `npm run dev` and `npm start` bind to `127.0.0.1` by default, only the local machine can reach the server unless you pass `npm run dev -- -H 0.0.0.0` to listen on your local network. Do not expose the server directly to the public internet without an external authentication proxy.

When the headless runner (`node bin/aparture.mjs`, documented in [Running as an agent skill](/add-ons/agent-skill)) invokes the arXiv proxy routes in-process and `ACCESS_PASSWORD` is unset, it generates a random in-memory password for its own process automatically.

## API keys (at least one required)

You must configure at least one LLM provider key, and you can set keys for multiple providers to mix models across pipeline stages (for example, pairing Google Gemini or Anthropic Haiku on filtering with Anthropic Opus or OpenAI GPT-6.1 Sol on PDF analysis and briefing synthesis).

Each API route resolves the key for its selected model's provider at request time; if a stage is assigned to a provider whose key is unset, that stage fails when called.

API routes also accept a client-supplied provider key in the `apiKey` request body field in place of `password` to support the planned Phase 2 desktop application. Because `/api/analyze-pdf` downloads the manuscript PDF before calling the LLM, a client-supplied `apiKey` on that route must match its provider's published prefix shape (`sk-ant-...` for Anthropic, `sk-...` for OpenAI, or `AIza...` for Google) if `password` is not used.

### `CLAUDE_API_KEY`

Anthropic (Claude) API key, prefixed with `sk-ant-api03-`, used whenever a pipeline slot is set to a Claude model. See [Anthropic setup](/getting-started/api-keys-anthropic) for account creation and billing details.

```bash
CLAUDE_API_KEY=sk-ant-api03-...
```

### `OPENAI_API_KEY`

OpenAI (GPT) API key, prefixed with `sk-proj-` for project keys (or `sk-` for legacy user keys), used whenever a pipeline slot is set to an OpenAI model. See [OpenAI setup](/getting-started/api-keys-openai).

```bash
OPENAI_API_KEY=sk-proj-...
```

### `GOOGLE_AI_API_KEY`

Google AI Studio (Gemini) API key, used whenever a pipeline slot is set to a Gemini model. Legacy standard keys start with `AIza` and must be restricted to the Gemini API, while auth keys created in AI Studio since 2026-05-28 work as issued. The variable name is `GOOGLE_AI_API_KEY` (not `GEMINI_API_KEY` or `GOOGLE_API_KEY`). See [Google setup](/getting-started/api-keys-google).

```bash
GOOGLE_AI_API_KEY=your-gemini-api-key
```

## Optional

### `PORT`

Sets the HTTP port for `npm run dev` when port `3000` is already in use by another process. `PORT` is read directly by the Next.js CLI and requires a server restart when changed:

```bash
PORT=3001
```

### `NODE_ENV`

Set automatically by `next dev` (`development`), `next start` (`production`), and `vitest` (`test`), so you do not need to set it in `.env.local`. In source code, `NODE_ENV === 'test'` gates two test-only behaviors: `pages/api/analyze-pdf.js` honors the `_testPdfBase64` request body field to bypass live arXiv downloads, and `lib/llm/resolveCallModelMode.js` honors client-requested fixture mode. In `development` and `production`, both test paths are ignored and all LLM calls execute live.

### `ARXIV_CONTACT_EMAIL`

Contact email address sent in the HTTP `From` header on every request to arXiv across the OAI-PMH proxy (`pages/api/harvest-arxiv.js`), the Atom proxy (`pages/api/fetch-arxiv.js`), and the headless runner (`bin/aparture.mjs`). arXiv's API documentation asks automated clients to include a contact address so operations staff can reach the maintainer if traffic patterns cause issues, and arXiv's rate-limit heuristics treat identified clients (especially institutional `.edu` and `.ac.*` addresses) more leniently than anonymous traffic. When `ARXIV_CONTACT_EMAIL` is unset, requests omit the `From` header:

```bash
ARXIV_CONTACT_EMAIL=you@example.edu
```

### `APARTURE_REPORTS_DIR`

Base directory on disk for cold runtime persistence across briefings, cropped figures, and analyzer sessions:

- **Briefings:** Saved to `<APARTURE_REPORTS_DIR>/briefings/<id>.json`.
- **Key figures:** Cropped images are written to `<APARTURE_REPORTS_DIR>/figures/<arxivId>.png` alongside label and caption metadata in `<arxivId>.json`.
- **Analyzer sessions:** Full session state (`allPapers`, `scoredPapers`, and filter verdicts) is saved to `<APARTURE_REPORTS_DIR>/sessions/<sessionId>.json`, while browser `localStorage` retains a compact summary under ~600 KB.

When unset, `APARTURE_REPORTS_DIR` defaults to `<cwd>/reports`:

```bash
# .env.local (optional custom storage path)
APARTURE_REPORTS_DIR=/path/to/alternate/reports
```

In tests, Vitest points `APARTURE_REPORTS_DIR` at a temporary directory so integration tests do not write to the repository's `reports/` folder; in the planned desktop application, it points to `~/aparture/`.

## Test-only overrides

::: danger Do not set these in a real dev environment
The variables below exist exclusively so the Vitest integration suite can compute deterministic fixture hashes. Setting them in `.env.local` substitutes stub strings into live prompts.
:::

### `APARTURE_TEST_PROMPT_OVERRIDE`

Replaces the variable tail of each LLM prompt with this literal string prior to hashing so fixture keys remain deterministic across test runs, and disables Anthropic prompt caching (`cachePrefix` and `cacheable` are omitted) so fixture behavior does not depend on cache state.

This variable is read by `pages/api/synthesize.js`, `score-abstracts.js`, `rescore-abstracts.js`, `quick-filter.js`, `analyze-pdf.js`, `analyze-pdf-quick.js`, `generate-notebooklm.js`, `editor-questions.js`, and `lib/llm/loadRubricPrompt.js` during `tests/integration/` runs.

### `APARTURE_TEST_PDF_OVERRIDE`

Replaces the `pdfBase64` field in LLM requests with a literal string before hashing so fixture keys are decoupled from PDF byte contents. Read by `lib/llm/callModel.js` and used by `tests/integration/analyze-pdf.test.js`.

### `APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE`

Prompt-override variant scoped to `pages/api/suggest-profile.js`, which uses its own prompt structure.

### `APARTURE_TEST_CHECK_PROMPT_OVERRIDE`

Prompt-override variant scoped to `pages/api/check-briefing.js`.

### `_testPdfBase64` (request body field, not env var)

A JSON request body field on `POST /api/analyze-pdf` that is honored only when `NODE_ENV === 'test'`. When present in test mode, the route uses the supplied base64 PDF bytes directly and skips the live arXiv HTTP fetch, Playwright fallback, and reCAPTCHA handling (`tests/integration/analyze-pdf.test.js` passes `tests/fixtures/pdf/minimal.pdf` via this field).

## File format rules

Follow these formatting rules when editing `.env.local` to avoid parsing errors:

- **UTF-8 encoding without BOM:** Windows Notepad's default `"Save As UTF-8"` prepends a byte-order mark that corrupts the first variable name; save `.env.local` using VS Code or another editor set to UTF-8 without BOM.
- **LF line endings:** Windows CRLF (`\r\n`) line endings can leave a trailing `\r` character attached to a password or API key, causing `401 Invalid password` or provider authentication errors; configure your editor to save `.env*` files with LF (`\n`) line endings.
- **Unquoted values:** Write `KEY=value` without surrounding quotes, because some environment parsers include quote characters as part of the value.
- **Comments at column 0:** Place `# comment` lines on their own line starting at column 0, because inline comments (`KEY=value # note`) are parsed as part of the value string.
- **One variable per line:** Keep every key-value assignment on a single line.

## Security

- `.env.local` is gitignored by default; you can verify that Git ignores it by running `git check-ignore .env.local` (which prints `.env.local` when properly ignored).
- Provider API keys remain exclusively on the server: all LLM requests execute inside `pages/api/*` backend routes, and keys are never sent to the browser.
- If you ever commit an API key to a Git repository by mistake, revoke and rotate the key immediately in the provider's console because committed secrets persist in Git reflogs and history.

## See also

- [API keys hub](/getting-started/api-keys): Provider comparison and cost estimates.
- [Install](/getting-started/install): Node.js installation and creating `.env.local`.
- [Verify setup](/getting-started/verify-setup): Zero-cost and end-to-end setup checks.
- [Running as an agent skill](/add-ons/agent-skill): Headless execution via `SKILL.md`, `node bin/aparture.mjs`, and `$APARTURE_STATE`.
- [Troubleshooting](/reference/troubleshooting): Diagnosing `.env.local` and authentication errors.
