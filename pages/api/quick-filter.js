const { MODEL_REGISTRY } = require('../../utils/models.js');

// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Function to call different AI models for quick filtering
async function callAIModel(modelId, prompt) {
    const modelConfig = MODEL_REGISTRY[modelId];

    if (!modelConfig) {
        throw new Error(`Unsupported model: ${modelId}`);
    }

    const { apiId, provider } = modelConfig;

    switch (provider) {
        case 'Anthropic':
            return await callClaude(apiId, prompt);
        case 'OpenAI':
            return await callOpenAI(apiId, prompt);
        case 'Google':
            return await callGemini(apiId, prompt);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

// Claude API call
async function callClaude(modelName, prompt) {
    if (!process.env.CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is not set');
    }

    const requestBody = {
        model: modelName,
        max_tokens: 1000,  // Smaller for quick filtering
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending filter request to Anthropic:', { model: modelName, promptLength: prompt.length });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error('Anthropic API Error:', response.status, responseText);
        throw new Error(`Anthropic API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    return data.content[0].text;
}

// OpenAI API call
async function callOpenAI(modelName, prompt) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const requestBody = {
        model: modelName,
        max_completion_tokens: 1000,  // Smaller for quick filtering
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending filter request to OpenAI:', { model: modelName, promptLength: prompt.length });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error('OpenAI API Error:', response.status, responseText);
        throw new Error(`OpenAI API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected OpenAI response format:', data);
        throw new Error('Unexpected response format from OpenAI API');
    }

    return data.choices[0].message.content;
}

// Google Gemini API call
async function callGemini(modelName, prompt) {
    if (!process.env.GOOGLE_AI_API_KEY) {
        throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            maxOutputTokens: 1000,  // Smaller for quick filtering
        }
    };

    console.log('Sending filter request to Google AI:', { model: modelName, promptLength: prompt.length });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error('Google AI API Error:', response.status, responseText);
        throw new Error(`Google AI API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
        console.error('Unexpected Google AI response format:', data);
        throw new Error('Unexpected response format from Google AI API');
    }

    return data.candidates[0].content.parts[0].text;
}

// Function to validate filter response structure
function validateFilterResponse(responseText, expectedCount) {
    try {
        const parsed = JSON.parse(responseText);

        if (!Array.isArray(parsed)) {
            return { isValid: false, errors: ['Response is not an array'] };
        }

        const errors = [];

        // Check if we have the right number of responses
        if (parsed.length !== expectedCount) {
            errors.push(`Expected ${expectedCount} verdicts, got ${parsed.length}`);
        }

        // Validate each verdict
        const validVerdicts = ['YES', 'NO', 'MAYBE'];
        parsed.forEach((item, index) => {
            if (typeof item.paperIndex !== 'number') {
                errors.push(`Item ${index}: paperIndex is not a number`);
            }
            if (!validVerdicts.includes(item.verdict)) {
                errors.push(`Item ${index}: verdict must be YES, NO, or MAYBE (got: ${item.verdict})`);
            }
        });

        return { isValid: errors.length === 0, errors };

    } catch (e) {
        return { isValid: false, errors: ['Invalid JSON: ' + e.message] };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { papers, password, model, correctionPrompt } = req.body;

    // Check password
    if (!checkPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        let prompt;

        // Use correction prompt if provided, otherwise generate normal filtering prompt
        if (correctionPrompt) {
            prompt = correctionPrompt;
        } else {
            prompt = `You are a research assistant doing quick relevance screening of academic papers.

For each paper below, determine if it is potentially relevant to the user's research interests.
Respond with ONLY: YES (clearly relevant), NO (clearly not relevant), or MAYBE (possibly relevant, needs closer look).

Papers to screen:
${papers.map((p, idx) => `Paper ${idx + 1}:
Title: ${p.title}
Abstract: ${p.abstract || 'No abstract available'}`).join('\n\n')}

IMPORTANT:
- Be inclusive rather than exclusive - when in doubt, choose MAYBE over NO
- Only mark NO for papers clearly outside the research area
- Consider interdisciplinary connections
- Use both title and abstract to make your determination

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "verdict": "YES"
  },
  {
    "paperIndex": 2,
    "verdict": "NO"
  },
  {
    "paperIndex": 3,
    "verdict": "MAYBE"
  }
]

Your entire response MUST ONLY be a single, valid JSON array.`;
        }

        let responseText = await callAIModel(model, prompt);

        // Clean up response text (remove markdown formatting if present)
        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        // Always validate response structure (not just on parse failure)
        const validation = validateFilterResponse(cleanedText, papers.length);

        // If validation fails and this isn't already a correction attempt, try to correct
        if (!validation.isValid && !correctionPrompt) {
            console.log('Initial filter response validation failed:', validation.errors);

            // Build correction prompt with specific errors
            const correctionRequest = `The previous response had formatting/structure errors:
${validation.errors.join('\n')}

Original response:
${cleanedText}

Please provide a corrected response with exactly ${papers.length} filter verdicts.
Each item must have: paperIndex (number), verdict ("YES", "NO", or "MAYBE").

Your entire response MUST ONLY be a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "verdict": "YES"
  }
]`;

            // Try correction
            const correctedResponse = await callAIModel(model, correctionRequest);
            responseText = correctedResponse;
            cleanedText = correctedResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        }

        let verdicts;
        try {
            verdicts = JSON.parse(cleanedText);

            // Final validation even after correction
            const finalValidation = validateFilterResponse(cleanedText, papers.length);
            if (!finalValidation.isValid) {
                console.warn('Filter response still invalid after correction:', finalValidation.errors);
            }

        } catch (parseError) {
            // If this is a correction attempt that still failed, return the raw response for debugging
            if (correctionPrompt) {
                return res.status(200).json({
                    verdicts: [],
                    rawResponse: responseText,
                    error: `Correction parsing failed: ${parseError.message}`
                });
            }
            throw parseError;
        }

        // Return both the parsed verdicts and the raw response
        res.status(200).json({
            verdicts,
            rawResponse: responseText
        });

    } catch (error) {
        console.error('Error filtering papers:', error);
        res.status(500).json({
            error: 'Failed to filter papers',
            details: error.message
        });
    }
}