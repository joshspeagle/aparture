// Free pre-flight validation of the API setup. Unlike every other route in
// pages/api/, this is NOT a pipeline stage and makes NO model calls: it runs
// per-provider validation probes (Anthropic count_tokens, Google countTokens,
// OpenAI model GET) that verify keys, model IDs, and — where the provider
// supports it — request syntax, without sampling any tokens.
//
// Body: { slots: [{slot, model}], password?, apiKey? }
// Auth follows the standard route pattern: apiKey (BYOK) OR password
// validated against ACCESS_PASSWORD, swapped for the per-provider env key
// via resolveApiKey. The key is never echoed back.

import { resolveApiKey } from '../../lib/llm/resolveApiKey.js';
import { validateProviderSetup } from '../../lib/llm/validateSetup.js';
import { checkAccessPassword } from '../../lib/auth/checkAccessPassword.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

const PROVIDER_ENV_LABELS = {
  anthropic: 'CLAUDE_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
};

const PROBE_TIMEOUT_MS = 10000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slots, password, apiKey: clientApiKey } = req.body ?? {};

  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'missing required field: slots[]' });
  }
  // Element shape check: a null/non-object entry would throw at the
  // destructuring below and surface as a 500 on a public route.
  const badSlot = slots.find(
    (s) => !s || typeof s !== 'object' || typeof s.slot !== 'string' || typeof s.model !== 'string'
  );
  if (badSlot !== undefined) {
    return res
      .status(400)
      .json({ error: 'invalid slots[] entry: each needs string `slot` and `model` fields' });
  }
  if (!clientApiKey && !password) {
    return res.status(401).json({ error: 'missing credentials: supply apiKey or password' });
  }
  // Validate the password once up front so a wrong password 401s instead of
  // producing per-slot failures (resolveApiKey re-checks it per provider).
  if (!clientApiKey && !checkAccessPassword(password)) {
    return res.status(401).json({ error: 'invalid password' });
  }

  // Group slots by unique (provider, apiId) pair — identical pairs share one
  // probe so seven slots on two models cost two requests, not seven.
  const pairs = new Map(); // pairKey -> {provider, modelApiId, promise}
  const slotEntries = slots.map(({ slot, model }) => {
    const registryEntry = MODEL_REGISTRY[model];
    if (!registryEntry) {
      return { slot, model, provider: null, pairKey: null };
    }
    const provider = registryEntry.provider.toLowerCase();
    const modelApiId = registryEntry.apiId;
    const pairKey = `${provider}|${modelApiId}`;
    if (!pairs.has(pairKey)) {
      const resolved = resolveApiKey({ clientApiKey, password, provider });
      const apiKey = resolved.apiKey;
      const promise = apiKey
        ? validateProviderSetup({
            provider,
            model: modelApiId,
            apiKey,
            timeoutMs: PROBE_TIMEOUT_MS,
          })
        : Promise.resolve({
            ok: false,
            checks: { key: false, model: null, requestShape: null },
            message: `No ${PROVIDER_ENV_LABELS[provider] ?? 'API'} key is set on the server.`,
          });
      pairs.set(pairKey, { provider, modelApiId, promise });
    }
    return { slot, model, provider, pairKey };
  });

  try {
    // Resolve every unique probe (validators never throw on HTTP errors —
    // they classify them — so this only rejects on programmer error).
    const pairResults = new Map();
    await Promise.all(
      [...pairs.entries()].map(async ([pairKey, pair]) => {
        pairResults.set(pairKey, await pair.promise);
      })
    );

    const results = slotEntries.map(({ slot, model, provider, pairKey }) => {
      if (!pairKey) {
        return {
          slot,
          model,
          provider: null,
          ok: false,
          checks: { key: null, model: false, requestShape: null },
          message: `Model "${model}" is not in the registry (utils/models.js).`,
        };
      }
      const result = pairResults.get(pairKey);
      return { slot, model, provider, ...result };
    });

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Error validating API setup:', error);
    return res.status(500).json({
      error: 'Failed to validate API setup',
      details: error.message,
    });
  }
}
