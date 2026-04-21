// Fallback JSON extractor for LLM outputs that wrap the payload in prose or
// markdown fences. Used only when the provider did not return native
// structured output (`result.structured` is undefined). With provider-native
// structured output + strict schemas, all three providers produce clean JSON,
// so this path is a belt-and-suspenders safety net.
//
// The old implementation used `/(\[[\s\S]*\]|\{[\s\S]*\})/` which is greedy:
// on `{"a":1} text {"b":2}` it returned the whole span (unparseable). This
// implementation does a proper brace-depth scan, respecting strings and
// escapes, and returns the first balanced JSON object or array.
export function extractJsonFromLlmOutput(text) {
  if (!text || typeof text !== 'string') return text;

  // Strip markdown code fences if present.
  const cleaned = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  const balanced = findFirstBalancedJson(cleaned);
  return balanced ?? cleaned;
}

// Walk the string character-by-character, tracking nesting depth for `{}` and
// `[]` pairs. Skip over string literals (handling backslash escapes) so that
// braces inside strings don't affect depth. Return the first balanced span
// starting with `{` or `[`, or null if no balanced span is found.
function findFirstBalancedJson(s) {
  let startIdx = -1;
  let opener = '';

  // Find the first `{` or `[` outside a string.
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '[') {
      startIdx = i;
      opener = c;
      break;
    }
  }
  if (startIdx === -1) return null;

  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let i = startIdx;

  while (i < s.length) {
    const c = s[i];
    if (inString) {
      if (c === '\\') {
        i += 2; // skip escape + next char
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === opener) {
      depth += 1;
    } else if (c === closer) {
      depth -= 1;
      if (depth === 0) {
        return s.slice(startIdx, i + 1);
      }
    }
    i += 1;
  }
  // Unbalanced — no complete JSON span found.
  return null;
}
