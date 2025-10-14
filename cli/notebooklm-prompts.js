const fs = require('fs').promises;
const path = require('path');

/**
 * NotebookLM Prompt Utilities
 *
 * Extracts custom prompts from NOTEBOOKLM_PROMPTS.md based on podcast duration.
 * These prompts guide NotebookLM's audio generation to create expert-level
 * technical podcasts with proper citation practices.
 */

/**
 * Parse NOTEBOOKLM_PROMPTS.md and extract prompts for all durations
 * @returns {Promise<Object>} - Map of duration to prompt text (e.g., { '5min': '...', '10min': '...', ... })
 */
async function parseNotebookLMPrompts() {
  const promptsFile = path.join(__dirname, '..', 'NOTEBOOKLM_PROMPTS.md');

  try {
    const content = await fs.readFile(promptsFile, 'utf-8');
    const prompts = {};

    // Extract each duration's prompt section
    // Format in file: ## X Minutes - Title\n\n### Xmin Prompt\n\n```text\n[prompt content]\n```
    const durations = ['5', '10', '15', '20', '30'];

    for (const duration of durations) {
      // Match pattern: ### Xmin Prompt\n\n```text\n[content]\n```
      const promptPattern = new RegExp(
        `###\\s*${duration}min\\s+Prompt\\s*\\n\\s*\\n\\s*\`\`\`text\\s*\\n([\\s\\S]*?)\\n\`\`\``,
        'i'
      );

      const match = content.match(promptPattern);
      if (match && match[1]) {
        // Extract prompt text and trim whitespace
        const promptText = match[1].trim();
        prompts[`${duration}min`] = promptText;
      }
    }

    // Verify we found all prompts
    if (Object.keys(prompts).length !== 5) {
      console.warn(`Warning: Only found ${Object.keys(prompts).length}/5 prompts in NOTEBOOKLM_PROMPTS.md`);
    }

    return prompts;

  } catch (error) {
    throw new Error(`Failed to parse NOTEBOOKLM_PROMPTS.md: ${error.message}`);
  }
}

/**
 * Extract duration from NotebookLM filename
 * @param {string} filename - e.g., "2025-10-13_notebooklm_30min.md" or full path
 * @returns {string} - Duration string (e.g., "30min") or null if not found
 */
function extractDurationFromFilename(filename) {
  // Get just the filename if full path provided
  const basename = path.basename(filename);

  // Match pattern: _XXmin.md or _XXmin
  const match = basename.match(/_(\d+min)/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Get the appropriate prompt for a given NotebookLM document
 * @param {string} notebooklmFilePath - Path to NotebookLM document (e.g., "/path/to/2025-10-13_notebooklm_30min.md")
 * @returns {Promise<string>} - The custom prompt text for audio generation
 */
async function getPromptForFile(notebooklmFilePath) {
  // Extract duration from filename
  const duration = extractDurationFromFilename(notebooklmFilePath);

  if (!duration) {
    throw new Error(`Could not extract duration from filename: ${notebooklmFilePath}`);
  }

  // Parse all prompts
  const prompts = await parseNotebookLMPrompts();

  // Get prompt for this duration
  const prompt = prompts[duration];

  if (!prompt) {
    // Fall back to 20min if duration not found
    console.warn(`No prompt found for duration "${duration}", falling back to 20min`);
    return prompts['20min'] || '';
  }

  return prompt;
}

/**
 * Get all available prompts
 * @returns {Promise<Object>} - Map of all durations to prompts
 */
async function getAllPrompts() {
  return await parseNotebookLMPrompts();
}

/**
 * Extract just the "What should the AI hosts focus on" text from a prompt
 * This is the portion that goes into the customization textarea
 * @param {string} fullPrompt - The complete prompt from NOTEBOOKLM_PROMPTS.md
 * @returns {string} - The focus guidance text
 */
function extractFocusText(fullPrompt) {
  // The prompts in NOTEBOOKLM_PROMPTS.md are structured as:
  // 1. Opening instruction
  // 2. Structure section
  // 3. Focus/emphasis section
  // 4. Citation requirements
  //
  // For the "focus" textarea, we want the entire prompt as it provides comprehensive guidance
  // The full prompt is appropriate for the focus field
  return fullPrompt;
}

module.exports = {
  parseNotebookLMPrompts,
  extractDurationFromFilename,
  getPromptForFile,
  getAllPrompts,
  extractFocusText
};
