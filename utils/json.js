export function extractJsonFromLlmOutput(text) {
  if (!text || typeof text !== 'string') return text;

  // First clean markdown code block fences
  const cleaned = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Try to extract the JSON array or object if there's leading/trailing text
  const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    return match[0];
  }

  return cleaned;
}
