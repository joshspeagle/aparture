// Centralized model configuration
// This file defines all available AI models and their capabilities
//
// Pricing fields (inputPerMTok / outputPerMTok) are USD per million tokens,
// list price, snapshot 2026-10-17. `null` means the price was not verifiable
// at snapshot time — never guess. A `promo` block carries a time-boxed price
// the provider has published with an end date; effectivePricing() applies
// it until `until` (inclusive) and falls back to list price after, so cost
// estimates don't silently go stale. Update alongside
// docs/concepts/model-selection.md and docs/getting-started/api-keys.md (see
// CLAUDE.md doc-trigger table).
//
// The registry keeps each provider's current generation plus the one before
// it. Superseded ids move to RETIRED_MODEL_REMAP in
// hooks/useAnalyzerPersistence.js so saved configs migrate.
//
// `supportsAdaptiveThinking` (Anthropic entries ONLY — non-Anthropic entries
// omit it, the flag is meaningless for other providers): whether the API
// model accepts `thinking: {type: 'adaptive'}`. True for every current
// Anthropic model except Haiku 4.5 (live-verified 400: "adaptive thinking is
// not supported on this model"). The Anthropic adapter consults this flag
// via supportsAdaptiveThinkingByApiId below; keep it in sync when adding
// Anthropic models. Structured output on Anthropic goes through
// `output_config.format` (JSON schema), which every model here supports and
// which needs no tool_choice: forced tool_choice is rejected outright by
// Fable 5.1, Opus 5.5 and Sonnet 5.5.

