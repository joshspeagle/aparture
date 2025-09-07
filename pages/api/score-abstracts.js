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
        max_completion_tokens: 5000,
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

SCORING APPROACH:
Assess each paper on two dimensions, then combine using the formula below:

RESEARCH ALIGNMENT (0-10): How well does this match my specific research interests?
- 9-10: Directly addresses my core research areas with perfect fit
- 7-8: Strong overlap with stated interests
- 5-6: Moderate connection to research areas
- 3-4: Weak connection, peripherally related
- 0-2: Little to no connection to stated interests

PAPER QUALITY (0-10): How impactful/well-executed is this work?
- 9-10: Genuinely transformative work that will significantly advance the field
- 7-8: Significant methodological advance or major discovery with clear impact
- 5-6: Competent work, adequately executed using standard approaches
- 3-4: Incremental work with limited novelty
- 0-2: Poor execution, outdated, or fundamentally flawed

FINAL SCORE = (Research Alignment x 0.5) + (Paper Quality x 0.5)

IMPORTANT GUIDANCE:
- Be strict with Paper Quality scores - most competent work should score 4-6 on quality
- For Quality 7+: Ask "Does this introduce genuinely new methods or surprising findings?"
- For Quality 8+: Ask "Will this change how other researchers approach problems?"
- For Quality 9+: Ask "Will this be considered a landmark paper in 5-10 years?"
- Don't reward papers just for trendy buzzwords without genuine technical depth
- Keep in mind that papers are often less impressive than their abstracts suggest

USE DECIMAL PRECISION: Score papers as 1.9, 5.2, 6.7, etc. to create better discrimination. Use the full 0-10 scale.

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
