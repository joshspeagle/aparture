import { extractJsonFromLlmOutput } from '../../../utils/json.js';

/**
 * Normalize a `callModel` result to a parsed JSON payload.
 * Prefers the provider's native structured output; falls back to parsing the
 * raw text field when structured output is absent.
 *
 * @param {{ structured?: unknown, text?: string } | null | undefined} result
 * @returns {any}
 */
export function extractParsed(result) {
  if (result?.structured !== undefined && result.structured !== null) {
    return result.structured;
  }
  try {
    const cleaned = extractJsonFromLlmOutput(result?.text ?? '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
