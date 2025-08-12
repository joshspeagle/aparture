// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Function to call different AI models for PDF analysis
async function callAIModelWithPDF(model, prompt, base64Data) {
    switch (model) {
        case 'claude-sonnet-4':
            return await callClaudeWithPDF('claude-sonnet-4-20250514', prompt, base64Data);

        case 'claude-opus-4.1':
            return await callClaudeWithPDF('claude-opus-4-1-20250805', prompt, base64Data);

        case 'gpt-5':
            return await callOpenAIWithPDF('gpt-5', prompt, base64Data);

        case 'gpt-5-mini':
            return await callOpenAIWithPDF('gpt-5-mini', prompt, base64Data);

        case 'gpt-5-nano':
            return await callOpenAIWithPDF('gpt-5-nano', prompt, base64Data);

        case 'gemini-2.5-flash':
            return await callGeminiWithPDF('gemini-2.5-flash', prompt, base64Data);

        case 'gemini-2.5-pro':
            return await callGeminiWithPDF('gemini-2.5-pro', prompt, base64Data);

        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

// Function to call AI models without PDF (for corrections)
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

// Claude API call with PDF
async function callClaudeWithPDF(modelName, prompt, base64Data) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 2000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: {
                                type: "base64",
                                media_type: "application/pdf",
                                data: base64Data,
                            },
                        },
                        {
                            type: "text",
                            text: prompt,
                        },
                    ],
                },
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// Claude API call without PDF (for corrections)
async function callClaude(modelName, prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// OpenAI API call with PDF
async function callOpenAIWithPDF(modelName, prompt, base64Data) {
    // OpenAI supports direct PDF uploads using the responses API
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelName,
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_file",
                            filename: "research_paper.pdf",
                            file_data: `data:application/pdf;base64,${base64Data}`
                        },
                        {
                            type: "input_text",
                            text: prompt
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.output_text;
}

// OpenAI API call without PDF (for corrections)
async function callOpenAI(modelName, prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Google Gemini API call with PDF  
async function callGeminiWithPDF(modelName, prompt, base64Data) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                maxOutputTokens: 2000,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Google Gemini API call without PDF (for corrections)
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
                maxOutputTokens: 2000,
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

    const { pdfUrl, scoringCriteria, originalScore, originalJustification, password, model = 'claude-sonnet-4', correctionPrompt } = req.body;

    // Check password
    if (!checkPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        let responseText;

        // If this is a correction call, use the correction prompt without PDF
        if (correctionPrompt) {
            responseText = await callAIModel(model, correctionPrompt);
        } else {
            // Download PDF for normal analysis
            const pdfResponse = await fetch(pdfUrl);
            if (!pdfResponse.ok) throw new Error(`Failed to download PDF: ${pdfResponse.status}`);

            const pdfBuffer = await pdfResponse.arrayBuffer();
            const base64Data = Buffer.from(pdfBuffer).toString('base64');

            const prompt = `Please analyze this research paper and provide an updated assessment.

CONTEXT FROM ABSTRACT ANALYSIS:
- Original Score (based on abstract only): ${originalScore}/10
- Original Justification: ${originalJustification}

SCORING CRITERIA:
${scoringCriteria}

Now that you have access to the full paper, please provide:

1. A comprehensive 3-5 paragraph technical summary of the paper's contents, methodology, and contributions
2. Key findings and results
3. Methodological innovations or notable techniques used
4. Potential limitations or areas for future work
5. A detailed relevance assessment that compares your full-paper analysis to the original abstract-based assessment
6. An updated relevance score (1-10) - explain whether you're raising, lowering, or maintaining the original score of ${originalScore}/10 and why

Format your response as a JSON object with these fields:
{
  "summary": "string",
  "keyFindings": "string",
  "methodology": "string", 
  "limitations": "string",
  "relevanceAssessment": "string - include comparison to original ${originalScore}/10 score and justification for any changes",
  "updatedScore": number
}

Your entire response MUST ONLY be a single, valid JSON object. DO NOT respond with anything other than a single, valid JSON object.`;

            responseText = await callAIModelWithPDF(model, prompt, base64Data);
        }

        // Clean up response text (remove markdown formatting if present)
        const cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let analysis;
        try {
            analysis = JSON.parse(cleanedText);
        } catch (parseError) {
            // If this is a correction attempt that still failed, return the raw response for debugging
            if (correctionPrompt) {
                return res.status(200).json({
                    analysis: null,
                    rawResponse: responseText,
                    error: `Correction parsing failed: ${parseError.message}`
                });
            }
            throw parseError;
        }

        // Return both the parsed analysis and the raw response
        res.status(200).json({
            analysis,
            rawResponse: responseText
        });

    } catch (error) {
        console.error('Error analyzing PDF:', error);
        res.status(500).json({
            error: 'Failed to analyze PDF',
            details: error.message
        });
    }
}