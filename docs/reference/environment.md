# Environment variables

Aparture reads 9 environment variables: 4 for production, 2 optional, and 4 test-only escape hatches. All of them live in `.env.local` at the repo root.

```bash
# .env.local — gitignored, project root
ACCESS_PASSWORD=change-me
CLAUDE_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=

# Optional
# PORT=3001
```

::: warning Restart after editing
Next.js reads `.env.local` once at dev-server startup. Hot-reload for env files is unreliable on Next 14. If you edit `.env.local` while `npm run dev` is running, restart it (Ctrl-C, re-run) to pick up the change.
:::

## Required

### `ACCESS_PASSWORD`

|          |                                                                   |
| -------- | ----------------------------------------------------------------- |
| Required | Yes                                                               |
| Read by  | Every route in `pages/api/` (9 files), `lib/llm/resolveApiKey.js` |
| Default  | None — API routes reject all requests if unset                    |
| Example  | `ACCESS_PASSWORD=correct-horse-battery-staple`                    |

The password that gates every Aparture API route. Every request from the web UI sends this in the `password` field; routes compare it to `process.env.ACCESS_PASSWORD` and return `401 Invalid password` on mismatch. Never exposed to the browser.

Strength guidance: use a long random string (12+ characters). This is not enterprise auth — it's a speed bump that keeps casual visitors from hitting your unprotected dev-server instance. For public-internet deployments (not the intended use case today), wrap Aparture behind a real auth layer.

## API keys (at least one required)

You need at least one of these. Providing multiple lets you mix providers across pipeline stages — the default config mixes Google + Google, but you can freely combine Anthropic + Google, OpenAI + Anthropic, etc.

All three are read at request time (not cached at startup), so provider selection per-request works cleanly.

### `CLAUDE_API_KEY`

|          |                                                                     |
| -------- | ------------------------------------------------------------------- |
| Required | At least one API key required (see above)                           |
| Read by  | All LLM-calling routes in `pages/api/` · `lib/llm/resolveApiKey.js` |
| Default  | Anthropic models unavailable if unset                               |
| Example  | `CLAUDE_API_KEY=sk-ant-api03-...`                                   |

Anthropic (Claude) API key. Prefix: `sk-ant-`. See [api-keys-anthropic](/getting-started/api-keys-anthropic) for signup and key creation.

### `OPENAI_API_KEY`

|          |                                                                     |
| -------- | ------------------------------------------------------------------- |
| Required | At least one API key required                                       |
| Read by  | All LLM-calling routes in `pages/api/` · `lib/llm/resolveApiKey.js` |
| Default  | OpenAI models unavailable if unset                                  |
| Example  | `OPENAI_API_KEY=sk-proj-...`                                        |

OpenAI (GPT) API key. Prefix: `sk-proj-` (current) or `sk-` (legacy). See [api-keys-openai](/getting-started/api-keys-openai).

### `GOOGLE_AI_API_KEY`

|          |                                                                     |
| -------- | ------------------------------------------------------------------- |
| Required | At least one API key required                                       |
| Read by  | All LLM-calling routes in `pages/api/` · `lib/llm/resolveApiKey.js` |
| Default  | Google Gemini models unavailable if unset                           |
| Example  | `GOOGLE_AI_API_KEY=AIzaSy...`                                       |

Google AI Studio (Gemini) API key. Prefix: `AIzaSy`. Note the env var name is `GOOGLE_AI_API_KEY`, not `GEMINI_API_KEY` or `GOOGLE_API_KEY`. See [api-keys-google](/getting-started/api-keys-google).

## Optional

### `PORT`

|          |                                                 |
| -------- | ----------------------------------------------- |
| Required | No                                              |
| Read by  | Next.js CLI directly (not referenced in source) |
| Default  | `3000`                                          |
| Example  | `PORT=3001`                                     |

Port for `npm run dev`. Handy if 3000 is already in use. Requires a dev-server restart to take effect.

### `NODE_ENV`

|          |                                                            |
| -------- | ---------------------------------------------------------- |
| Required | No                                                         |
| Read by  | `pages/api/analyze-pdf.js` (test escape hatch), some tests |
| Default  | `development` (set by Next.js)                             |
| Example  | `NODE_ENV=test`                                            |

Set automatically by `next dev` / `next start` / `npm test`. You usually don't set this in `.env.local`. When `NODE_ENV === 'test'`, `pages/api/analyze-pdf.js` honors the `_testPdfBase64` request body field (see below); otherwise that field is ignored.

