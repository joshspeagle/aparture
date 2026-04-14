# Batch 2 Execution Report

**Plan:** `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md`
**Batch:** 2 of 7 (Tasks 7–8 from the in-repo plan)
**Started:** 2026-04-14 ~01:15 EDT
**Completed:** 2026-04-14 ~01:30 EDT
**Wall time:** ~15 min
**Status:** ✅ Clean — no outstanding issues
**Reviewed by:** manual verification per task (full file reads + test runs); no formal subagent reviewers dispatched (tasks were template applications of the Batch 1 polished pattern, no novel logic to review)

---

## What this batch was supposed to deliver

Per the in-repo plan §11, Batch 2 corresponds to Tasks 7–8, which together complete the live-mode story for the LLM provider abstraction:

- Google Gemini live mode using `responseSchema` for structured output (Task 7)
- OpenAI Chat Completions live mode using `response_format: json_schema` with `strict: true` (Task 8)

After Batch 2, `callModel()` works in live mode for all three frontier providers. The fixture-mode test harness from Batch 1 already supported all three providers; what was missing were the actual HTTP integrations for Google and OpenAI. Both now exist with the same pattern Batch 1's polish refactor established for Anthropic.

## Commits produced (2 total)

| #   | Hash      | Message                                                                        | Source             |
| --- | --------- | ------------------------------------------------------------------------------ | ------------------ |
| 1   | `8eb65b0` | `feat(llm): add Google Gemini live mode with responseSchema structured output` | Task 7 implementer |
| 2   | `4cc80aa` | `feat(llm): add OpenAI live mode with response_format strict json_schema`      | Task 8 implementer |

No follow-up review-fix commits were needed for Batch 2 — both tasks landed cleanly on the first dispatch because the implementers were given the polished pattern from Batch 1 as part of the prompt context.

## Test suite progression

| After task                 | Test files | Tests | New tests              |
| -------------------------- | ---------- | ----- | ---------------------- |
| Pre-batch (end of Batch 1) | 5          | 17    | —                      |
| Task 7                     | 6          | 21    | + `google.test.js` (4) |
| Task 8                     | 7          | 25    | + `openai.test.js` (4) |

**Final state:** 25 tests across 7 files, all passing. `npm run lint` exits 0 errors (1 pre-existing warning in `docs/.vitepress/theme/index.js` — same as before Batch 1).

## New files in the repo

```
lib/llm/structured/
├── google.js                                 # buildGoogleRequest + parseGoogleResponse (responseSchema)
└── openai.js                                 # buildOpenAIRequest + parseOpenAIResponse (response_format strict)

tests/unit/llm/structured/
├── google.test.js                            # 4 tests
└── openai.test.js                            # 4 tests
```

## Modified files

- `lib/llm/callModel.js` — added two new live-mode branches (Google before OpenAI, both after Anthropic, all before the final unimplemented-throw defense-in-depth)

## Architectural notes

### Pattern consistency across three providers

After Batch 2, `lib/llm/callModel.js` has three live-mode branches plus a final defense-in-depth throw. The shape is:

```
callModel(input, options)
├── validate provider (capture providerCfg)
├── if mode === 'fixture' → loadFixture
├── if provider === 'anthropic' → import anthropic.js, build, fetch (header auth via providerCfg), parse
├── if provider === 'google'    → import google.js,    build, fetch (no auth header — query-param), parse
├── if provider === 'openai'    → import openai.js,    build, fetch (header auth via providerCfg), parse
└── throw 'live mode not yet implemented' (unreachable for known providers)
```

Each provider module:

- Imports `PROVIDERS` from `lib/llm/providers.js` for URL/header constants
- Exports `build<Provider>Request(input)` returning `{ url, method, headers, body }`
- Exports `parse<Provider>Response(response, options?)` returning `{ text, tokensIn, tokensOut, structured? }`
- Has JSDoc on both exported functions

### Three meaningful provider divergences captured cleanly