// Model registry with actual API model IDs
const MODEL_REGISTRY = {
  // User-facing ID -> Actual API model ID mapping (+ pricing)

  // Anthropic — current
  // Fable 5.1 is Anthropic's most capable widely released model. Thinking is
  // ALWAYS on (an explicit {type: 'disabled'} returns a 400), and it requires
  // the org's data retention to be 30 days: under zero data retention every
  // request 400s.
  'claude-fable-5.1': {
    apiId: 'claude-fable-5-1',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 10,
    outputPerMTok: 50,
  },
  'claude-opus-5.5': {
    apiId: 'claude-opus-5-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 4,
    outputPerMTok: 20,
  },
  'claude-sonnet-5.5': {
    apiId: 'claude-sonnet-5-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  // Haiku 5.5 bills $0.10/$0.50 for prompts up to 100K tokens and
  // $0.50/$2.50 above that. Aparture's per-call prompts stay far below the
  // threshold, so the registry carries the short-prompt rate.
  'claude-haiku-5.5': {
    apiId: 'claude-haiku-5-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
  },

  // Anthropic — previous generation (still served)
  'claude-fable-5': {
    apiId: 'claude-fable-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 10,
    outputPerMTok: 50,
  },
  'claude-opus-5': {
    apiId: 'claude-opus-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 5,
    outputPerMTok: 25,
  },
  'claude-sonnet-5': {
    apiId: 'claude-sonnet-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: true,
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  'claude-haiku-4.5': {
    apiId: 'claude-haiku-4-5',
    provider: 'Anthropic',
    supportsAdaptiveThinking: false,
    inputPerMTok: 1,
    outputPerMTok: 5,
  },

  // OpenAI — GPT-6 family (Astra 2026-09-03, Luna 2026-09-22, 6.1 Sol 2026-09-29)
  'gpt-6-astra': {
    apiId: 'gpt-6-astra',
    provider: 'OpenAI',
    inputPerMTok: 10,
    outputPerMTok: 50,
  },
  'gpt-6.1-sol': {
    apiId: 'gpt-6.1-sol',
    provider: 'OpenAI',
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  'gpt-6-luna': {
    apiId: 'gpt-6-luna',
    provider: 'OpenAI',
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
  },

  // OpenAI — GPT-5.6 family (previous generation, still served)
  'gpt-5.6-sol': {
    apiId: 'gpt-5.6-sol',
    provider: 'OpenAI',
    inputPerMTok: 5,
    outputPerMTok: 30,
    promo: { inputPerMTok: 4, outputPerMTok: 20, until: '2026-11-21' },
  },
  'gpt-5.6-terra': {
    apiId: 'gpt-5.6-terra',
    provider: 'OpenAI',
    inputPerMTok: 2,
    outputPerMTok: 12,
  },
  'gpt-5.6-luna': {
    apiId: 'gpt-5.6-luna',
    provider: 'OpenAI',
    inputPerMTok: 0.2,
    outputPerMTok: 1.2,
  },

  // Google — current. Gemini 4 Argon is the flagship (GA 2026-10-13; paid
  // tier only). Over non-streaming generateContent its output is capped at
  // 32,768 tokens, well above anything Aparture asks for.
  'gemini-4-argon': {
    apiId: 'gemini-4-argon',
    provider: 'Google',
    inputPerMTok: 4,
    outputPerMTok: 20,
    promo: { inputPerMTok: 2, outputPerMTok: 10, until: '2026-11-30' },
  },
  'gemini-3.8-flash': {
    apiId: 'gemini-3.8-flash',
    provider: 'Google',
    inputPerMTok: 1.5,
    outputPerMTok: 7.5,
    promo: { inputPerMTok: 0.75, outputPerMTok: 3.75, until: '2026-12-31' },
  },
  'gemini-3.5-flash-lite': {
    apiId: 'gemini-3.5-flash-lite',
    provider: 'Google',
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
  },

  // Google — previous generation (still served)
  'gemini-3.6-flash': {
    apiId: 'gemini-3.6-flash',
    provider: 'Google',
    inputPerMTok: 1.5,
    outputPerMTok: 7.5,
    promo: { inputPerMTok: 0.75, outputPerMTok: 3.75, until: '2026-12-31' },
  },
  // Earliest shutdown 2027-05-07; Google names 3.5 Flash-Lite as the successor.
  'gemini-3.1-flash-lite': {
    apiId: 'gemini-3.1-flash-lite',
    provider: 'Google',
    inputPerMTok: 0.25,
    outputPerMTok: 1.5,
  },

  // Google — legacy. Gemini 2.5 is not deprecated, but since 2026-09-18 only
  // projects that already used it can call it, so new keys get errors.
  'gemini-2.5-pro': {
    apiId: 'gemini-2.5-pro',
    provider: 'Google',
    inputPerMTok: 1.25,
    outputPerMTok: 10,
  },
  'gemini-2.5-flash': {
    apiId: 'gemini-2.5-flash',
    provider: 'Google',
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
  },
  'gemini-2.5-flash-lite': {
    apiId: 'gemini-2.5-flash-lite',
    provider: 'Google',
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
  },
};

// Default model ID for app-level fallbacks (store defaults, briefing-model
// fallback chains). A GA Google model: broadly capable, free-tier friendly,
// and not subject to preview-alias shutdown churn.
const DEFAULT_MODEL_ID = 'gemini-3.8-flash';

// Model metadata for UI and capabilities
const AVAILABLE_MODELS = [
  // --- Anthropic: current ---
  {
    id: 'claude-fable-5.1',
    name: 'Claude Fable 5.1',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false, // Highest-priced model in the registry
    description:
      "Anthropic's most capable model; thinking always on, 1M context. Priced 2.5x Opus 5.5, and requires 30-day data retention on your org",
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-opus-5.5',
    name: 'Claude Opus 5.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false, // Too expensive for simple filtering
    description:
      'Current Opus; strongest at careful reading and long analytical writing, thinking always on, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-5.5',
    name: 'Claude Sonnet 5.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Current Sonnet; near-Opus quality at half the price, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: true,
    description:
      'Current Haiku; fast and very cheap, good for filtering and scoring, adaptive thinking, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },

  // --- Anthropic: previous generation ---
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous Fable; thinking always on, requires 30-day data retention on your org',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous Opus; priced above Opus 5.5',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous Sonnet; same price as Sonnet 5.5',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Previous Haiku; no adaptive thinking, 200K context, priced above Haiku 5.5',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },

  // --- OpenAI: GPT-6 family ---
  {
    id: 'gpt-6-astra',
    name: 'OpenAI GPT-6 Astra',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: "OpenAI's flagship; strongest reasoning, priced like Claude Fable",
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-6.1-sol',
    name: 'OpenAI GPT-6.1 Sol',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Balanced GPT-6 model; strong reading and writing at mid-tier pricing',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-6-luna',
    name: 'OpenAI GPT-6 Luna',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fastest, cheapest GPT-6 model; good for high-volume filtering and scoring',
    apiKeyEnv: 'OPENAI_API_KEY',
  },

  // --- OpenAI: GPT-5.6 family (previous generation) ---
  {
    id: 'gpt-5.6-sol',
    name: 'OpenAI GPT-5.6 Sol',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous-generation flagship',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'OpenAI GPT-5.6 Terra',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous-generation balanced model',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'OpenAI GPT-5.6 Luna',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Previous-generation cheap model; priced above GPT-6 Luna',
    apiKeyEnv: 'OPENAI_API_KEY',
  },

  // --- Google: current ---
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: "Google's flagship; deepest reasoning. Paid tier only (no free-tier access)",
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description:
      "Google's most capable Flash model; strong reading and writing, free-tier friendly",
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fastest and most cost-effective current Google model; good for filtering',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },

  // --- Google: previous generation ---
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Previous Flash model; same price as 3.8 Flash',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Previous Flash-Lite; shuts down no earlier than May 2027',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },

  // --- Google: legacy (projects that used it before 2026-09-18 only) ---
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (legacy)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Legacy; only projects that already used Gemini 2.5 can call it',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (legacy)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Legacy; only projects that already used Gemini 2.5 can call it',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite (legacy)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Legacy; only projects that already used Gemini 2.5 can call it',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
];

// Helper functions
const getModel = (modelId) => {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
};

// Registry provider for a user-facing model id ('Anthropic' | 'OpenAI' |
// 'Google'), or null when the id isn't registered. Callers own their own
// fallback: the API routes default to Google, and the client-side barrier
// key in lib/analyzer/stages/support.js mirrors that so acquire/signal land
// on the same rate-limit barrier.
const providerForModel = (modelId) => {
  return MODEL_REGISTRY[modelId]?.provider ?? null;
};

// Adaptive-thinking capability lookup keyed by API model id (what the
// Anthropic adapter receives), with the user-facing registry key accepted as
// a fallback for callers that pass ids straight through unresolved. Returns
// `true`/`false` when the id is registered, `undefined` when it is not —
// callers (lib/llm/structured/anthropic.js) fall back to version-parsing
// heuristics for unregistered ids (smoke-script overrides, raw apiIds).
// Scans at call time rather than precomputing so registry edits (including
// test fixtures) are always reflected.
const supportsAdaptiveThinkingByApiId = (apiId) => {
  if (!apiId) return undefined;
  const entry =
    Object.values(MODEL_REGISTRY).find((m) => m.apiId === apiId) ?? MODEL_REGISTRY[apiId];
  if (!entry || !('supportsAdaptiveThinking' in entry)) return undefined;
  return entry.supportsAdaptiveThinking === true;
};

// Effective per-MTok prices for a registry entry on a given date: the promo
// price while it runs (through `until`, inclusive, compared as YYYY-MM-DD in
// UTC), the list price otherwise. Returns null when the entry has no
// verifiable list price.
const effectivePricing = (entry, now = new Date()) => {
  if (!entry) return null;
  if (typeof entry.inputPerMTok !== 'number' || typeof entry.outputPerMTok !== 'number') {
    return null;
  }
  const today = now.toISOString().slice(0, 10);
  const promo = entry.promo;
  if (promo && typeof promo.until === 'string' && today <= promo.until) {
    return { inputPerMTok: promo.inputPerMTok, outputPerMTok: promo.outputPerMTok, promo: true };
  }
  return { inputPerMTok: entry.inputPerMTok, outputPerMTok: entry.outputPerMTok, promo: false };
};

const getModelsForPDF = () => {
  return AVAILABLE_MODELS.filter((m) => m.supportsPDF);
};

const getModelsForQuickFilter = () => {
  return AVAILABLE_MODELS.filter((m) => m.supportsQuickFilter);
};

const getModelsByProvider = (provider) => {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider);
};

// Default model configuration
// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MODEL_REGISTRY,
    AVAILABLE_MODELS,
    DEFAULT_MODEL_ID,
    effectivePricing,
    getModel,
    getModelsForPDF,
    getModelsForQuickFilter,
    getModelsByProvider,
    providerForModel,
    supportsAdaptiveThinkingByApiId,
  };
}

// ES module exports
export {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  effectivePricing,
  getModel,
  getModelsByProvider,
  getModelsForPDF,
  getModelsForQuickFilter,
  MODEL_REGISTRY,
  providerForModel,
  supportsAdaptiveThinkingByApiId,
};
