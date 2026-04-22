# Environment variables

Aparture reads its secrets and a few runtime flags from `.env.local` at the repo root. The file is gitignored; if you don't have one yet, [Install](/getting-started/install) walks through creating it.

There are four variables you'll usually care about — one required password, three API keys (at least one required) — plus three optional ones (`PORT`, `NODE_ENV`, `ARXIV_CONTACT_EMAIL`) and a handful of test-only overrides that should never appear in a real dev file.

```bash
# .env.local — gitignored, project root
ACCESS_PASSWORD=change-me
CLAUDE_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=

# Optional
# PORT=3001
# ARXIV_CONTACT_EMAIL=you@example.edu
```

::: warning Restart after editing
Next.js reads `.env.local` once at dev-server startup. If you edit the file while `npm run dev` is running, the change usually won't take effect — stop the server (Ctrl-C) and re-run it.
:::

## Quick reference

| Variable                                | Required                  | Read by                                             | Default                               |
| --------------------------------------- | ------------------------- | --------------------------------------------------- | ------------------------------------- |
| `ACCESS_PASSWORD`                       | Yes                       | Every route in `pages/api/`                         | None — unset means every request 401s |
| `CLAUDE_API_KEY`                        | At least one of the three | All LLM-calling routes · `lib/llm/resolveApiKey.js` | Anthropic models unavailable if unset |
| `OPENAI_API_KEY`                        | At least one of the three | All LLM-calling routes · `lib/llm/resolveApiKey.js` | OpenAI models unavailable if unset    |
| `GOOGLE_AI_API_KEY`                     | At least one of the three | All LLM-calling routes · `lib/llm/resolveApiKey.js` | Google models unavailable if unset    |
| `PORT`                                  | No                        | Next.js CLI (not read from source)                  | `3000`                                |
| `NODE_ENV`                              | No                        | `pages/api/analyze-pdf.js` (test escape hatch)      | `development` (set by Next)           |
| `ARXIV_CONTACT_EMAIL`                   | No                        | `pages/api/fetch-arxiv.js`                          | Unset — no `From` header sent         |
| `APARTURE_TEST_PROMPT_OVERRIDE`         | Test only                 | Most LLM-calling routes · `lib/llm/callModel.js`    | Unset                                 |
| `APARTURE_TEST_PDF_OVERRIDE`            | Test only                 | `lib/llm/callModel.js`                              | Unset                                 |
| `APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE` | Test only                 | `pages/api/suggest-profile.js`                      | Unset                                 |
| `APARTURE_TEST_CHECK_PROMPT_OVERRIDE`   | Test only                 | `pages/api/check-briefing.js`                       | Unset                                 |

## Required

### `ACCESS_PASSWORD`

The password that gates every API route. The web UI sends it in the `password` field on every request; each route compares it to `process.env.ACCESS_PASSWORD` and returns `401 Invalid password` on mismatch. Never sent to the browser — the client stores only what the user typed.

```bash
ACCESS_PASSWORD=correct-horse-battery-staple
```

A long random string (12+ characters) is enough for the intended use case — a single-tenant dev or self-hosted instance. Aparture is not designed to sit on the public internet unprotected; for that, wrap it behind a real auth layer.

## API keys (at least one required)

You need at least one provider key. Providing several lets you mix providers across pipeline stages — the default config uses Google for all slots, but Anthropic + Google, OpenAI + Anthropic, or any other combination works as long as each selected model's provider has a key.

Each route resolves its key at request time based on the selected model's provider. No startup validation — a stage configured for a provider with no key will fail only when it tries to run.

### `CLAUDE_API_KEY`

Anthropic (Claude) API key. Prefix: `sk-ant-api03-`. Used when any pipeline slot is set to a Claude model. See [Anthropic setup](/getting-started/api-keys-anthropic) for signup and key creation.

```bash
CLAUDE_API_KEY=sk-ant-api03-...
```

### `OPENAI_API_KEY`

OpenAI (GPT) API key. Prefix: `sk-proj-` for project keys (current) or `sk-` for legacy user keys. Used when any slot is set to a GPT-5.4 model. See [OpenAI setup](/getting-started/api-keys-openai).

```bash
OPENAI_API_KEY=sk-proj-...
```

### `GOOGLE_AI_API_KEY`

Google AI Studio (Gemini) API key. Prefix: `AIzaSy`. Used when any slot is set to a Gemini model. The env var is specifically `GOOGLE_AI_API_KEY` — not `GEMINI_API_KEY` or `GOOGLE_API_KEY`. See [Google setup](/getting-started/api-keys-google).

```bash
GOOGLE_AI_API_KEY=AIzaSy...
```

## Optional

### `PORT`

Port for `npm run dev`. Useful when 3000 is already in use by something else. Read by the Next.js CLI directly; no Aparture source code references it. Requires a dev-server restart.

