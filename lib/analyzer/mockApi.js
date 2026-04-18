// Enhanced Mock API Tester with abort/pause support.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F1).
// Dependencies (abort control + resume signaling) are injected via the
// constructor so this class has no React import and is unit-testable.

function generateRealisticScore() {
  // Uniform distribution on [0, 10), rounded to 1 decimal place.
  const score = Math.random() * 10;
  return Math.round(score * 10) / 10;
}

export class MockAPITester {
  constructor({ abortControllerRef, pauseRef, waitForResume }) {
    this.abortControllerRef = abortControllerRef;
    this.pauseRef = pauseRef;
    this.waitForResume = waitForResume;
    this.callCount = 0;
    this.scenarios = [
      'valid',
      'malformed',
      'missing_field',
      'wrong_type',
      'retry_failure',
      'final_failure',
    ];
    // Per-paper counter for the PDF simulation so the Playwright-skip
    // scenario fires deterministically (every 5th PDF analyzed), regardless
    // of how many other mock calls have occurred in the run.
    this.pdfCallCount = 0;
  }

  async checkAbortAndPause() {
    if (this.abortControllerRef.current?.signal.aborted) {
      throw new Error('Operation aborted');
    }
    if (this.pauseRef.current) {
      await this.waitForResume();
    }
  }

