// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Function to call different AI models
async function callAIModel(model, prompt) {
    switch (model) {
        case 'claude-sonnet-4':
            return await callClaude('claude-sonnet-4-20250514', prompt);

        case 'claude-opus-4.1':
            return await callClaude('claude-opus-4-1-20250805', prompt);

        case 'gpt-5':
            return await callOpenAI('gpt-5', prompt);

        case 'gpt-5-mini':
            return await callOpenAI('gpt-5-mini', prompt);

        case 'gpt-5-nano':
            return await callOpenAI('gpt-5-nano', prompt);

        case 'gemini-2.5-flash':
            return await callGemini('gemini-2.5-flash', prompt);

        case 'gemini-2.5-pro':
            return await callGemini('gemini-2.5-pro', prompt);

        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

// Claude API call
async function callClaude(modelName, prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// OpenAI API call
async function callOpenAI(modelName, prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Google Gemini API call
async function callGemini(modelName, prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                maxOutputTokens: 1000,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { papers, scoringCriteria, password, model = 'claude-sonnet-4', correctionPrompt } = req.body;

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
            prompt = `You are a research assistant scoring academic paper abstracts for relevance.

Scoring Criteria:
${scoringCriteria}

For each paper below, provide a relevance score from 1-10 and a brief (2-3 sentence) justification.

Papers to score:
${papers.map((p, idx) => `Paper ${idx + 1}: Title: ${p.title} Abstract: ${p.abstract}`).join('\n')}

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "paperIndex": number,
    "score": number,
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