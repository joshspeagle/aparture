const { MODEL_REGISTRY } = require('../../utils/models.js');

// Simple password check function
function checkPassword(password) {
    return password === process.env.ACCESS_PASSWORD;
}

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// Helper to extract context around a position in text
function extractContext(text, position, contextLength = 100) {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    return text.substring(start, end).trim();
}

// Detect hallucinations in generated NotebookLM content with detailed categorization
function detectHallucination(generatedText, originalPapers) {
    const issues = [];
    const warnings = [];
    const detailedIssues = []; // New: structured issue tracking

    // ===== PAPER TITLE DETECTION =====

    // Step 1: Extract all quoted strings that look like paper titles
    const quotedStrings = [];
    const quoteRegex = /"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(generatedText)) !== null) {
        const quoted = match[1];
        const position = match.index;
        // Heuristic: likely a paper title if it's long and has multiple words
        if (quoted.length > 15 && quoted.split(' ').length > 3) {
            // Check if first letters are capitalized (typical of titles)
            const words = quoted.split(' ').filter(w => w.length > 0);
            const likelyTitle = words.filter(w => w[0] && w[0] === w[0].toUpperCase()).length > words.length * 0.5;
            if (likelyTitle) {
                quotedStrings.push({ title: quoted, position });
            }
        }
    }

    // Step 2: Check each potential title against our paper list
    for (const potentialTitleObj of quotedStrings) {
        const potentialTitle = potentialTitleObj.title;
        const position = potentialTitleObj.position;
        let found = false;
        let closestMatch = null;
        let closestDistance = Infinity;
        let closestPaperIndex = -1;

        for (let i = 0; i < originalPapers.length; i++) {
            const paper = originalPapers[i];
            // Exact match
            if (paper.title === potentialTitle) {
                found = true;
                break;
            }

            // Calculate similarity for near matches
            const distance = levenshteinDistance(paper.title.toLowerCase(), potentialTitle.toLowerCase());
            const similarity = 1 - (distance / Math.max(paper.title.length, potentialTitle.length));

            // Track closest match
            if (distance < closestDistance) {
                closestDistance = distance;
                closestMatch = paper.title;
                closestPaperIndex = i;
            }

            // Near match (>90% similar) - might be minor formatting difference
            if (similarity > 0.9) {
                found = true;
                warnings.push(`Near match: "${potentialTitle}" ≈ "${paper.title}"`);
                break;
            }
        }

        if (!found && closestMatch) {
            // Check if it's clearly fabricated (no similarity to any real paper)
            const maxSimilarity = 1 - (closestDistance / Math.max(closestMatch.length, potentialTitle.length));
            const context = extractContext(generatedText, position);

            if (maxSimilarity < 0.3) {
                issues.push(`HALLUCINATED PAPER: "${potentialTitle}" (no match in provided papers)`);
                detailedIssues.push({
                    type: 'hallucinated_title',
                    severity: 'critical',
                    hallucinatedText: potentialTitle,
                    position,
                    context,
                    suggestion: `Remove this paper title or replace with an actual paper from the list`,
                    availablePapers: originalPapers.map(p => p.title)
                });
            } else {
                issues.push(`Possible hallucination: "${potentialTitle}" (closest: "${closestMatch}")`);
                detailedIssues.push({
                    type: 'wrong_title',
                    severity: 'high',
                    hallucinatedText: potentialTitle,
                    position,
                    context,
                    suggestion: `Replace "${potentialTitle}" with "${closestMatch}" [P${closestPaperIndex + 1}]`,
                    correctText: closestMatch,
                    correctPaperId: closestPaperIndex + 1
                });
            }
        }
    }

    // ===== PAPER REFERENCE VALIDATION =====

    // Step 3: Check all [P#] references
    const pRefRegex = /\[P(\d+)\]/g;
    const pRefs = generatedText.match(pRefRegex) || [];
    const uniqueRefs = new Set();
    const maxValidId = originalPapers.length;

    let refMatch2;
    pRefRegex.lastIndex = 0; // Reset regex
    while ((refMatch2 = pRefRegex.exec(generatedText)) !== null) {
        const id = parseInt(refMatch2[1]);
        const position = refMatch2.index;
        uniqueRefs.add(id);

        if (id < 1 || id > maxValidId) {
            issues.push(`Invalid reference ${refMatch2[0]} - only P1-P${maxValidId} exist`);
            detailedIssues.push({
                type: 'invalid_reference',
                severity: 'critical',
                hallucinatedText: refMatch2[0],
                position,
                context: extractContext(generatedText, position),
                suggestion: `Remove ${refMatch2[0]} or replace with a valid reference [P1-P${maxValidId}]`,
                validRange: { min: 1, max: maxValidId }
            });
        }
    }

    // Step 4: Check if [P#] is followed by correct title
    const refWithTitle = /\[P(\d+)\](?:\s*:)?\s*"([^"]+)"/g;
    let refMatch;
    while ((refMatch = refWithTitle.exec(generatedText)) !== null) {
        const paperId = parseInt(refMatch[1]);
        const claimedTitle = refMatch[2];
        const position = refMatch.index;

        if (paperId <= originalPapers.length) {
            const actualTitle = originalPapers[paperId - 1].title;
            if (actualTitle !== claimedTitle) {
                const similarity = 1 - (levenshteinDistance(actualTitle.toLowerCase(), claimedTitle.toLowerCase()) /
                                       Math.max(actualTitle.length, claimedTitle.length));

                if (similarity < 0.9) {
                    issues.push(`Wrong title for [P${paperId}]: got "${claimedTitle}", expected "${actualTitle}"`);
                    detailedIssues.push({
                        type: 'wrong_reference_title',
                        severity: 'high',
                        hallucinatedText: claimedTitle,
                        position,
                        context: extractContext(generatedText, position),
                        suggestion: `[P${paperId}] should reference "${actualTitle}", not "${claimedTitle}"`,
                        correctText: actualTitle,
                        paperId: paperId
                    });
                }
            }
        }
    }

    // ===== PATTERN-BASED DETECTION =====

    // Step 5: Check for theme sections without paper references
    if (generatedText.includes('Theme')) {
        const themeRegex = /### Theme (\d+)[^\n]*\n([\s\S]*?)(?=###|$)/g;
        let themeMatch;
        while ((themeMatch = themeRegex.exec(generatedText)) !== null) {
            const themeNum = themeMatch[1];
            const themeContent = themeMatch[2].substring(0, 500); // Check first 500 chars
            const position = themeMatch.index;
            const hasRefs = /\[P\d+\]/.test(themeContent);

            if (!hasRefs) {
                issues.push(`Theme ${themeNum} lacks paper references - possible hallucination`);
                detailedIssues.push({
                    type: 'missing_citations',
                    severity: 'medium',
                    hallucinatedText: null,
                    position,
                    context: themeContent.substring(0, 200),
                    suggestion: `Add paper references [P#] to Theme ${themeNum} to support the claims`,
                    section: `Theme ${themeNum}`
                });
            }
        }
    }

    // ===== SCORING AND DECISION =====

    return {
        hasHallucination: issues.length > 0,
        issues: issues,
        warnings: warnings,
        detailedIssues: detailedIssues, // New: return detailed issues for correction
        confidence: issues.length > 0 ? 'high' : warnings.length > 2 ? 'medium' : 'low'
    };
}