1. **URL construction.** Anthropic and OpenAI use static base URLs from `PROVIDERS.<provider>.baseUrl`. Google uses a per-model URL `${baseUrl}/${model}:generateContent`, constructed inside `buildGoogleRequest`.
2. **Auth mechanism.** Anthropic uses `x-api-key` header (no prefix). OpenAI uses `Authorization: Bearer <key>` (prefix from `apiKeyPrefix`). Google uses query-parameter auth `?key=<key>` (no header at all). The `callModel.js` Anthropic and OpenAI branches share the same auth-value-computation block (`providerCfg.apiKeyPrefix ? ... : ...`) plus `[providerCfg.apiKeyHeader]: authValue`. The Google branch passes `req.headers` straight through with no auth modification.
3. **Structured output extraction.** Anthropic returns the structured payload as a separate `tool_use` block in `content[]`. Google and OpenAI both return it as JSON inside the text body (Google via `responseSchema`, OpenAI via `response_format: json_schema`). The `parse<Provider>Response` functions for Google and OpenAI both take an optional `{ expectStructured: true }` flag that triggers `JSON.parse(text)` and writes the result to `structured`. Anthropic's parser inspects the content blocks directly and doesn't need the flag.

### Why no follow-up review-fix commits

Batch 1 ended with a polish refactor (`ebac518`) that consolidated provider config constants and established the pattern for the auth-value computation. Tasks 7 and 8 were given the polished pattern as part of their implementer prompt, so they applied it correctly the first time. The structural issue the code-quality reviewer flagged on Batch 1 (constant duplication across providers) does not recur in Batch 2.

## Subagent dispatch summary

- **Implementers:** 2 dispatches (one per task), both `general-purpose` agents on `sonnet`. Both reported DONE on first attempt with no escalations.
- **Spec compliance reviewer:** 0 dispatches (skipped — both tasks were template applications with no novel decisions; the polished pattern from Batch 1 + the reference files I pointed the implementer at gave them everything they needed)
- **Code quality reviewer:** 0 dispatches (same reason)
- **Manual verification:** I read every committed file, ran `npm test` after each task, ran `git show --stat HEAD` to confirm exactly 3 files per commit, and verified the callModel.js branch order is correct (Anthropic → Google → OpenAI → final throw).

## Things to watch out for

1. **Google vs the others.** The Google branch in `callModel.js` is shorter (no auth-value computation, no header injection) because of the query-param auth. If a future provider also uses query-param auth, this is the template to copy from. If a future provider uses header auth, copy from Anthropic or OpenAI instead.
2. **The final defense-in-depth throw is technically unreachable** for any provider in `PROVIDERS`. It's preserved deliberately so that if someone adds a new entry to `PROVIDERS` without a corresponding `callModel.js` branch, the runtime error catches it immediately rather than silently dropping the call.
3. **None of the live-mode branches are tested in unit tests.** The `build*Request` and `parse*Response` functions are tested in isolation, but the actual `fetch` call inside the branches is not exercised in the test suite. Live-mode end-to-end testing requires either real API calls (cost) or HTTP mocking (not yet set up). This is intentional for Phase 1 — live-mode integration testing is deferred to Batch 5 when the synthesis API route gets its first live integration test.

## What's ready for Batch 3

Batch 3 (Task 9, the only task in the batch) creates `lib/llm/tokenBudget.js` — per-provider token estimation using `tiktoken` for OpenAI and char-based heuristics for Anthropic and Google. The plan has the implementation already specified. No new architectural decisions required; pure addition.

## Recommendation

**Continue to Batch 3.** No outstanding issues, all 25 tests passing, lint clean, push to origin pending.

If you're spot-checking in the morning, the highest-value file to read in Batch 2 is `lib/llm/callModel.js` (now 102 lines) — it shows all three provider branches side by side and confirms the pattern is consistent. The two new structured-output modules (`google.js`, `openai.js`) are short and follow the Anthropic template exactly.
