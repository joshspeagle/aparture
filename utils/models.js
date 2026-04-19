// Centralized model configuration
// This file defines all available AI models and their capabilities

// Model registry with actual API model IDs
const MODEL_REGISTRY = {
  // User-facing ID -> Actual API model ID mapping

  // Anthropic — current
  'claude-opus-4.7': {
    apiId: 'claude-opus-4-7',
    provider: 'Anthropic',
  },
  'claude-opus-4.6': {
    apiId: 'claude-opus-4-6',
    provider: 'Anthropic',
  },
  'claude-sonnet-4.6': {
    apiId: 'claude-sonnet-4-6',
    provider: 'Anthropic',
  },
  'claude-haiku-4.5': {
    apiId: 'claude-haiku-4-5',
    provider: 'Anthropic',
  },

  // Anthropic — legacy (still available, thinking supported via adaptive mode)
  'claude-opus-4.5': {
    apiId: 'claude-opus-4-5',
    provider: 'Anthropic',
  },
  'claude-opus-4.1': {
    apiId: 'claude-opus-4-1',
    provider: 'Anthropic',
  },
  'claude-sonnet-4.5': {
    apiId: 'claude-sonnet-4-5',
    provider: 'Anthropic',
  },
  'claude-haiku-3.5': {
    apiId: 'claude-3-5-haiku-20241022',
    provider: 'Anthropic',
  },

  // OpenAI — current GPT-5.4 family
  'gpt-5.4': {
    apiId: 'gpt-5.4',
    provider: 'OpenAI',
  },
  'gpt-5.4-mini': {
    apiId: 'gpt-5.4-mini',
    provider: 'OpenAI',
  },
  'gpt-5.4-nano': {
    apiId: 'gpt-5.4-nano',
    provider: 'OpenAI',
  },

  // Google — Gemini 3.x previews
  'gemini-3.1-pro': {
    apiId: 'gemini-3.1-pro-preview',
    provider: 'Google',
  },
  'gemini-3-flash': {
    apiId: 'gemini-3-flash-preview',
    provider: 'Google',
  },
  'gemini-3.1-flash-lite': {
    apiId: 'gemini-3.1-flash-lite-preview',
    provider: 'Google',
  },

  // Google — Gemini 2.5 stable tier
  'gemini-2.5-pro': {
    apiId: 'gemini-2.5-pro',
    provider: 'Google',
  },
  'gemini-2.5-flash': {
    apiId: 'gemini-2.5-flash',
    provider: 'Google',
  },
  'gemini-2.5-flash-lite': {
    apiId: 'gemini-2.5-flash-lite',
    provider: 'Google',
  },
};

// Model metadata for UI and capabilities
const AVAILABLE_MODELS = [
  // --- Anthropic: current ---
  {
    id: 'claude-opus-4.7',
    name: 'Claude Opus 4.7',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false, // Too expensive for simple filtering
    description:
      'Most capable model; step-change in agentic coding over 4.6, adaptive thinking, 1M context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous flagship; 1M context, top-tier reasoning and coding',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Best combination of speed and intelligence; 1M context',
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

  // --- Anthropic: legacy (still available) ---
  {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5 (Legacy)',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous-generation Opus; 200k context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-opus-4.1',
    name: 'Claude Opus 4.1 (Legacy)',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Earlier Opus generation; higher cost, 200k context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5 (Legacy)',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Previous-generation Sonnet; 200k context',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-haiku-3.5',
    name: 'Claude Haiku 3.5 (Legacy)',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Previous-generation Haiku; very cheap for filtering',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },

  // --- OpenAI: GPT-5.4 family ---
  {
    id: 'gpt-5.4',
    name: 'OpenAI GPT-5.4',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Frontier model for agentic, coding, and professional workflows; 1M context',
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

  // --- Google: Gemini 3.x previews ---
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro (Preview)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Most powerful Google model; advanced reasoning and agentic capabilities',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash (Preview)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Frontier-class performance at Flash speed and pricing',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite (Preview)',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fast and budget-friendly 3.x preview',
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
const DEFAULT_MODELS = {
  filterModel: 'gemini-2.5-flash-lite',
  scoringModel: 'gemini-3-flash',
  pdfModel: 'gemini-3.1-pro',
};

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MODEL_REGISTRY,
    AVAILABLE_MODELS,
    getModel,
    getModelsForPDF,
    getModelsForQuickFilter,
    getModelsByProvider,
    DEFAULT_MODELS,
  };
}

// ES module exports
export {
  AVAILABLE_MODELS,
  DEFAULT_MODELS,
  getModel,
  getModelsByProvider,
  getModelsForPDF,
  getModelsForQuickFilter,
  MODEL_REGISTRY,
};
