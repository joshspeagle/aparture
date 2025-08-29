// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Function to call different AI models for PDF analysis
async function callAIModelWithPDF(model, prompt, base64Data) {
    switch (model) {
        case 'claude-opus-4.1':
            return await callClaudeWithPDF('claude-opus-4-1-20250805', prompt, base64Data);

        case 'claude-sonnet-4':
            return await callClaudeWithPDF('claude-sonnet-4-20250514', prompt, base64Data);

        case 'gpt-5':
            return await callOpenAIWithPDF('gpt-5', prompt, base64Data);

        case 'gpt-5-mini':
            return await callOpenAIWithPDF('gpt-5-mini', prompt, base64Data);

        case 'gpt-5-nano':
            return await callOpenAIWithPDF('gpt-5-nano', prompt, base64Data);

        case 'gemini-2.5-pro':
            return await callGeminiWithPDF('gemini-2.5-pro', prompt, base64Data);

        case 'gemini-2.5-flash':
            return await callGeminiWithPDF('gemini-2.5-flash', prompt, base64Data);

        case 'gemini-2.5-flash-lite':
            return await callGeminiWithPDF('gemini-2.5-flash-lite', prompt, base64Data);

        default:
            throw new Error(`Unsupported model: ${model}`);
    }
}

// Function to call AI models without PDF (for corrections)
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

// Claude API call with PDF
async function callClaudeWithPDF(modelName, prompt, base64Data) {
    console.log('Sending request to Anthropic:', { model: modelName, promptLength: prompt.length });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 5000,
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
    console.log('Sending request to Anthropic:', { model: modelName, promptLength: prompt.length });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 5000,
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
    console.log('Sending request to OpenAI:', { model: modelName, promptLength: prompt.length });

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
    console.log('Sending request to OpenAI:', { model: modelName, promptLength: prompt.length });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelName,
            max_completion_tokens: 5000,
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
    console.log('Sending request to Google AI:', { model: modelName, promptLength: prompt.length });

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
                maxOutputTokens: 5000,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Google AI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Google Gemini API call without PDF (for corrections)
async function callGemini(modelName, prompt) {
    console.log('Sending request to Google AI:', { model: modelName, promptLength: prompt.length });

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
                maxOutputTokens: 5000,
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Google AI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { pdfUrl, scoringCriteria, originalScore, originalJustification, password, model, correctionPrompt } = req.body;

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

            const prompt = `Please analyze this research paper and provide an updated assessment using a precise 0.0-10.0 scale.

SCORING CRITERIA:
${scoringCriteria}

SCORING APPROACH:
Assess the paper on two dimensions, then combine using the formula below:

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

IMPORTANT: Full PDF analysis often reveals work is less impressive than abstracts suggest. Be strict with Paper Quality scores:
- Most competent work should score 4-6 on quality
- For Quality 7+: Ask "Does this introduce genuinely new methods or surprising findings?"
- For Quality 8+: Ask "Will this change how other researchers approach problems?"
- For Quality 9+: Ask "Will this be considered a landmark paper in 5-10 years?"
- Be willing to downgrade based on methodology, execution, or limited novelty revealed in the full text
- Don't reward papers just for trendy buzzwords without genuine technical depth

USE DECIMAL PRECISION: Score papers as 1.9, 5.2, 6.7, etc. to create better discrimination. Use the full 0-10 scale.

Furthermore, now that you have access to the full paper, please provide:
1. A comprehensive 3-5 paragraph technical summary of the paper's contents, methodology, and contributions (use \\n\\n to separate paragraphs within the JSON string)
2. A concise 1 paragraph summary of key findings and results
3. A concise 1 paragraph on methodological innovations or notable techniques used
4. A concise 1 paragraph on limitations or areas for future work
5. A concise 1 paragraph relevance assessment that ends with 1 sentence that compares your full-paper analysis to the original abstract-based assessment of ${originalScore}/10
6. An updated relevance score (0.0-10.0 with one decimal place)

Format your response as a JSON object with these fields:
{
  "summary": "First paragraph.\\n\\nSecond paragraph.\\n\\nThird paragraph.\\n\\nFourth paragraph (if needed).\\n\\nFifth paragraph (if needed).",
  "keyFindings": "string",
  "methodology": "string", 
  "limitations": "string",
  "relevanceAssessment": "string",
  "updatedScore": number (0.0-10.0 with one decimal place)
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
