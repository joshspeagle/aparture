const { MODEL_REGISTRY } = require('../../utils/models.js');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Helper function to detect if response is HTML (reCAPTCHA) instead of PDF
function isPDFResponse(buffer) {
    if (buffer.byteLength < 5) return false;

    // Check for PDF magic bytes: %PDF-
    const header = Buffer.from(buffer.slice(0, 5)).toString('ascii');
    return header === '%PDF-';
}

// Helper function to download PDF using Playwright (bypasses reCAPTCHA)
async function downloadPDFWithPlaywright(pdfUrl) {
    console.log('Attempting PDF download via Playwright (reCAPTCHA bypass)...');

    const userDataDir = path.join(process.cwd(), 'temp', 'playwright-profile');

    // Ensure temp directory exists
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    let context;
    try {
        // Launch persistent context to maintain cookies/session
        context = await chromium.launchPersistentContext(userDataDir, {
            headless: true,
            acceptDownloads: true
        });

        const page = context.pages()[0] || await context.newPage();

        // Extract arXiv ID from URL
        const arxivIdMatch = pdfUrl.match(/\/pdf\/([^\/]+)(?:\.pdf)?/);
        if (!arxivIdMatch) {
            throw new Error(`Could not extract arXiv ID from URL: ${pdfUrl}`);
        }
        const arxivId = arxivIdMatch[1];

        // Navigate to abstract page first
        const absUrl = `https://arxiv.org/abs/${arxivId}`;
        console.log(`Navigating to abstract page: ${absUrl}`);
        await page.goto(absUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Get the PDF URL and fetch it with browser context (includes cookies/session)
        const fullPdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
        console.log(`Fetching PDF via browser context: ${fullPdfUrl}`);

        const response = await context.request.get(fullPdfUrl);

        if (response.status() !== 200) {
            throw new Error(`Playwright PDF download failed: HTTP ${response.status()}`);
        }

        const pdfBuffer = await response.body();
        console.log(`PDF downloaded via Playwright: ${pdfBuffer.length} bytes`);

        // Verify it's a valid PDF
        if (!isPDFResponse(pdfBuffer)) {
            throw new Error('Playwright downloaded invalid PDF (HTML/reCAPTCHA page)');
        }

        return pdfBuffer;

    } finally {
        if (context) {
            await context.close();
        }
    }
}

// Function to call different AI models for PDF analysis
async function callAIModelWithPDF(modelId, prompt, base64Data) {
    const modelConfig = MODEL_REGISTRY[modelId];

    if (!modelConfig) {
        throw new Error(`Unsupported model: ${modelId}`);
    }

    const { apiId, provider } = modelConfig;

    switch (provider) {
        case 'Anthropic':
            return await callClaudeWithPDF(apiId, prompt, base64Data);
        case 'OpenAI':
            return await callOpenAIWithPDF(apiId, prompt, base64Data);
        case 'Google':
            return await callGeminiWithPDF(apiId, prompt, base64Data);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

// Function to call AI models without PDF (for corrections)
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

// Claude API call with PDF
async function callClaudeWithPDF(modelName, prompt, base64Data) {
    console.log('Sending request to Anthropic:', { model: modelName, promptLength: prompt.length });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
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
        const errorData = await response.json().catch(() => null);
        console.error('Claude PDF API error:', {
            status: response.status,
            statusText: response.statusText,
            errorData
        });
        throw new Error(`Claude API error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
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
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 5000,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Claude API error:', {
            status: response.status,
            statusText: response.statusText,
            errorData
        });
        throw new Error(`Claude API error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
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
        const errorData = await response.json().catch(() => null);
        console.error('OpenAI PDF API error:', {
            status: response.status,
            statusText: response.statusText,
            errorData
        });
        throw new Error(`OpenAI API error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
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
        const errorData = await response.json().catch(() => null);
        console.error('OpenAI API error:', {
            status: response.status,
            statusText: response.statusText,
            errorData
        });
        throw new Error(`OpenAI API error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
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
        const errorData = await response.json().catch(() => null);
        console.error('Google AI PDF API error:', {
            status: response.status,
            statusText: response.statusText,
            errorData
        });
        throw new Error(`Google AI API error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
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

// Function to validate PDF analysis response structure
function validatePDFAnalysisResponse(responseText) {
    try {
        const parsed = JSON.parse(responseText);

        const errors = [];

        // Check required fields
        const requiredFields = ['summary', 'keyFindings', 'methodology', 'limitations', 'relevanceAssessment', 'updatedScore'];

        requiredFields.forEach(field => {
            if (!(field in parsed)) {
                errors.push(`Missing required field: ${field}`);
            } else if (field === 'updatedScore') {
                if (typeof parsed[field] !== 'number' || parsed[field] < 0 || parsed[field] > 10) {
                    errors.push(`updatedScore must be a number between 0 and 10`);
                }
            } else {
                if (typeof parsed[field] !== 'string' || parsed[field].length < 20) {
                    errors.push(`${field} must be a string with meaningful content`);
                }
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
            // Download PDF for normal analysis - try direct fetch first, fallback to Playwright if blocked
            console.log('Downloading PDF from:', pdfUrl);
            let pdfBuffer;
            let usedPlaywright = false;

            try {
                // Try direct fetch first
                const pdfResponse = await fetch(pdfUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (!pdfResponse.ok) {
                    throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
                }

                pdfBuffer = await pdfResponse.arrayBuffer();

                // Check if we got HTML/reCAPTCHA instead of PDF
                if (!isPDFResponse(pdfBuffer)) {
                    console.warn('Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...');
                    throw new Error('reCAPTCHA detected');
                }

                console.log('PDF downloaded via direct fetch:', { sizeBytes: pdfBuffer.byteLength, sizeKB: (pdfBuffer.byteLength / 1024).toFixed(2) });

            } catch (fetchError) {
                // If direct fetch failed or got reCAPTCHA, try Playwright fallback
                console.warn(`Direct fetch failed (${fetchError.message}), using Playwright fallback...`);
                pdfBuffer = await downloadPDFWithPlaywright(pdfUrl);
                usedPlaywright = true;
            }

            const bufferSize = pdfBuffer.byteLength;

            if (bufferSize === 0) {
                throw new Error('Downloaded PDF is empty (0 bytes)');
            }

            const base64Data = Buffer.from(pdfBuffer).toString('base64');
            console.log(`PDF ready for analysis: { sizeBytes: ${bufferSize}, sizeKB: ${(bufferSize / 1024).toFixed(2)}, usedPlaywright: ${usedPlaywright}, base64Length: ${base64Data.length} }`);

            const prompt = `You are a research assistant scoring academic papers for relevance using a precise 0.0-10.0 scale. Please analyze this research paper and provide an updated assessment using a precise 0.0-10.0 scale.

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
        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        // Always validate response structure (not just on parse failure)
        const validation = validatePDFAnalysisResponse(cleanedText);

        // If validation fails and this isn't already a correction attempt, try to correct
        if (!validation.isValid && !correctionPrompt) {
            console.log('Initial PDF analysis response validation failed:', validation.errors);

            // Build correction prompt with specific errors
            const correctionRequest = `The previous response had formatting/structure errors:
${validation.errors.join('\n')}

Original response:
${cleanedText}

Please provide a corrected response with all required fields.
Required fields: summary, keyFindings, methodology, limitations, relevanceAssessment, updatedScore

Your entire response MUST ONLY be a valid JSON object in this exact format:
{
  "summary": "Multi-paragraph summary with \\n\\n between paragraphs",
  "keyFindings": "Key findings paragraph",
  "methodology": "Methodology paragraph",
  "limitations": "Limitations paragraph",
  "relevanceAssessment": "Relevance assessment paragraph",
  "updatedScore": 5.5
}`;

            // Try correction
            const correctedResponse = await callAIModel(model, correctionRequest);
            responseText = correctedResponse;
            cleanedText = correctedResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        }

        let analysis;
        try {
            analysis = JSON.parse(cleanedText);

            // Final validation even after correction
            const finalValidation = validatePDFAnalysisResponse(cleanedText);
            if (!finalValidation.isValid) {
                console.warn('PDF analysis response still invalid after correction:', finalValidation.errors);
            }

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
