export function buildAnthropicRequest({ model, prompt, structuredOutput, maxTokens = 4096 }) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (structuredOutput) {
    body.tools = [
      {
        name: structuredOutput.name,
        description: structuredOutput.description || '',
        input_schema: structuredOutput.schema,
      },
    ];
    body.tool_choice = { type: 'tool', name: structuredOutput.name };
  }
  return {
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body,
  };
}

export function parseAnthropicResponse(response) {
  const out = {
    text: '',
    tokensIn: response.usage?.input_tokens ?? 0,
    tokensOut: response.usage?.output_tokens ?? 0,
  };
  const content = response.content ?? [];
  for (const part of content) {
    if (part.type === 'text') {
      out.text += part.text;
    } else if (part.type === 'tool_use') {
      out.structured = part.input;
    }
  }
  return out;
}