// Categorize hallucinations by severity and type for prioritized correction
function categorizeHallucinations(detailedIssues) {
    const critical = [];
    const high = [];
    const medium = [];

    detailedIssues.forEach(issue => {
        switch(issue.severity) {
            case 'critical':
                critical.push(issue);
                break;
            case 'high':
                high.push(issue);
                break;
            case 'medium':
                medium.push(issue);
                break;
        }
    });

    return {
        critical,
        high,
        medium,
        total: detailedIssues.length,
        needsUrgentFix: critical.length > 0,
        canBeFixed: critical.length === 0 && (high.length > 0 || medium.length > 0)
    };
}

// Generate a targeted correction prompt based on detected issues
function generateCorrectionPrompt(originalResponse, detailedIssues, relevantPapers) {
    // Group issues by type for better organization
    const issuesByType = {
        hallucinated_title: [],
        wrong_title: [],
        invalid_reference: [],
        wrong_reference_title: [],
        missing_citations: []
    };

    detailedIssues.forEach(issue => {
        if (issuesByType[issue.type]) {
            issuesByType[issue.type].push(issue);
        }
    });

    let prompt = `You previously generated a NotebookLM discussion guide that contains some errors.
Please fix ONLY the following specific issues while keeping everything else unchanged.

IMPORTANT: Return the COMPLETE corrected document with all fixes applied. Do not add new content or restructure existing content unless specifically required by the corrections below.

⚠️ CORRECTIONS REQUIRED ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    let correctionNum = 1;

    // Handle hallucinated titles
    if (issuesByType.hallucinated_title.length > 0) {
        prompt += `\n${correctionNum}. REMOVE OR REPLACE HALLUCINATED PAPERS:\n`;
        issuesByType.hallucinated_title.forEach(issue => {
            prompt += `   - Remove "${issue.hallucinatedText}" - this paper does not exist\n`;
            prompt += `     Context: "...${issue.context.substring(0, 100)}..."\n`;
        });
        correctionNum++;
    }

    // Handle wrong titles
    if (issuesByType.wrong_title.length > 0) {
        prompt += `\n${correctionNum}. CORRECT PAPER TITLES:\n`;
        issuesByType.wrong_title.forEach(issue => {
            prompt += `   - Replace "${issue.hallucinatedText}"\n`;
            prompt += `     With: "${issue.correctText}" [P${issue.correctPaperId}]\n`;
        });
        correctionNum++;
    }

    // Handle invalid references
    if (issuesByType.invalid_reference.length > 0) {
        prompt += `\n${correctionNum}. FIX INVALID REFERENCES:\n`;
        issuesByType.invalid_reference.forEach(issue => {
            prompt += `   - ${issue.hallucinatedText} is invalid (valid range: P1-P${issue.validRange.max})\n`;
            prompt += `     Either remove it or replace with a valid reference\n`;
        });
        correctionNum++;
    }

    // Handle wrong reference titles
    if (issuesByType.wrong_reference_title.length > 0) {
        prompt += `\n${correctionNum}. CORRECT REFERENCE-TITLE MAPPINGS:\n`;
        issuesByType.wrong_reference_title.forEach(issue => {
            prompt += `   - [P${issue.paperId}] should reference "${issue.correctText}"\n`;
            prompt += `     NOT "${issue.hallucinatedText}"\n`;
        });
        correctionNum++;
    }

    // Handle missing citations
    if (issuesByType.missing_citations.length > 0) {
        prompt += `\n${correctionNum}. ADD MISSING CITATIONS:\n`;
        issuesByType.missing_citations.forEach(issue => {
            prompt += `   - ${issue.section} needs paper references [P#] to support its claims\n`;
            prompt += `     Add appropriate citations from the available papers\n`;
        });
        correctionNum++;
    }

    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID PAPERS (use ONLY these):
