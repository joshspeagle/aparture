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
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending NotebookLM generation request to Anthropic:', { model: modelName, promptLength: prompt.length });

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
        max_completion_tokens: 8000,
        messages: [{ role: "user", content: prompt }]
    };

    console.log('Sending NotebookLM generation request to OpenAI:', { model: modelName, promptLength: prompt.length });

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
            maxOutputTokens: 8000,
        }
    };

    console.log('Sending NotebookLM generation request to Google AI:', { model: modelName, promptLength: prompt.length });

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

// Helper to determine content depth based on duration
function getContentDepth(targetDuration) {
    if (targetDuration <= 5) {
        return {
            paperLimit: 5,
            detailLevel: 'executive',
            includeThemes: false,
            includeMethodology: false,
            includeComparative: false,
            includeTechnical: false
        };
    } else if (targetDuration <= 10) {
        return {
            paperLimit: 10,
            detailLevel: 'standard',
            includeThemes: true,
            includeMethodology: false,
            includeComparative: false,
            includeTechnical: false
        };
    } else if (targetDuration <= 15) {
        return {
            paperLimit: 15,
            detailLevel: 'detailed',
            includeThemes: true,
            includeMethodology: true,
            includeComparative: true,
            includeTechnical: false
        };
    } else if (targetDuration <= 20) {
        return {
            paperLimit: 25,
            detailLevel: 'comprehensive',
            includeThemes: true,
            includeMethodology: true,
            includeComparative: true,
            includeTechnical: true
        };
    } else {
        return {
            paperLimit: 50,
            detailLevel: 'exhaustive',
            includeThemes: true,
            includeMethodology: true,
            includeComparative: true,
            includeTechnical: true
        };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { papers, scoringCriteria, targetDuration = 15, model = 'gemini-2.5-pro', password } = req.body;

    // Check password
    if (!checkPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        const contentDepth = getContentDepth(targetDuration);

        // Filter and sort papers by score
        const relevantPapers = papers
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, contentDepth.paperLimit);

        const prompt = `You are a research assistant preparing a comprehensive document for NotebookLM to generate an expert-level technical podcast discussion. The podcast will be approximately ${targetDuration} minutes long.

RESEARCH CONTEXT:
${scoringCriteria}

PAPERS TO ANALYZE (${relevantPapers.length} papers):
${relevantPapers.map((p, idx) => `
Paper ${idx + 1}:
- Title: ${p.title}
- Score: ${p.score}/10
- Abstract: ${p.abstract}
- Justification: ${p.justification || 'N/A'}
${p.adjustedScore ? `- Adjusted Score: ${p.adjustedScore}/10` : ''}
${p.adjustmentReason ? `- Adjustment Reason: ${p.adjustmentReason}` : ''}
${p.pdfAnalysis ? `
- PDF Analysis Summary: ${p.pdfAnalysis.summary || ''}
- Key Findings: ${p.pdfAnalysis.keyFindings || ''}
- Methodology: ${p.pdfAnalysis.methodology || ''}
- Limitations: ${p.pdfAnalysis.limitations || ''}
- Relevance Assessment: ${p.pdfAnalysis.relevanceAssessment || ''}
` : ''}
`).join('\n')}

DOCUMENT REQUIREMENTS:
1. Generate a well-structured markdown document optimized for NotebookLM podcast generation
2. Organize papers into thematic groups based on research approaches, methodologies, or findings
3. Maintain an expert-to-expert tone throughout (for experts, by experts)
4. Include technical depth appropriate for researchers in the field
5. Create logical narrative flow between sections

CONTENT DEPTH PARAMETERS:
- Detail Level: ${contentDepth.detailLevel}
- Include Thematic Grouping: ${contentDepth.includeThemes ? 'Yes' : 'No'}
- Include Methodological Analysis: ${contentDepth.includeMethodology ? 'Yes' : 'No'}
- Include Comparative Insights: ${contentDepth.includeComparative ? 'Yes' : 'No'}
- Include Technical Deep-Dives: ${contentDepth.includeTechnical ? 'Yes' : 'No'}

STRUCTURE YOUR RESPONSE AS A MARKDOWN DOCUMENT:

# Research Analysis: [Create a compelling title based on the dominant themes]

## Executive Summary
[Provide a high-level synthesis of the research landscape, major findings, and implications for the field - 2-3 paragraphs]

## Research Context and Methodology
[Explain the research interests, evaluation criteria, and approach taken in this analysis]

${contentDepth.includeThemes ? `
## Thematic Analysis

### Theme 1: [Identify first major theme across papers]
[Provide context and significance of this theme]

#### Key Papers in This Theme
[For each relevant paper, include:]
- **[Paper Title]** (Score: X.X/10)
  - Core Contribution: [What makes this paper significant]
  - Methodological Approach: [Key techniques used]
  - Principal Findings: [Main results and their implications]
  - Technical Innovation: [What's novel about the approach]

### Theme 2: [Second major theme]
[Similar structure as Theme 1]

### Theme 3: [If applicable]
[Similar structure]
` : ''}

${contentDepth.includeComparative ? `
## Comparative Insights
[Analyze relationships between papers, identifying:]
- Complementary approaches that could be combined
- Conflicting findings that need reconciliation
- Evolution of methodologies across papers
- Gaps in the current research landscape
` : ''}

${contentDepth.includeMethodology ? `
## Methodological Innovations
[Deep dive into novel techniques and approaches:]
- Breakthrough methods introduced
- Improvements over existing approaches
- Technical challenges addressed
- Reproducibility and implementation considerations
` : ''}

## Research Implications and Future Directions
[Discuss:]
- Impact on the field
- Open questions raised
- Potential applications
- Areas needing further investigation

${contentDepth.includeTechnical ? `
## Technical Deep-Dive for Expert Discussion
[Include sophisticated technical points for podcast hosts to explore:]
- Complex algorithmic details
- Mathematical foundations
- Experimental design considerations
- Statistical significance and limitations
- Implementation challenges and solutions
` : ''}

## Key Takeaways for Practitioners
[Actionable insights for researchers in the field:]
- Methods worth adopting
- Pitfalls to avoid
- Resources and tools mentioned
- Collaboration opportunities

## Discussion Prompts for Podcast
[Questions and talking points to guide the podcast conversation:]
- What are the most surprising findings across these papers?
- How do these advances change current practice in the field?
- What technical challenges remain unsolved?
- Where might this research lead in the next 5 years?

---
*Document prepared for NotebookLM podcast generation. Target duration: ${targetDuration} minutes. Intended audience: Expert researchers and practitioners in the field.*

IMPORTANT:
- Use clear markdown formatting with proper headers (# ## ###)
- Maintain technical precision while ensuring narrative flow
- Include specific paper titles and scores throughout
- Create natural transitions between sections
- Focus on insights that would generate engaging expert discussion`;

        let responseText = await callAIModel(model, prompt);

        // Clean up any potential markdown code blocks
        responseText = responseText.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');

        // Return the generated markdown
        res.status(200).json({
            success: true,
            markdown: responseText,
            metadata: {
                paperCount: relevantPapers.length,
                targetDuration,
                model,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error generating NotebookLM document:', error);
        res.status(500).json({
            error: 'Failed to generate NotebookLM document',
            details: error.message
        });
    }
}