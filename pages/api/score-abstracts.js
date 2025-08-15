// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Function to call different AI models
async function callAIModel(model, prompt) {
    switch (model) {
        case 'claude-opus-4.1':
            return await callClaude('claude-opus-4-1-20250805', prompt);

        case 'claude-sonnet-4':
            return await callClaude('claude-sonnet-4-20250514', prompt);

        case 'gpt-5':
            return await callOpenAI('gpt-5', prompt);

        case 'gpt-5-mini':
            return await callOpenAI('gpt-5-mini', prompt);

        case 'gpt-5-nano':
            return await callOpenAI('gpt-5-nano', prompt);

        case 'gemini-2.5-pro':
            return await callGemini('gemini-2.5-pro', prompt);

        case 'gemini-2.5-flash':
            return await callGemini('gemini-2.5-flash', prompt);

        case 'gemini-2.5-flash-lite':
            return await callGemini('gemini-2.5-flash-lite', prompt);

        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

// Claude API call
async function callClaude(modelName, prompt) {
    if (!process.env.CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is not set');
    }

    const requestBody = {
        model: modelName,
        max_tokens: 5000,
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending request to Anthropic:', { model: modelName, promptLength: prompt.length });

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

    // Add debugging
    console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('OpenAI API Key format:', process.env.OPENAI_API_KEY?.slice(0, 10) + '...');
    console.log('Model name:', modelName);

    const requestBody = {
        model: modelName,
        max_tokens: 5000,
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending request to OpenAI:', { model: modelName, promptLength: prompt.length });

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

    // Add debugging
    console.log('Google AI API Key exists:', !!process.env.GOOGLE_AI_API_KEY);
    console.log('Google AI API Key format:', process.env.GOOGLE_AI_API_KEY?.slice(0, 10) + '...');
    console.log('Model name:', modelName);

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            maxOutputTokens: 5000,
        }
    };

    console.log('Sending request to Google AI:', { model: modelName, promptLength: prompt.length });

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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { papers, scoringCriteria, password, model, correctionPrompt } = req.body;

    // Check password
    if (!checkPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        let prompt;

        // Use correction prompt if provided, otherwise generate normal scoring prompt
        if (correctionPrompt) {
            prompt = correctionPrompt;
        } else {
            prompt = `You are a research assistant scoring academic paper abstracts for relevance using a precise 0.0-10.0 scale.

Research Interests:
${scoringCriteria}

For each paper below, provide a relevance score from 0.0-10.0 (one decimal place) and a brief (2-3 sentence) justification.

Papers to score:
${papers.map((p, idx) => `Paper ${idx + 1}: Title: ${p.title} Abstract: ${p.abstract}`).join('\n')}

SCORING RUBRIC:
- 9.0-10.0: Groundbreaking work that will change the field (extremely rare)
- 8.0-8.9: Significant methodological advance with clear practical impact
- 7.0-7.9: Solid contribution with novel insights, well-executed
- 6.0-6.9: Good work with some novelty, worth reading
- 4.0-5.9: Competent but incremental work, limited novelty
- 2.0-3.9: Weak connection to interests, poor execution or outdated
- 0.0-1.9: Irrelevant or fundamentally flawed

IMPORTANT: Be selective with high scores. Most academic papers are incremental work that should score 3-6. Reserve 8+ for truly outstanding contributions.

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "paperIndex": number,
    "score": number (0.0-10.0 with one decimal place),
    "justification": "string"
  }
]

Your entire response MUST ONLY be a single, valid JSON array. DO NOT respond with anything other than a single, valid JSON array.`;
        }

        const responseText = await callAIModel(model, prompt);

        // Clean up response text (remove markdown formatting if present)
        const cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let scores;
        try {
            scores = JSON.parse(cleanedText);
        } catch (parseError) {
            // If this is a correction attempt that still failed, return the raw response for debugging
            if (correctionPrompt) {
                return res.status(200).json({
                    scores: [],
                    rawResponse: responseText,
                    error: `Correction parsing failed: ${parseError.message}`
                });
            }
            throw parseError;
        }

        // Return both the parsed scores and the raw response
        res.status(200).json({
            scores,
            rawResponse: responseText
        });

    } catch (error) {
        console.error('Error scoring abstracts:', error);
        res.status(500).json({
            error: 'Failed to score abstracts',
            details: error.message
        });
    }
}