${relevantPapers.map((p, i) => `[P${i + 1}] "${p.title}"`).join('\n')}

ORIGINAL DOCUMENT TO CORRECT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${originalResponse}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please apply all the corrections listed above and return the complete corrected document.`;

    return prompt;
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

// Generate clean prompt (less constrained, more natural)
function generateCleanPrompt(relevantPapers, scoringCriteria, targetDuration, contentDepth) {
    return `You are preparing a discussion guide for NotebookLM using these ${relevantPapers.length} papers:

${relevantPapers.map((p, i) => `[P${i + 1}] "${p.title}"`).join('\n')}

CONSTRAINT: Reference papers using [P#] notation only. If papers don't match the research criteria well, acknowledge this explicitly rather than creating examples.

RESEARCH CONTEXT:
${scoringCriteria}

DETAILED PAPER INFORMATION:
${relevantPapers.map((p, idx) => `
[P${idx + 1}]:
- Title: "${p.title}"
- Score: ${p.score || p.relevanceScore}/10
- Abstract: ${p.abstract}
- Justification: ${p.justification || p.scoreJustification || 'N/A'}
${p.adjustedScore ? `- Adjusted Score: ${p.adjustedScore}/10` : ''}
${p.adjustmentReason ? `- Adjustment Reason: ${p.adjustmentReason}` : ''}
${p.pdfAnalysis ? `- PDF Analysis: ${p.pdfAnalysis.summary || ''}` : ''}
`).join('\n')}

Create a well-structured markdown document for NotebookLM podcast generation (${targetDuration} minutes).

Include sections based on these settings:
- Thematic Analysis: ${contentDepth.includeThemes ? 'Yes' : 'No'}
- Methodology Discussion: ${contentDepth.includeMethodology ? 'Yes' : 'No'}
- Comparative Insights: ${contentDepth.includeComparative ? 'Yes' : 'No'}
- Technical Deep-Dive: ${contentDepth.includeTechnical ? 'Yes' : 'No'}

Structure your response with proper markdown headers and clear organization. Focus on insights that would generate engaging expert discussion.`;
}

// Generate strict prompt (heavily constrained to prevent hallucination)
function generateStrictPrompt(relevantPapers, scoringCriteria, targetDuration, contentDepth) {
    const prompt = `You are preparing a discussion guide for NotebookLM. NotebookLM will use this guide along with the full analysis report to generate an expert-level technical podcast discussion (approximately ${targetDuration} minutes).

⚠️ CRITICAL ANTI-HALLUCINATION PROTOCOL ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. You MUST ONLY discuss the EXACT papers listed below - NO EXCEPTIONS
2. You MUST NOT invent, imagine, hypothesize, or create ANY papers not explicitly listed
3. You MUST use paper titles EXACTLY as provided, word-for-word
4. Every paper reference MUST use the ID system: [P1], [P2], etc.
5. If papers don't match the research criteria, acknowledge this explicitly
6. NEVER use phrases like "for example, a paper on X" without a specific [P#] reference
7. NEVER create illustrative examples using fictional papers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 INPUT VERIFICATION - EXACTLY ${relevantPapers.length} PAPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${relevantPapers.map((p, idx) => `[P${idx + 1}] Title: "${p.title}"
    Score: ${(p.score || p.relevanceScore)}/10${p.adjustedScore ? ` (Adjusted: ${p.adjustedScore}/10)` : ''}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFIRM: You will discuss ONLY these ${relevantPapers.length} papers listed above. No other papers exist for this analysis.

RESEARCH CONTEXT:
${scoringCriteria}

DETAILED PAPER INFORMATION:
${relevantPapers.map((p, idx) => `
[P${idx + 1}] PAPER DETAILS:
- Title: "${p.title}"
- Score: ${p.score || p.relevanceScore}/10
- Abstract: ${p.abstract}
- Justification: ${p.justification || p.scoreJustification || 'N/A'}
${p.adjustedScore ? `- Adjusted Score: ${p.adjustedScore}/10` : ''}
${p.adjustmentReason ? `- Adjustment Reason: ${p.adjustmentReason}` : ''}
${p.pdfAnalysis ? `- PDF Analysis Summary: ${p.pdfAnalysis.summary || ''}
- Key Findings: ${p.pdfAnalysis.keyFindings || ''}
- Methodology: ${p.pdfAnalysis.methodology || ''}
- Limitations: ${p.pdfAnalysis.limitations || ''}
- Relevance Assessment: ${p.pdfAnalysis.relevanceAssessment || ''}` : ''}
`).join('\n')}

YOUR SPECIFIC ROLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Create a DISCUSSION GUIDE using ONLY the ${relevantPapers.length} papers above
- NotebookLM has access to the full report, so focus on organization and connections
- You are NOT summarizing papers - you are organizing them for discussion
- Every claim must reference a specific paper using [P#] format
- If papers don't align well with research criteria, explicitly acknowledge this
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MISMATCH HANDLING PROTOCOL:
If the provided papers don't match the research criteria well:
1. Explicitly state: "Note: The provided papers focus primarily on [actual focus] rather than [expected focus from criteria]"
2. Still organize ONLY the provided papers
3. DO NOT create fictional papers that would better match
4. Work with what you have, acknowledging limitations

CONTENT DEPTH PARAMETERS:
- Detail Level: ${contentDepth.detailLevel}
- Include Thematic Grouping: ${contentDepth.includeThemes ? 'Yes' : 'No'}
- Include Methodological Analysis: ${contentDepth.includeMethodology ? 'Yes' : 'No'}
- Include Comparative Insights: ${contentDepth.includeComparative ? 'Yes' : 'No'}
- Include Technical Deep-Dives: ${contentDepth.includeTechnical ? 'Yes' : 'No'}

STRUCTURE YOUR RESPONSE AS A MARKDOWN DOCUMENT:

# Research Discussion Guide: [Title based on the ACTUAL papers provided]

## Papers Under Discussion (EXACTLY ${relevantPapers.length} papers)
[List all papers with their [P#] IDs - this section is MANDATORY]

## Executive Summary
[Synthesize ONLY the provided papers, using [P#] references throughout]

## Research Context and Available Papers
[Explain the research criteria and note if there's a mismatch with the actual papers]

${contentDepth.includeThemes ? `
## Thematic Analysis of the ${relevantPapers.length} Provided Papers

⚠️ CRITICAL: Extract themes ONLY from the papers listed above
- Every theme must cite specific [P#] papers
- Do NOT invent papers to support themes
- If few papers share themes, acknowledge this limitation

### Theme 1: [Theme evident in provided papers]
Papers exhibiting this theme: [Must list specific P#s, e.g., [P2], [P5], [P8]]

Explanation using ONLY the listed papers:
- [P#]: Specific contribution from this paper
- [P#]: How this paper relates to the theme
- [P#]: Another paper's perspective

### Theme 2: [Another theme from provided papers]
Papers in this category: [List specific P#s only]
[Continue with same strict [P#] referencing]

### Theme 3: [Only if clearly supported by multiple papers]
[Only include if papers actually support this theme]
` : ''}

${contentDepth.includeComparative ? `
## Comparative Insights
[Analyze relationships between the ${relevantPapers.length} provided papers ONLY:]
- Complementary approaches in papers [P#] and [P#]
- Conflicting findings between [P#] and [P#]
- Methodological patterns across [list specific P# references]
- Note: Gaps should be noted but NOT filled with fictional papers
` : ''}

${contentDepth.includeMethodology ? `
## Methodological Innovations (from the ${relevantPapers.length} provided papers)
[Discuss ONLY methods from provided papers using [P#] references:]
- Breakthrough methods in [P#]: [specific method from that paper]
- Paper [P#] improves upon [describe from paper's content]
- Technical challenges addressed by [P#]
- Implementation details from papers [list specific P#s]
NOTE: Every method discussed must reference a specific [P#] paper
` : ''}

## Research Implications and Future Directions
[Based STRICTLY on the ${relevantPapers.length} provided papers:]
- Impact of papers [list specific P#s] on the field
- Open questions raised by [P#] and [P#]
- Applications suggested in papers [P#], [P#]
- Limitations acknowledged in [P#] that need addressing
NOTE: Discuss only implications directly stated or clearly implied by provided papers

${contentDepth.includeTechnical ? `
## Technical Deep-Dive for Expert Discussion
[Technical points from the ${relevantPapers.length} provided papers ONLY:]
- Algorithmic details from [P#]: [specific details]
- Mathematical foundations in [P#]: [specific math]
- Experimental design in papers [list P#s]
- Statistical methods used by [P#] and [P#]
- Implementation challenges noted in [P#]
REMINDER: Do not discuss techniques not present in the provided papers
` : ''}

## Key Takeaways for Practitioners
[Actionable insights from the ${relevantPapers.length} provided papers:]
- Methods worth adopting from [P#]: [specific method]
- Pitfalls identified in [P#]: [specific issue]
- Tools mentioned in papers [list P#s]
- Collaboration opportunities suggested by [P#]
EVERY takeaway must reference its source paper [P#]

## Discussion Prompts for Podcast
[Questions about the ${relevantPapers.length} provided papers:]
- What are the most surprising findings in [list specific P# papers]?
- How do papers [P#] and [P#] complement or contradict each other?
- What patterns emerge across papers [P#], [P#], and [P#]?
- Based on these ${relevantPapers.length} specific papers, what questions remain?

---
*Document prepared for NotebookLM podcast generation. Target duration: ${targetDuration} minutes. Intended audience: Expert researchers and practitioners in the field.*

## Validation Checklist
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Number of papers discussed: ${relevantPapers.length} (MUST match input count)
☐ All paper references use [P#] format
☐ No papers mentioned beyond the input list of ${relevantPapers.length}
☐ All titles are exact matches to input
☐ Any mismatch between papers and criteria is explicitly noted
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL REMINDERS:
- Every paper mention MUST use [P#] format
- NEVER invent papers to fill gaps or illustrate points
- Work ONLY with the ${relevantPapers.length} papers provided
- If examples are needed, use [P#] references to actual papers
- Acknowledge limitations rather than inventing content`;

    return prompt;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { papers, scoringCriteria, targetDuration = 15, model = 'gemini-2.5-pro', password, enableHallucinationCheck = true } = req.body;

    // Check password
    if (!checkPassword(password)) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        const contentDepth = getContentDepth(targetDuration);

        // Filter and sort papers by score (handle both score and relevanceScore)
        const relevantPapers = papers
            .filter(p => (p.score > 0 || p.relevanceScore > 0))
            .sort((a, b) => {
                const scoreA = a.score || a.relevanceScore || 0;
                const scoreB = b.score || b.relevanceScore || 0;
                return scoreB - scoreA;
            })
            .slice(0, contentDepth.paperLimit);

        // Check if we have any papers to work with
        if (relevantPapers.length === 0) {
            console.log('No papers available for NotebookLM generation. Input papers:', papers.length);
            if (papers.length > 0) {
                console.log('Sample paper data:', papers[0]);
            }
            return res.status(400).json({
                error: 'No papers with positive scores available for NotebookLM generation',
                details: `Received ${papers.length} papers, but none had score > 0 or relevanceScore > 0`
            });
        }

        // Start with clean prompt by default
        let prompt = generateCleanPrompt(relevantPapers, scoringCriteria, targetDuration, contentDepth);
        let useStrictMode = false;
        let hallucinationDetected = false;
        let hallucinationIssues = [];
        let warnings = [];

        // Generate initial response
        console.log('Generating NotebookLM document with', relevantPapers.length, 'papers...');
        let responseText = await callAIModel(model, prompt);

        // Progressive hallucination correction system
        const maxCorrectionRetries = 2;
        let correctionAttempts = 0;
        let correctionHistory = [];
        let finalHallucinationCheck = null;

        if (enableHallucinationCheck) {
            console.log('Checking for hallucinations in NotebookLM generation...');
            let check = detectHallucination(responseText, relevantPapers);

            // Stage 1: Targeted corrections (up to 2 retries)
            while (check.hasHallucination && correctionAttempts < maxCorrectionRetries) {
                const categorized = categorizeHallucinations(check.detailedIssues);
                console.log(`HALLUCINATION DETECTED (Attempt ${correctionAttempts + 1}/${maxCorrectionRetries}):`,
                    `Critical: ${categorized.critical.length}, High: ${categorized.high.length}, Medium: ${categorized.medium.length}`);
                console.log('Issues:', check.issues);

                // Store correction attempt info
                correctionHistory.push({
                    attempt: correctionAttempts + 1,
                    issues: check.issues.slice(),
                    detailedIssues: check.detailedIssues.slice(),
                    categorized
                });

                // Generate targeted correction prompt
                console.log('Generating targeted correction prompt...');
                const correctionPrompt = generateCorrectionPrompt(responseText, check.detailedIssues, relevantPapers);

                // Apply corrections
                console.log('Applying targeted corrections...');
                responseText = await callAIModel(model, correctionPrompt);

                // Re-check for hallucinations
                console.log('Re-checking for hallucinations after correction...');
                check = detectHallucination(responseText, relevantPapers);
                correctionAttempts++;

                if (!check.hasHallucination) {
                    console.log('SUCCESS: Hallucinations fixed with targeted corrections!');
                    hallucinationDetected = false;
                    break;
                }
            }

            // Stage 2: Strict mode fallback if corrections failed
            if (check.hasHallucination && correctionAttempts === maxCorrectionRetries) {
                console.log('Targeted corrections insufficient, falling back to strict prompt...');
                hallucinationDetected = true;
                hallucinationIssues = check.issues;
                warnings = check.warnings;
                useStrictMode = true;

                // Generate with strict prompt
                prompt = generateStrictPrompt(relevantPapers, scoringCriteria, targetDuration, contentDepth);
                responseText = await callAIModel(model, prompt);

                // Final check after strict mode
                const finalCheck = detectHallucination(responseText, relevantPapers);
                finalHallucinationCheck = finalCheck;

                if (finalCheck.hasHallucination) {
                    console.error('WARNING: Some hallucination issues persist even after strict mode:', finalCheck.issues);
                    // Add persistent issues to warnings
                    warnings = [...warnings, ...finalCheck.issues.map(i => `[Persistent after strict mode] ${i}`)];
                } else {
                    console.log('SUCCESS: Strict mode eliminated remaining hallucinations');
                }
            } else if (!check.hasHallucination && check.warnings.length > 0) {
                console.log('Minor issues detected (not requiring correction):', check.warnings);
                warnings = check.warnings;
            }

            // Store final state
            if (!finalHallucinationCheck && check) {
                finalHallucinationCheck = check;
            }
        }

        // Clean up any potential markdown code blocks
        responseText = responseText.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');

        // Build metadata with hallucination info
        const metadata = {
            paperCount: relevantPapers.length,
            targetDuration,
            model,
            generatedAt: new Date().toISOString(),
            hallucinationCheckEnabled: enableHallucinationCheck
        };

        // Add correction history if applicable
        if (correctionHistory.length > 0) {
            metadata.correctionAttempts = correctionHistory.length;
            metadata.correctionHistory = correctionHistory.map(h => ({
                attempt: h.attempt,
                issueCount: h.issues.length,
                criticalCount: h.categorized.critical.length,
                highCount: h.categorized.high.length,
                mediumCount: h.categorized.medium.length
            }));
        }

        if (hallucinationDetected) {
            metadata.hallucinationDetected = true;
            metadata.hallucinationIssues = hallucinationIssues;
            metadata.usedStrictMode = useStrictMode;
            metadata.strictModeSuccessful = !finalHallucinationCheck?.hasHallucination;
        }

        if (warnings.length > 0) {
            metadata.warnings = warnings;
        }

        // Add final status
        if (finalHallucinationCheck) {
            metadata.finalStatus = {
                hasHallucinations: finalHallucinationCheck.hasHallucination,
                remainingIssues: finalHallucinationCheck.issues.length,
                correctionMethod: useStrictMode ? 'strict_mode' :
                                correctionAttempts > 0 ? 'targeted_corrections' : 'clean_generation'
            };
        }

        // Return the generated markdown
        res.status(200).json({
            success: true,
            markdown: responseText,
            metadata
        });

    } catch (error) {
        console.error('Error generating NotebookLM document:', error);
        res.status(500).json({
            error: 'Failed to generate NotebookLM document',
            details: error.message
        });
    }
}