```bash
PORT=3001
```

### `NODE_ENV`

Set automatically by `next dev` (`development`), `next start` (`production`), and `vitest` (`test`). You usually don't set this in `.env.local`. One source-level effect: when `NODE_ENV === 'test'`, `pages/api/analyze-pdf.js` honors the `_testPdfBase64` request body field (see below) and skips the download path. In any other environment that field is ignored.

### `ARXIV_CONTACT_EMAIL`

Contact email sent as an HTTP `From` header on every request proxied through `pages/api/fetch-arxiv.js`. arXiv's API user manual politely asks clients to identify themselves so their ops team can reach the maintainer if the traffic pattern causes issues. Not authenticated — arXiv has no API-key or account system for the public query endpoint; the header is purely a goodwill signal, weighted by their abuse heuristics. If unset, no `From` header is sent (the request still works; it's just anonymous).

```bash
ARXIV_CONTACT_EMAIL=you@example.edu
```

Institutional addresses (`.edu`, `.ac.*`) tend to carry more weight than generic webmail domains.

## Test-only overrides

::: danger Do not set these in a real dev environment
These variables exist so the Vitest integration suite can produce deterministic fixture hashes. When set, the affected routes substitute stub values into prompts — useful for tests, useless (and silently destructive) for real runs.
:::

### `APARTURE_TEST_PROMPT_OVERRIDE`

When set, replaces the variable tail of each LLM prompt with this literal string before hashing. Makes fixture keys deterministic regardless of paper content. Also disables Anthropic prompt caching (the `cachePrefix` / `cacheable` fields are omitted from the request), so fixture behaviour doesn't depend on cache state.

Read by `pages/api/synthesize.js`, `score-abstracts.js`, `rescore-abstracts.js`, `quick-filter.js`, `analyze-pdf.js`, `analyze-pdf-quick.js`, and `generate-notebooklm.js`, and also by `lib/llm/callModel.js` for some mode-specific handling. Used via `beforeEach` in the integration tests at `tests/integration/`.

### `APARTURE_TEST_PDF_OVERRIDE`

When set, replaces the `pdfBase64` field in the LLM request with this literal value before hashing. Decouples the fixture cache from actual PDF content. Read by `lib/llm/callModel.js`; used only by `tests/integration/analyze-pdf.test.js`.

### `APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE`

Variant of `APARTURE_TEST_PROMPT_OVERRIDE` scoped to `pages/api/suggest-profile.js`. The suggest-profile route has its own override because its prompt layout differs from the other routes.

### `APARTURE_TEST_CHECK_PROMPT_OVERRIDE`

Variant of `APARTURE_TEST_PROMPT_OVERRIDE` scoped to `pages/api/check-briefing.js`.

### `_testPdfBase64` (request body field, not env var)

Not an environment variable — a request body field on `POST /api/analyze-pdf`, gated by `NODE_ENV === 'test'`. When present and gated in, the route injects the provided base64 PDF bytes directly and skips the arXiv download path entirely: the HTTP fetch, the Playwright fallback, and the reCAPTCHA handling are all bypassed. Used by `tests/integration/analyze-pdf.test.js` with the minimal fixture PDF at `tests/fixtures/pdf/minimal.pdf`.

## File format rules

A few things about `.env.local` that bite reliably:

- **UTF-8, no BOM.** Windows Notepad's default "Save As UTF-8" adds a byte-order mark. Use VS Code with "UTF-8" (not "UTF-8 with BOM"), or another editor with an explicit no-BOM option.
- **LF line endings.** A CRLF at the end of a line can leak `\r` into the value on that line, which surfaces as "invalid password" or "invalid API key" errors with no other hint. Configure your editor to save `.env*` files as LF.
- **No quotes.** `KEY=value` is correct. Quoting the value adds the quotes to the value on some parsers.
- **Comments at column 0.** `# note` works only at the start of a line. `KEY=value # note` sets `KEY` to the literal string `value # note` on most parsers.
- **One variable per line.** No multi-line values.

## Security

- `.env.local` is gitignored by default. Verify with `git check-ignore .env.local` — if it prints the path, it's being ignored; if it prints nothing, `.gitignore` isn't set up right.
- API keys never cross the client boundary. All LLM calls go through `pages/api/*` server routes, which read the env var and forward the request. The browser never sees the key.
- If you accidentally commit a key, revoke it in the provider's console and rotate. A commit that touched `.env.local` is reachable forever in the git history; rotating the key is simpler than trying to scrub it.

## See also

- [API keys hub](/getting-started/api-keys) — pricing and provider comparison
- [Install](/getting-started/install) — Node setup and creating `.env.local`
- [Verify setup](/getting-started/verify-setup) — the two sanity-check buttons that confirm keys authenticate
- [Troubleshooting](/reference/troubleshooting) — symptoms caused by `.env.local` format issues
