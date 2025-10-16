// Centralized model configuration
// This file defines all available AI models and their capabilities

// Model registry with actual API model IDs
const MODEL_REGISTRY = {
  // User-facing ID -> Actual API model ID mapping
  'claude-opus-4.1': {
    apiId: 'claude-opus-4-1-20250805',
    provider: 'Anthropic',
  },
  'claude-sonnet-4.5': {
    apiId: 'claude-sonnet-4-5-20250929',
    provider: 'Anthropic',
  },
  'claude-haiku-4.5': {
    apiId: 'claude-haiku-4-5-20251001',
    provider: 'Anthropic',
  },
  'gpt-5': {
    apiId: 'gpt-5',
    provider: 'OpenAI',
  },
  'gpt-5-mini': {
    apiId: 'gpt-5-mini',
    provider: 'OpenAI',
  },
  'gpt-5-nano': {
    apiId: 'gpt-5-nano',
    provider: 'OpenAI',
  },
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
  // Anthropic Models
  {
    id: 'claude-opus-4.1',
    name: 'Claude Opus 4.1',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false, // Too expensive for simple filtering
    description: 'Highest accuracy, best for complex analysis',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: false, // Too expensive for simple filtering
    description: 'Most intelligent, best for coding and complex agents',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fast, cost-effective, and intelligent',
    apiKeyEnv: 'CLAUDE_API_KEY',
  },

  // OpenAI Models
  {
    id: 'gpt-5',
    name: 'OpenAI GPT-5',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false, // Too expensive for simple filtering
    description: 'Highest accuracy, best for complex analysis',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5-mini',
    name: 'OpenAI GPT-5 Mini',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Balanced speed and capability',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-5-nano',
    name: 'OpenAI GPT-5 Nano',
    provider: 'OpenAI',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fast and cost-effective',
    apiKeyEnv: 'OPENAI_API_KEY',
  },

  // Google Models
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Highest accuracy, best for complex analysis',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: false,
    description: 'Balanced speed and capability',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'Google',
    supportsPDF: true,
    supportsQuickFilter: true,
    description: 'Fast and cost-effective',
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
  scoringModel: 'gemini-2.5-flash',
  pdfModel: 'gemini-2.5-pro',
};

// Model presets for different use cases
const MODEL_PRESETS = {
  budget: {
    filterModel: 'gemini-2.5-flash-lite',
    scoringModel: 'gemini-2.5-flash-lite',
    pdfModel: 'gemini-2.5-flash',
  },
  balanced: {
    filterModel: 'gemini-2.5-flash-lite',
    scoringModel: 'gemini-2.5-flash',
    pdfModel: 'gemini-2.5-pro',
  },
  quality: {
    filterModel: 'gpt-5-nano',
    scoringModel: 'claude-sonnet-4.5',
    pdfModel: 'claude-opus-4.1',
  },
  'google-free': {
    // For Google's free tier
    filterModel: 'gemini-2.5-flash-lite',
    scoringModel: 'gemini-2.5-flash',
    pdfModel: 'gemini-2.5-pro',
  },
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
    MODEL_PRESETS,
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
  MODEL_PRESETS,
  MODEL_REGISTRY,
};
