// Centralized model configuration
// This file defines all available AI models and their capabilities
//
// Pricing fields (inputPerMTok / outputPerMTok) are USD per million tokens,
// list price, snapshot 2026-07. `null` means the price was not verifiable at
// snapshot time — never guess. Update alongside docs/concepts/model-selection.md
// and docs/getting-started/api-keys.md (see CLAUDE.md doc-trigger table).

// Model registry with actual API model IDs
const MODEL_REGISTRY = {
  // User-facing ID -> Actual API model ID mapping (+ pricing)

  // Anthropic — current
  'claude-opus-4-8': {
    apiId: 'claude-opus-4-8',
    provider: 'Anthropic',
    inputPerMTok: 5,
    outputPerMTok: 25,
  },
  'claude-opus-4.7': {
    apiId: 'claude-opus-4-7',
    provider: 'Anthropic',
    inputPerMTok: 5,
    outputPerMTok: 25,
  },
  'claude-opus-4.6': {
    apiId: 'claude-opus-4-6',
    provider: 'Anthropic',
    inputPerMTok: 5,
    outputPerMTok: 25,
  },
  'claude-sonnet-5': {
    apiId: 'claude-sonnet-5',
    provider: 'Anthropic',
    inputPerMTok: 3,
    outputPerMTok: 15,
  },
  'claude-sonnet-4.6': {
    apiId: 'claude-sonnet-4-6',
    provider: 'Anthropic',
    inputPerMTok: 3,
    outputPerMTok: 15,
  },
  'claude-haiku-4.5': {
    apiId: 'claude-haiku-4-5',
    provider: 'Anthropic',
    inputPerMTok: 1,
    outputPerMTok: 5,
  },

  // OpenAI — GPT-5.6 family (GA 2026-07-09)
  'gpt-5.6-sol': {
    apiId: 'gpt-5.6-sol',
    provider: 'OpenAI',
    inputPerMTok: 5,
    outputPerMTok: 30,
  },
  'gpt-5.6-terra': {
    apiId: 'gpt-5.6-terra',
    provider: 'OpenAI',
    inputPerMTok: 2.5,
    outputPerMTok: 15,
  },
  'gpt-5.6-luna': {
    apiId: 'gpt-5.6-luna',
    provider: 'OpenAI',
    inputPerMTok: 1,
    outputPerMTok: 6,
  },

  // OpenAI — GPT-5.4 family (previous generation, still served)
  'gpt-5.4': {
    apiId: 'gpt-5.4',
    provider: 'OpenAI',
    inputPerMTok: 2.5,
    outputPerMTok: 15,
  },
  'gpt-5.4-mini': {
    apiId: 'gpt-5.4-mini',
    provider: 'OpenAI',
    inputPerMTok: 0.75,
    outputPerMTok: 4.5,
  },
  'gpt-5.4-nano': {
    apiId: 'gpt-5.4-nano',
    provider: 'OpenAI',
    inputPerMTok: 0.2,
    outputPerMTok: 1.25,
  },

  // Google — Gemini 3.5 (GA)
  'gemini-3.5-flash': {
    apiId: 'gemini-3.5-flash',
    provider: 'Google',
    inputPerMTok: null,
    outputPerMTok: null,
  },

  // Google — Gemini 3.x (mixed preview / GA)
  'gemini-3.1-pro': {
    apiId: 'gemini-3.1-pro-preview',
    provider: 'Google',
    inputPerMTok: 2,
    outputPerMTok: 12,
  },
  'gemini-3-flash': {
    apiId: 'gemini-3-flash-preview',
    provider: 'Google',
    inputPerMTok: 0.5,
    outputPerMTok: 3,
  },
  // Gemini 3.1 Flash-Lite reached GA (`gemini-3.1-flash-lite`, version
  // `3.1-flash-lite-05-2026`) on 2026-05; the old `-preview` apiId alias
  // has since been shut down upstream (per Google model docs, 2026-07).
  'gemini-3.1-flash-lite': {
    apiId: 'gemini-3.1-flash-lite',
    provider: 'Google',
    inputPerMTok: 0.25,
    outputPerMTok: 1.5,
  },

  // Google — Gemini 2.5 stable tier
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
const DEFAULT_MODEL_ID = 'gemini-3.5-flash';

// Model metadata for UI and capabilities
const AVAILABLE_MODELS = [
  // --- Anthropic: current ---
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false, // Too expensive for simple filtering
    description: 'Most capable model; frontier reasoning and coding, adaptive thinking, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-opus-4.7',
    name: 'Claude Opus 4.7',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description:
      'Previous Opus flagship; step-change in agentic coding over 4.6, adaptive thinking, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Earlier Opus generation; 1M context, top-tier reasoning and coding',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Best combination of speed and intelligence; adaptive thinking, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous-generation Sonnet; strong speed/intelligence balance, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fastest model with near-frontier intelligence; cost-effective for filtering',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },

  // --- OpenAI: GPT-5.6 family ---
  {
    id: 'gpt-5.6-sol',
    name: 'OpenAI GPT-5.6 Sol',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Frontier model for agentic, coding, and professional workflows',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'OpenAI GPT-5.6 Terra',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Balanced GPT-5.6 model; strong capability at mid-tier pricing',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'OpenAI GPT-5.6 Luna',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fastest, cheapest GPT-5.6 model; good for high-volume filtering',
    apiKeyEnv: 'OPENAI_API_KEY',
  },

  // --- OpenAI: GPT-5.4 family (previous generation, still served) ---
  {
    id: 'gpt-5.4',
    name: 'OpenAI GPT-5.4',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description:
      'Previous-generation flagship for agentic, coding, and professional workflows; 1M context',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'OpenAI GPT-5.4 Mini',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Balanced speed and capability; 400k context',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5.4-nano',
    name: 'OpenAI GPT-5.4 Nano',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Cheapest GPT-5.4-class model for high-volume filtering; 400k context',
    apiKeyEnv: 'OPENAI_API_KEY',
  },

  // --- Google: Gemini 3.5 (GA) ---
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: "Google's most intelligent GA model; frontier performance at Flash speed",
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },

  // --- Google: Gemini 3.x ---
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro (Preview)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description:
      'Most powerful Google model; advanced reasoning (Preview — subject to upstream churn)',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash (Preview)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description:
      'Frontier-class performance at Flash speed and pricing (Preview — subject to upstream churn)',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fast and budget-friendly 3.x model; GA',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },

  // --- Google: Gemini 2.5 stable tier ---
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Stable flagship with deep reasoning and coding',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Stable best price-performance model for reasoning tasks',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Stable fastest and most budget-friendly multimodal model',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
];

// Helper functions
const getModel = (modelId) => {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
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
    getModel,
    getModelsForPDF,
    getModelsForQuickFilter,
    getModelsByProvider,
  };
}

// ES module exports
export {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  getModel,
  getModelsByProvider,
  getModelsForPDF,
  getModelsForQuickFilter,
  MODEL_REGISTRY,
};
