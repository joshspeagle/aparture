// Shared two-phase auth for LLM-backed API routes.
//
// Every LLM route follows the same contract (see CLAUDE.md "Auth pattern"):
// accept EITHER a client-supplied `apiKey` (BYOK) OR a `password` validated
// against ACCESS_PASSWORD and swapped for the server-side env-var key of the
// resolved provider. On top of that, each route resolves the callModel mode
// (`resolveCallModelMode`) and skips the missing-credentials 401 in fixture
// mode, because fixture-based tests never hit a provider.
//
// The flow is split into two phases so routes can interleave their own
// checks between them:
//
//   Phase 1 — checkRoutePassword: validate the password WITHOUT touching
//   provider keys. pages/api/score-abstracts.js depends on this split: its
//   login probe (`{papers: [], password}`) must authenticate the password
//   and hit the empty-papers 200 before any provider key is resolved, since
//   the defaulted provider's key may legitimately be unset.
//
//   Phase 2 — resolveRouteAuth: run the full ladder (password gate → env-key
//   resolution → callMode → fixture-aware missing-credentials check). Phase 1
//   is re-run internally, so routes with no ordering constraint call only
//   this one function.
//
// Error MESSAGES are per-route (the integration tests pin each route's
// response bodies), so both phases accept overrides via `messages` and only
// default to the most common wording.

import { checkAccessPassword } from '../auth/checkAccessPassword.js';
import { resolveCallModelMode } from './resolveCallModelMode.js';

const PROVIDER_ENV_KEYS = {
  anthropic: 'CLAUDE_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
};

const DEFAULT_MESSAGES = {
  invalidPassword: 'invalid password',
  missingCredentials: 'missing credentials: supply apiKey or password',
};

// Phase 1: password-only gate. Returns { ok: true } or
// { ok: false, status: 401, error } ready for `res.status(...).json(...)`.
//
// Default semantics: a client-supplied apiKey bypasses password validation,
// and an absent/empty password is not an error here (it becomes a
// missing-credentials 401 in phase 2 unless running in fixture mode).
//
// `validateWhenPresent: true` tightens the gate to "any supplied password
// must be valid, even alongside an apiKey, even when empty" — the
// generate-notebooklm contract, where a wrong password reliably 401s before
// any body validation (401, never 400).
export function checkRoutePassword(
  { apiKey, password },
  { messages = {}, validateWhenPresent = false } = {}
) {
  const invalidPassword = messages.invalidPassword ?? DEFAULT_MESSAGES.invalidPassword;
  const mustValidate = validateWhenPresent ? password !== undefined : !apiKey && Boolean(password);
  if (mustValidate && !checkAccessPassword(password)) {
    return { ok: false, status: 401, error: invalidPassword };
  }
  return { ok: true };
}

// Phase 2 (full ladder): password gate, env-key resolution for the resolved
// provider, callModelMode resolution, and the fixture-aware
// missing-credentials check.
//
// Returns { ok: true, apiKey, callMode, isFixture } or
// { ok: false, status: 401, error }.
//
// The env ladder deliberately does NOT coerce a missing key to null: the
// returned apiKey is `undefined` when the env var is unset, exactly like the
// per-route ladders this helper replaced. Fixture hashes cover the full
// callModel input INCLUDING apiKey, so `null` vs `undefined` would silently
// re-key every fixture recorded through the password path.
//
// Client-supplied fixture mode is honored only under NODE_ENV === 'test'
// (see resolveCallModelMode); in production it is forced back to live.
// Fixture mode skips the missing-credentials 401 — fixture-based tests don't
// need a real key because callModel never actually hits the network (and a
// dummy key would pollute the fixture hash).
export function resolveRouteAuth({
  apiKey: clientApiKey,
  password,
  provider,
  callModelMode,
  messages = {},
}) {
  const missingCredentials = messages.missingCredentials ?? DEFAULT_MESSAGES.missingCredentials;

  const gate = checkRoutePassword({ apiKey: clientApiKey, password }, { messages });
  if (!gate.ok) return gate;

  // Password (if used) is valid past this point; swap it for the provider's
  // env key. Unknown providers resolve no key and fall through to the
  // missing-credentials check below.
  let apiKey = clientApiKey;
  if (!apiKey && password) {
    const envKey = PROVIDER_ENV_KEYS[provider];
    if (envKey) apiKey = process.env[envKey];
  }

  const callMode = resolveCallModelMode(callModelMode);
  const isFixture = callMode.mode === 'fixture';
  if (!apiKey && !isFixture) {
    return { ok: false, status: 401, error: missingCredentials };
  }
  return { ok: true, apiKey, callMode, isFixture };
}