## Test-only escape hatches

::: danger Do not set these in a real dev environment
These are used by the Vitest integration-test suite to make fixture hashes deterministic. They're unconditionally active when set — if you set them in a real dev environment, the API routes will substitute stub values into every prompt, which is obviously not useful for real runs.
:::

### `APARTURE_TEST_PROMPT_OVERRIDE`

|         |                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope   | Test only                                                                                                                                  |
| Read by | Synthesize, score-abstracts, rescore-abstracts, quick-filter, generate-notebooklm, analyze-pdf, analyze-pdf-quick · `lib/llm/callModel.js` |
| Default | Unset in normal use                                                                                                                        |
| Example | `'SCORE_ABSTRACTS_TEST_FIXTURE'` (literal string)                                                                                          |

When set, replaces the variable portion of LLM prompts with this literal value before hashing. Makes fixture hashes deterministic regardless of paper content. Also disables Anthropic prompt caching (`cachePrefix`/`cacheable` omitted from the hashed input object), so fixture keys don't depend on caching state. Used via `beforeEach` in integration tests.

### `APARTURE_TEST_PDF_OVERRIDE`

|         |                                                                  |
| ------- | ---------------------------------------------------------------- |
| Scope   | Test only                                                        |
| Read by | `lib/llm/callModel.js` · `tests/integration/analyze-pdf.test.js` |
| Default | Unset                                                            |
| Example | `'ANALYZE_PDF_TEST_PDF_FIXTURE'`                                 |

When set, replaces the `pdfBase64` field in the LLM request with this literal value before hashing. Decouples the fixture cache from actual PDF content. Used only by `analyze-pdf.test.js`.

### `APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE`

|         |                                |
| ------- | ------------------------------ |
| Scope   | Test only                      |
| Read by | `pages/api/suggest-profile.js` |
| Default | Unset                          |
| Example | Similar to PROMPT_OVERRIDE     |

Variant of `APARTURE_TEST_PROMPT_OVERRIDE` specific to the `/api/suggest-profile` route. Substitutes the entire prompt (not just the variable tail).

### `APARTURE_TEST_CHECK_PROMPT_OVERRIDE`

|         |                               |
| ------- | ----------------------------- |
| Scope   | Test only                     |
| Read by | `pages/api/check-briefing.js` |
| Default | Unset                         |
| Example | Similar to PROMPT_OVERRIDE    |

Variant of `APARTURE_TEST_PROMPT_OVERRIDE` specific to the `/api/check-briefing` route.

### `_testPdfBase64` (request body field, not env var)

Not an environment variable — a request-body field on `/api/analyze-pdf`. Gated by `NODE_ENV === 'test'`. When present and gated in, the route injects the provided base64 PDF bytes directly instead of downloading from arXiv (skipping Playwright + reCAPTCHA). Used by `tests/integration/analyze-pdf.test.js` via the minimal fixture PDF at `tests/fixtures/pdf/minimal.pdf`.

## File format rules

- **UTF-8, no BOM.** Windows Notepad's default "Save As UTF-8" adds a BOM. Use VS Code or "UTF-8 without signature" instead.
- **LF line endings.** CRLF can leak `\r` into the last variable on a line and surface as "API key invalid" errors. Configure your editor for LF on `.env*` files.
- **No quotes.** `KEY=value` is correct. Quoting the value is not needed and can introduce surprises.
- **Comments at column 0.** `# this is a comment` only works at the start of a line. Inline `#` after a value is NOT a comment delimiter — `KEY=value # note` sets `KEY` to `value # note` on most parsers.
- **One variable per line.** No multi-line values.

## Security

- `.env.local` is gitignored by default. Verify with `git check-ignore .env.local` — if it prints the path, you're safe. If it prints nothing, `.env.local` is not being ignored and you need to fix `.gitignore`.
- Never commit API keys. If you accidentally do, revoke the keys immediately in the provider's console and rotate.
- API keys never cross the client boundary — all LLM calls route through `pages/api/*` server endpoints. The browser never sees them.

## Related

- [API keys hub](/getting-started/api-keys) — pricing + provider comparison
- [Install](/getting-started/install) — Node + `.env.local` setup
- [Verify setup](/getting-started/verify-setup) — confirm the keys authenticate
