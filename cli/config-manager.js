// cli/config-manager.js
const path = require('path');
const { ensureConfigDir, readJSONFile, writeJSONFile } = require('./utils');

// Default configuration template
const DEFAULT_CONFIG = {
  // Search parameters
  categories: ['cs.AI', 'cs.LG'],
  daysBack: 7,

  // Scoring criteria
  scoringCriteria:
    'Papers that advance machine learning methods, especially in deep learning, neural networks, or optimization algorithms.',

  // Models
  filterModel: 'claude-3.5-haiku',
  scoringModel: 'claude-sonnet-4.5',
  postProcessingModel: 'gemini-2.5-flash',
  pdfModel: 'gemini-2.5-flash',
  notebookLMModel: 'gemini-2.5-pro',

  // Processing options
  enableQuickFilter: true,
  categoriesToScore: ['YES', 'MAYBE'],
  enableScorePostProcessing: true,

  // Batch sizes
  filterBatchSize: 10,
  scoringBatchSize: 3,
  postProcessingBatchSize: 5,

  // Thresholds
  minAbstractScore: 7.0,
  maxPapersForPDF: 10,

  // Retry/correction settings
  maxRetries: 3,
  maxCorrections: 1,

  // NotebookLM settings
  notebookLMDuration: 20,
};

class ConfigManager {
  constructor() {
    this.configFile = null;
    this.activeConfigFile = null;
  }

  async init() {
    const configDir = await ensureConfigDir();
    this.configFile = path.join(configDir, 'configs.json');
    this.activeConfigFile = path.join(configDir, 'active-config.json');
  }

  /**
   * Load all saved configurations
   */
  async loadAll() {
    const configs = await readJSONFile(this.configFile);
    return configs || {};
  }

  /**
   * Save a configuration with a given name
   */
  async save(name, config) {
    const configs = await this.loadAll();
    configs[name] = {
      ...config,
      savedAt: new Date().toISOString(),
    };
    await writeJSONFile(this.configFile, configs);
    return configs[name];
  }

  /**
   * Load a specific configuration by name
   */
  async load(name) {
    const configs = await this.loadAll();
    if (!configs[name]) {
      throw new Error(`Configuration "${name}" not found`);
    }
    return configs[name];
  }

  /**
   * Delete a configuration
   */
  async delete(name) {
    const configs = await this.loadAll();
    if (!configs[name]) {
      throw new Error(`Configuration "${name}" not found`);
    }
    delete configs[name];
    await writeJSONFile(this.configFile, configs);

    // If this was the active config, clear it
    const activeConfig = await this.getActive();
    if (activeConfig && activeConfig.name === name) {
      await this.clearActive();
    }
  }

  /**
   * List all configuration names
   */
  async list() {
    const configs = await this.loadAll();
    return Object.keys(configs);
  }

  /**
   * Set the active configuration
   */
  async setActive(name) {
    const config = await this.load(name);
    await writeJSONFile(this.activeConfigFile, { name, config });
    return config;
  }

  /**
   * Get the active configuration
   */
  async getActive() {
    const active = await readJSONFile(this.activeConfigFile);
    return active;
  }

  /**
   * Clear the active configuration
   */
  async clearActive() {
    await writeJSONFile(this.activeConfigFile, {});
  }

  /**
   * Get configuration to use (from name, active, or default)
   */
  async getConfig(nameOrNull) {
    if (nameOrNull) {
      // Load specific config by name
      return await this.load(nameOrNull);
    }

    // Try to get active config
    const active = await this.getActive();
    if (active && active.config) {
      return active.config;
    }

    // Return default config
    return DEFAULT_CONFIG;
  }

  /**
   * Get the default configuration template
   */
  getDefault() {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Validate configuration
   */
  validate(config) {
    const errors = [];

    if (!config.categories || config.categories.length === 0) {
      errors.push('At least one category must be specified');
    }

    if (!config.scoringCriteria || config.scoringCriteria.trim() === '') {
      errors.push('Scoring criteria must be provided');
    }

    if (config.daysBack < 1 || config.daysBack > 365) {
      errors.push('daysBack must be between 1 and 365');
    }

    if (config.minAbstractScore < 0 || config.minAbstractScore > 10) {
      errors.push('minAbstractScore must be between 0 and 10');
    }

    if (config.maxPapersForPDF < 1) {
      errors.push('maxPapersForPDF must be at least 1');
    }

    return errors;
  }

  /**
   * Merge partial config with defaults
   */
  mergeWithDefaults(partial) {
    return {
      ...DEFAULT_CONFIG,
      ...partial,
    };
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG };
