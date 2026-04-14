# Batch 3 Execution Report

**Plan:** `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md`
**Batch:** 3 of 7 (Task 9 from the in-repo plan)
**Started:** 2026-04-14 ~01:32 EDT
**Completed:** 2026-04-14 ~01:40 EDT
**Wall time:** ~8 min
**Status:** ✅ Clean — no outstanding code issues; one user-raised scope question handled (see §"Scope question raised mid-batch")
**Reviewed by:** manual verification (single small task with no novel logic)

---

## What this batch was supposed to deliver

Per the in-repo plan §11, Batch 3 corresponds to Task 9 only:

- Per-provider token estimation (`tiktoken` for OpenAI, char-based heuristic for Anthropic and Google) and budget pre-flight thresholds. New module at `lib/llm/tokenBudget.js` with two exports: `estimateTokens` and `budgetPreflight`. Used by Batch 5's synthesis API route to estimate input token cost before issuing the actual LLM call.

## Commits produced (1 total)

| #   | Hash      | Message                                                             | Source             |
| --- | --------- | ------------------------------------------------------------------- | ------------------ |
| 1   | `32c1c9b` | `feat(llm): add per-provider token estimation and budget preflight` | Task 9 implementer |

No follow-up review-fix commits.

## Test suite progression

| After task                 | Test files | Tests | New tests                   |
| -------------------------- | ---------- | ----- | --------------------------- |
| Pre-batch (end of Batch 2) | 7          | 25    | —                           |
| Task 9                     | 8          | 32    | + `tokenBudget.test.js` (7) |

**Final state:** 32 tests across 8 files, all passing. `npm run lint` clean.

## New files in the repo

```
lib/llm/tokenBudget.js              # estimateTokens + budgetPreflight
tests/unit/llm/tokenBudget.test.js  # 7 tests
```

## ESM compatibility note

The in-repo plan's Task 9 source code used CommonJS `require('tiktoken')`, which would have failed in this project's ESM context. The implementer was given an updated prompt with three escalating fallbacks: (a) named ESM import `import { encoding_for_model, get_encoding } from 'tiktoken'`, (b) `createRequire(import.meta.url)` if (a) failed, (c) heuristic-only if both failed. **The named ESM import worked on the first try** under Vitest's Vite-based transform, so the createRequire fallback was not needed. This is documented in the source as a comment block at the top of `tokenBudget.js`.

