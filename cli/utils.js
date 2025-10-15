// cli/utils.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Get the config directory path (~/.aparture/)
 */
function getConfigDir() {
  return path.join(os.homedir(), '.aparture');
}

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  const configDir = getConfigDir();
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
  return configDir;
}

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Generate timestamp string for filenames
 */
function getTimestamp() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${date}_${time}`;
}

/**
 * Ensure reports directory exists
 */
async function ensureReportsDir(outputDir = './reports') {
  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Wait for a specified number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read JSON file with error handling
 */
async function readJSONFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
  }
}

/**
 * Write JSON file with error handling
 */
async function writeJSONFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getConfigDir,
  ensureConfigDir,
  formatDuration,
  getTimestamp,
  ensureReportsDir,
  sleep,
  readJSONFile,
  writeJSONFile,
  fileExists,
};
