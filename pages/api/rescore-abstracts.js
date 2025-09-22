const { MODEL_REGISTRY } = require('../../utils/models.js');

// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Function to call different AI models
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
        max_tokens: 5000,
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending rescore request to Anthropic:', { model: modelName, promptLength: prompt.length });

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
        max_completion_tokens: 5000,
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending rescore request to OpenAI:', { model: modelName, promptLength: prompt.length });

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
            maxOutputTokens: 5000,
        }
    };

    console.log('Sending rescore request to Google AI:', { model: modelName, promptLength: prompt.length });

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

// Function to validate rescore response structure
function validateRescoreResponse(responseText, expectedCount) {
    try {
        const parsed = JSON.parse(responseText);

        if (!Array.isArray(parsed)) {
            return { isValid: false, errors: ['Response is not an array'] };
        }

        const errors = [];

        // Check if we have the right number of rescores
        if (parsed.length !== expectedCount) {
            errors.push(`Expected ${expectedCount} rescores, got ${parsed.length}`);
        }

        // Validate each rescore object
        parsed.forEach((item, index) => {
            if (typeof item.paperIndex !== 'number') {
                errors.push(`Item ${index}: paperIndex is not a number`);
            }
            if (typeof item.adjustedScore !== 'number' || item.adjustedScore < 0 || item.adjustedScore > 10) {
                errors.push(`Item ${index}: adjustedScore is not a valid number (0-10)`);
            }
            if (typeof item.adjustmentReason !== 'string' || item.adjustmentReason.length < 10) {
                errors.push(`Item ${index}: adjustmentReason is missing or too short`);
            }
            if (typeof item.confidence !== 'string' || !['HIGH', 'MEDIUM', 'LOW'].includes(item.confidence)) {
                errors.push(`Item ${index}: confidence must be HIGH, MEDIUM, or LOW`);
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

    const { papers, scoringCriteria, password, model, correctionPrompt } = req.body;

    // Check password
    if (!checkPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        let prompt;

        // Use correction prompt if provided, otherwise generate normal rescoring prompt
        if (correctionPrompt) {
            prompt = correctionPrompt;
        } else {
            prompt = `You are a research assistant performing a SECOND-PASS REVIEW of already-scored academic papers to ensure consistency and accuracy.

RESEARCH INTERESTS:
${scoringCriteria}

IMPORTANT CONTEXT:
These papers have already been scored once. Your task is to review the scores AS A GROUP to:
1. Identify any papers that seem mis-scored relative to the others
2. Check for scoring inconsistencies (similar papers with very different scores)
3. Adjust scores to ensure fair relative ranking
4. Consider if complex criteria were properly applied

PAPERS TO REVIEW (with their initial scores and justifications):
${papers.map((p, idx) => `
Paper ${idx + 1}:
Title: ${p.title}
Abstract: ${p.abstract}
Initial Score: ${p.initialScore}/10
Initial Justification: ${p.initialJustification}
`).join('\n')}

SCORING APPROACH (same as initial scoring):
Papers are scored on two dimensions:
- RESEARCH ALIGNMENT (0-10): How well it matches the specific research interests
- PAPER QUALITY (0-10): How impactful/well-executed the work is
- FINAL SCORE = (Research Alignment × 0.5) + (Paper Quality × 0.5)

REVIEW INSTRUCTIONS:
1. Compare all papers against each other to identify relative ranking issues
2. Look for papers that seem over-scored or under-scored compared to similar papers
3. Consider if the initial scoring properly understood complex research criteria
4. Adjust scores to create a fair and consistent ranking
5. Most adjustments should be small (±0.5 to ±1.5 points)
6. Only make large adjustments (±2.0+ points) if clearly justified
7. Papers can keep their original score if it seems appropriate

For each paper, provide:
- adjustedScore: The new score after review (can be same as initial)
- adjustmentReason: Brief explanation of why you adjusted (or kept) the score
- confidence: Your confidence in this adjustment (HIGH/MEDIUM/LOW)

COMPARATIVE ANALYSIS GUIDANCE:
- If two papers address similar topics, their scores should reflect their relative quality
- If a paper is clearly superior to another in the batch, it should score higher
- Consider the full score distribution - avoid clustering all scores too closely
- Remember that scores near 0 or 10 should be rare

USE DECIMAL PRECISION: Score papers as 1.9, 5.2, 6.7, etc. Use the full 0-10 scale.

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "adjustedScore": 6.5,
    "adjustmentReason": "Initially over-scored; similar methodology to Paper 3 but less novel findings",
    "confidence": "HIGH"
  }
]

Your entire response MUST ONLY be a single, valid JSON array. DO NOT respond with anything other than a single, valid JSON array.`;
        }

        let responseText = await callAIModel(model, prompt);

        // Clean up response text (remove markdown formatting if present)
        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        // Always validate response structure (not just on parse failure)
        const validation = validateRescoreResponse(cleanedText, papers.length);

        // If validation fails and this isn't already a correction attempt, try to correct
        if (!validation.isValid && !correctionPrompt) {
            console.log('Initial rescore response validation failed:', validation.errors);

            // Build correction prompt with specific errors
            const correctionRequest = `The previous response had formatting/structure errors:
${validation.errors.join('\n')}

Original response:
${cleanedText}

Please provide a corrected response with exactly ${papers.length} paper rescores.
Each item must have: paperIndex (number), adjustedScore (0.0-10.0), adjustmentReason (string), confidence (HIGH/MEDIUM/LOW).

Your entire response MUST ONLY be a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "adjustedScore": 5.5,
    "adjustmentReason": "Kept original score as it accurately reflects the paper's relevance",
    "confidence": "HIGH"
  }
]`;

            // Try correction
            const correctedResponse = await callAIModel(model, correctionRequest);
            responseText = correctedResponse;
            cleanedText = correctedResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        }

        let rescores;
        try {
            rescores = JSON.parse(cleanedText);

            // Final validation even after correction
            const finalValidation = validateRescoreResponse(cleanedText, papers.length);
            if (!finalValidation.isValid) {
                console.warn('Rescore response still invalid after correction:', finalValidation.errors);
            }

        } catch (parseError) {
            // If this is a correction attempt that still failed, return the raw response for debugging
            if (correctionPrompt) {
                return res.status(200).json({
                    rescores: [],
                    rawResponse: responseText,
                    error: `Correction parsing failed: ${parseError.message}`
                });
            }
            throw parseError;
        }

        // Return both the parsed rescores and the raw response
        res.status(200).json({
            rescores,
            rawResponse: responseText
        });

    } catch (error) {
        console.error('Error rescoring abstracts:', error);
        res.status(500).json({
            error: 'Failed to rescore abstracts',
            details: error.message
        });
    }
}