If a future Node version or vitest upgrade breaks the named ESM import, the createRequire fallback path is documented in the implementer prompt for Task 9 (in this report's prompt history) and can be applied in a one-line edit.

## Scope question raised mid-batch: local model support

**Raised by:** user, mid-batch
**Question:** "I want to check to make sure somewhere in Phase 1 or Phase 2 we have plans to incorporate local models if available. If not, we should just note this down somewhere as something we should implement."

**Honest answer:** No, neither Phase 1 nor Phase 2 currently includes local model support. It was previously listed as a stretch goal (post-v2.1) under the label "Ollama integration."

**Architectural reality:** The provider abstraction landed in Batches 1 and 2 (specifically the polished pattern in `ebac518` that imports `PROVIDERS` from `providers.js` and uses `providerCfg.apiKeyHeader`/`apiKeyPrefix`) makes this nearly free to add, because **both Ollama and LM Studio (plus most other local inference servers) expose OpenAI-compatible `/v1/chat/completions` APIs** out of the box. Specifically:

- Ollama: `http://localhost:11434/v1/chat/completions`
- LM Studio: `http://localhost:1234/v1/chat/completions`
- llama.cpp `server`, vLLM, etc.: same pattern

The existing `lib/llm/structured/openai.js` module **already implements this API**. Adding local model support means:

1. Add a `local` (or `ollama`/`lmstudio`) entry to `lib/llm/providers.js` with a configurable `baseUrl` (default to LM Studio's port)
2. Add a branch to `lib/llm/callModel.js` that imports `openai.js` and skips the auth header
3. Add a config setting in `config.json` (Phase 2) or in the localStorage UI (Phase 1) for the local server URL
4. Add a tiny test verifying the routing

**Implementation effort: ~30 minutes** given the existing architecture.

**Action taken:** Updated `docs/superpowers/specs/2026-04-13-aparture-refactor-design.md` to promote local model support from the "Stretch (post-v2.1)" section to a dedicated **v2.1** entry with its own subsection explaining (a) the implementation is nearly free given the Phase 1 work, (b) the existing `openai.js` module already implements the API, (c) the caveat that local model output quality is meaningfully lower than frontier models for the synthesis workload specifically. The "Stretch" section retains a separate entry for "fully autonomous local-only mode" which is the additional investment of tuning the synthesis prompts specifically for smaller local models — that's a quality investment beyond just plumbing the connection.

**Implementation NOT performed in Batch 3** because:

1. The user explicitly said "we should just note this down somewhere as something we should implement" — i.e., document the gap, don't add scope autonomously
2. Adding scope mid-autonomous-loop without explicit user approval is risky
3. The natural place for it is v2.1 (after Phase 2 ships), not Phase 1 (which is already large)

**If the user wants it in Phase 1:** add a follow-up task between Batch 3 and Batch 4 (call it Task 9.5) and re-dispatch. ~30 min of work, fits the existing pattern, preserves the architectural cleanliness.

**If the user wants to test their LM Studio install right now:** they can manually hit the existing `lib/llm/structured/openai.js` builder with `model: '<lmstudio-model-name>'` and a hand-constructed `callModel` invocation that points at `http://localhost:1234/v1/chat/completions`. The hardcoded URL in `lib/llm/structured/openai.js` would need a one-line change OR they could hit the exported `buildOpenAIRequest` directly and rewrite the URL. Not a clean dev path, but it confirms the architecture works for local servers.

## Subagent dispatch summary

- **Implementers:** 1 dispatch (Task 9), `general-purpose` agent on `sonnet`, returned DONE on first attempt
- **Spec compliance reviewer:** 0 (small focused task with literal code from the plan)
- **Code quality reviewer:** 0 (same reason)
- **Manual verification:** read `tokenBudget.js`, ran `npm test` (32/32 passing), ran `git show --stat HEAD` (2 files modified)

## Things to watch out for

1. **The tiktoken WASM import is slow** — the first `import { encoding_for_model, get_encoding } from 'tiktoken'` call adds ~100-200ms to Vitest startup. Acceptable for a test suite run; could be a noticeable startup cost if the synthesis API route runs on a cold serverless function. For Phase 1 (running on `npm run dev`) this is irrelevant.
2. **The OpenAI test relies on `'hello world'` tokenizing to between 1 and 9 tokens** — this is a stable assumption for cl100k_base and gpt-5 models. If a future tiktoken upgrade changes the encoding, the test could flake. Not a real concern but worth noting.
3. **The char-based heuristic (~4 chars/token) is approximate.** Real Anthropic and Google token counts can be 20–40% off in either direction, especially for non-English text or code. The pre-flight is meant for _order-of-magnitude_ decisions (proceed / notice / block), not for exact cost accounting. The actual token usage is reported by the provider response and captured in `parse<Provider>Response`'s `tokensIn`/`tokensOut` fields.

## What's ready for Batch 4

Batch 4 (Tasks 10–12) creates the structured-output schema for the synthesis stage, the citation validator, and the two-pass repair prompting logic. All three are pure functions with clear specs in the in-repo plan. No new architectural decisions required.

## Recommendation

**Continue to Batch 4.** No outstanding code issues. The local-models scope question is documented in the spec and in this report; no implementation action is taken without explicit user approval.

If you're spot-checking in the morning: read the local-models section of the spec (§11 v2.1 detail) and decide whether to (a) leave it as v2.1, (b) ask me to backfill it into Phase 1 as Task 9.5, or (c) test it manually against your LM Studio install before deciding. All three are reasonable; the architecture is in place for any of them.
