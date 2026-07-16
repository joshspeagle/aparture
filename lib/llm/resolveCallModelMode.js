// Resolve the client-supplied `callModelMode` body field into the mode object
// actually passed to callModel.
//
// Fixture mode ({mode: 'fixture', fixturesDir}) bypasses the credential check
// and makes the server read `<fixturesDir>/<hash>.json` from its filesystem —
// that is a test-only affordance, never a production one. Outside the test
// environment we ignore the client's value entirely and force live mode, the
// same NODE_ENV === 'test' gating as the `_testPdfBase64` escape hatch in
// pages/api/analyze-pdf.js. Vitest and scripts/smoke-llm-routes.mjs both set
// NODE_ENV=test, so fixture-based tests are unaffected.
export function resolveCallModelMode(callModelMode) {
  if (process.env.NODE_ENV !== 'test') return { mode: 'live' };
  return callModelMode ?? { mode: 'live' };
}