  async sleepWithAbortCheck(ms) {
    const checkInterval = 100;
    const iterations = Math.ceil(ms / checkInterval);
    for (let i = 0; i < iterations; i++) {
      await this.checkAbortAndPause();
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(checkInterval, ms - i * checkInterval))
      );
    }
  }

  async mockQuickFilter(papers, isCorrection = false) {
    await this.checkAbortAndPause();
    this.callCount++;
    const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];
    await this.sleepWithAbortCheck(50 + Math.random() * 100);
    console.log(
      `Mock Quick Filter API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`
    );
    await this.checkAbortAndPause();

    switch (scenario) {
      case 'valid':
        return JSON.stringify(
          papers.map((_, idx) => ({
            paperIndex: idx + 1,
            verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)],
          }))
        );
      case 'malformed':
        if (isCorrection) {
          return JSON.stringify(
            papers.map((_, idx) => ({
              paperIndex: idx + 1,
              verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)],
            }))
          );
        }
        return `{"invalid": "json" "missing_comma": true}`;
      case 'missing_field':
        if (isCorrection) {
          return JSON.stringify(
            papers.map((_, idx) => ({
              paperIndex: idx + 1,
              verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)],
            }))
          );
        }
        return JSON.stringify(papers.map((_, idx) => ({ paperIndex: idx + 1 })));
      case 'wrong_type':
        if (isCorrection) {
          return JSON.stringify(
            papers.map((_, idx) => ({
              paperIndex: idx + 1,
              verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)],
            }))
          );
        }
        return JSON.stringify(papers.map((_, idx) => ({ paperIndex: idx + 1, verdict: 123 })));
      case 'retry_failure':
        throw new Error('Mock Filter API temporary failure - should trigger retry');
      case 'final_failure':
        throw new Error('Mock Filter API permanent failure - should fail after all retries');
      default:
        return JSON.stringify([]);
    }
  }

  async mockScoreAbstracts(papers, isCorrection = false) {
    await this.checkAbortAndPause();
    this.callCount++;
    const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];
    await this.sleepWithAbortCheck(50 + Math.random() * 100);
    console.log(
      `Mock Abstract API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`
    );
    await this.checkAbortAndPause();

    switch (scenario) {
      case 'valid':
        return JSON.stringify(
          papers.map((_, idx) => ({
            paperIndex: idx + 1,
            score: generateRealisticScore(),
            justification: `Mock evaluation for test paper ${idx + 1}. This is a simulated relevance assessment.`,
          }))
        );
      case 'malformed':
        if (isCorrection) {
          return JSON.stringify(
            papers.map((_, idx) => ({
              paperIndex: idx + 1,
              score: generateRealisticScore(),
              justification: `Corrected mock evaluation for test paper ${idx + 1}.`,
            }))
          );
        }
        return `{"invalid": "json" "missing_comma": true}`;
      case 'missing_field':
        if (isCorrection) {
          return JSON.stringify(
            papers.map((_, idx) => ({
              paperIndex: idx + 1,
              score: generateRealisticScore(),
              justification: `Corrected mock evaluation for test paper ${idx + 1}.`,
            }))
          );
        }
        return JSON.stringify(
          papers.map((_, idx) => ({
            paperIndex: idx + 1,
            justification: `Mock evaluation missing score field.`,
          }))
        );
      case 'wrong_type':
        if (isCorrection) {
          return JSON.stringify(
            papers.map((_, idx) => ({
              paperIndex: idx + 1,
              score: generateRealisticScore(),
              justification: `Corrected mock evaluation for test paper ${idx + 1}.`,
            }))
          );
        }
        return JSON.stringify(
          papers.map((_, idx) => ({
            paperIndex: idx + 1,
            score: 'not_a_number',
            justification: `Mock evaluation with wrong score type.`,
          }))
        );
      case 'retry_failure':
        throw new Error('Mock API temporary failure - should trigger retry');
      case 'final_failure':
        throw new Error('Mock API permanent failure - should fail after all retries');
      default:
        return JSON.stringify([]);
    }
  }

  async mockAnalyzePDF(paper, isCorrection = false) {
    await this.checkAbortAndPause();
    this.callCount++;
    // Only advance the per-paper PDF counter on the initial call so
    // correction retries don't re-trigger the Playwright-skip scenario.
    if (!isCorrection) {
      this.pdfCallCount++;
    }
    const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];
    await this.sleepWithAbortCheck(100 + Math.random() * 200);
    console.log(
      `Mock PDF API Call ${this.callCount}: Testing scenario '${scenario}' for paper "${paper.title}"${isCorrection ? ' (correction)' : ''}`
    );
    await this.checkAbortAndPause();

    // Simulate the Playwright-unavailable + reCAPTCHA path on every 3rd
    // non-correction PDF call so dry-run users see the notification and
    // summary card. Match the 422 API error shape by throwing an Error with
    // `code: 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA'` — the pipeline's
    // analyzePDFs catch recognizes this code and aggregates the paper into
    // the `skippedDueToRecaptcha` store slice.
    if (!isCorrection && this.pdfCallCount % 3 === 0) {
      const skipErr = new Error('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
      skipErr.code = 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA';
      skipErr.arxivId = paper.arxivId ?? paper.id;
      skipErr.title = paper.title;
      throw skipErr;
    }

    switch (scenario) {
      case 'valid':
        return JSON.stringify({
          summary: `Mock deep analysis of "${paper.title}". This simulated analysis would include detailed technical content, methodology discussion, and comprehensive evaluation of the paper's contributions.`,
          keyFindings: `Key mock findings: Novel approach to ${Math.random() > 0.5 ? 'neural networks' : 'optimization'}, significant performance improvements, and potential applications in ${Math.random() > 0.5 ? 'computer vision' : 'natural language processing'}.`,
          methodology: `Mock methodology analysis: The authors employed ${Math.random() > 0.5 ? 'experimental' : 'theoretical'} approaches with ${Math.random() > 0.5 ? 'empirical' : 'analytical'} validation.`,
          limitations: `Mock limitations: Computational complexity, limited generalization, and potential scalability issues.`,
          relevanceAssessment: `Mock relevance assessment: This work is highly relevant to current research trends. Updated from abstract-only analysis.`,
          updatedScore: generateRealisticScore(),
        });
      case 'malformed':
        if (isCorrection) {
          return JSON.stringify({
            summary: `Corrected mock analysis of "${paper.title}".`,
            keyFindings: `Corrected key findings after initial formatting error.`,
            methodology: `Corrected methodology analysis.`,
            limitations: `Corrected limitations assessment.`,
            relevanceAssessment: `Corrected relevance assessment.`,
            updatedScore: generateRealisticScore(),
          });
        }
        return `{"summary": "Invalid JSON structure" missing_bracket: true`;
      case 'missing_field':
        if (isCorrection) {
          return JSON.stringify({
            summary: `Corrected mock analysis of "${paper.title}".`,
            keyFindings: `Corrected key findings.`,
            methodology: `Corrected methodology.`,
            limitations: `Corrected limitations.`,
            relevanceAssessment: `Corrected relevance assessment.`,
            updatedScore: generateRealisticScore(),
          });
        }
        return JSON.stringify({
          summary: `Mock analysis missing updatedScore field.`,
          keyFindings: `Mock findings.`,
        });
      case 'wrong_type':
        if (isCorrection) {
          return JSON.stringify({
            summary: `Corrected mock analysis of "${paper.title}".`,
            keyFindings: `Corrected key findings.`,
            methodology: `Corrected methodology.`,
            limitations: `Corrected limitations.`,
            relevanceAssessment: `Corrected relevance assessment.`,
            updatedScore: generateRealisticScore(),
          });
        }
        return JSON.stringify({
          summary: `Mock analysis with wrong type.`,
          updatedScore: 'not_a_number',
        });
      case 'retry_failure':
        throw new Error('Mock PDF API temporary failure - should trigger retry');
      case 'final_failure':
        throw new Error('Mock PDF API permanent failure - should fail after all retries');
      default:
        return JSON.stringify({});
    }
  }

  async mockRescoreAbstracts(papers, isCorrection = false) {
    await this.checkAbortAndPause();
    this.callCount++;
    const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];
    await this.sleepWithAbortCheck(50 + Math.random() * 100);
    console.log(
      `Mock Rescore API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`
    );

    const generateAdjustedScore = (initialScore) => {
      const adjustment = (Math.random() - 0.5) * 2 * (Math.random() > 0.7 ? 2.0 : 1.0);
      const adjusted = Math.max(0, Math.min(10, initialScore + adjustment));
      return Math.round(adjusted * 10) / 10;
    };

    const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];
    const adjustmentReasons = [
      'Initially over-scored compared to similar papers in batch',
      'Initially under-scored; stronger research alignment than first assessment',
      'Score maintained after comparative review',
      'Adjusted down due to less novel methodology than initially assessed',
      'Adjusted up based on stronger technical contribution',
      'Score confirmed as appropriate relative to other papers',
    ];

    if (scenario === 'valid' || isCorrection) {
      return JSON.stringify(
        papers.map((p, idx) => {
          const adjusted = generateAdjustedScore(p.initialScore || p.relevanceScore);
          const changed = Math.abs(adjusted - (p.initialScore || p.relevanceScore)) > 0.1;
          return {
            paperIndex: idx + 1,
            adjustedScore: adjusted,
            adjustmentReason: changed
              ? adjustmentReasons[Math.floor(Math.random() * adjustmentReasons.length)]
              : 'Score maintained after comparative review',
            confidence: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)],
          };
        })
      );
    }

    if (scenario === 'malformed') {
      if (isCorrection) {
        return JSON.stringify(
          papers.map((p, idx) => ({
            paperIndex: idx + 1,
            adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
            adjustmentReason: 'Corrected assessment',
            confidence: 'MEDIUM',
          }))
        );
      }
      return 'Not valid JSON {broken';
    }

    if (scenario === 'missing_field') {
      if (isCorrection) {
        return JSON.stringify(
          papers.map((p, idx) => ({
            paperIndex: idx + 1,
            adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
            adjustmentReason: 'Corrected assessment with all fields',
            confidence: 'HIGH',
          }))
        );
      }
      return JSON.stringify(
        papers.map((p, idx) => ({
          paperIndex: idx + 1,
          adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
        }))
      );
    }

    if (scenario === 'wrong_type') {
      if (isCorrection) {
        return JSON.stringify(
          papers.map((p, idx) => ({
            paperIndex: idx + 1,
            adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
            adjustmentReason: 'Corrected type assessment',
            confidence: 'LOW',
          }))
        );
      }
      return JSON.stringify(
        papers.map((p, idx) => ({
          paperIndex: idx + 1,
          adjustedScore: 'not_a_number',
          adjustmentReason: 'Test wrong type',
          confidence: 'INVALID',
        }))
      );
    }

    if (scenario === 'retry_failure') {
      throw new Error('Simulated API failure - should retry');
    }

    if (scenario === 'final_failure') {
      throw new Error('Simulated persistent failure');
    }

    return JSON.stringify(
      papers.map((p, idx) => ({
        paperIndex: idx + 1,
        adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
        adjustmentReason: 'Default mock assessment',
        confidence: 'MEDIUM',
      }))
    );
  }

  async mockGenerateNotebookLM(papers, targetDuration, model) {
    await this.checkAbortAndPause();
    this.callCount++;
    await this.sleepWithAbortCheck(100 + Math.random() * 200);
    console.log(
      `Mock NotebookLM API Call ${this.callCount}: Generating ${targetDuration}-minute document with ${model}`
    );
    await this.checkAbortAndPause();

    const durationText =
      {
        5: 'Quick Overview',
        10: 'Standard Discussion',
        15: 'Detailed Analysis',
        20: 'In-depth Coverage',
        30: 'Comprehensive Review',
      }[targetDuration] || 'Custom Duration';

    return `# Research Analysis: Mock Test Papers for ${durationText}

## Executive Summary
This is a mock NotebookLM document generated for testing purposes. The analysis covers ${papers.length} papers with a target podcast duration of ${targetDuration} minutes using the ${model} model.

## Research Context and Methodology
This document was generated through the Aparture testing system to validate NotebookLM integration. The papers analyzed represent a diverse range of topics in computer science and related fields.

## Thematic Analysis

### Theme 1: Machine Learning Advances
Several papers in this collection focus on breakthrough ML techniques...

#### Key Papers in This Theme
${papers
  .slice(0, Math.min(3, papers.length))
  .map(
    (p) => `- **${p.title}** (Score: ${p.score || p.relevanceScore || 0}/10)
  - Core Contribution: Mock contribution for ${p.title}
  - Methodological Approach: Simulated methodology description
  - Principal Findings: Test findings placeholder`
  )
  .join('\n')}

### Theme 2: System Architecture Innovations
Another significant theme involves novel system architectures...

## Comparative Insights
The papers demonstrate complementary approaches that could be synthesized for greater impact. Notable connections include shared methodological frameworks and overlapping application domains.

## Key Takeaways for Practitioners
- Method adoption recommendations based on analyzed papers
- Implementation considerations for production systems
- Future research directions suggested by the collective findings

## Discussion Prompts for Podcast
- What are the most surprising findings across these papers?
- How do these advances change current practice in the field?
- What technical challenges remain unsolved?
- Where might this research lead in the next 5 years?

---
*Document prepared for NotebookLM podcast generation. Target duration: ${targetDuration} minutes. Model: ${model}. Generated at: ${new Date().toISOString()}*`;
  }
}
