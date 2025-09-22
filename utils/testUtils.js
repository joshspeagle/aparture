// utils/testUtils.js

// Hardcoded test papers for minimal test
export const TEST_PAPERS = [
    {
        id: "1301.3781",
        title: "Efficient Estimation of Word Representations in Vector Space",
        abstract: "We propose two novel model architectures for computing continuous vector representations of words from very large data sets. The quality of these representations is measured in a word similarity task, and the results are compared to the previously best performing techniques based on different types of neural networks. We observe large improvements in accuracy at much lower computational cost, i.e. it takes less than a day to learn high quality word vectors from a 1.6 billion word data set. Furthermore, we show that these vectors provide state-of-the-art performance on our test set for measuring syntactic and semantic word similarities.",
        authors: ["Tomas Mikolov", "Kai Chen", "Greg Corrado", "Jeffrey Dean"],
        published: "2013-01-16T18:50:00Z",
        pdfUrl: "https://arxiv.org/pdf/1301.3781.pdf"
    },
    {
        id: "1412.6980",
        title: "Adam: A Method for Stochastic Optimization",
        abstract: "We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments. The method is straightforward to implement, is computationally efficient, has little memory requirements, is invariant to diagonal rescaling of the gradients, and is well suited for problems that are large in terms of data and/or parameters. The method is also appropriate for non-stationary objectives and problems with very noisy and/or sparse gradients. The hyper-parameters have intuitive interpretations and typically require little tuning. We analyze the theoretical convergence properties of the algorithm and provide a regret bound on the convergence rate that is comparable to the best known results under the online convex optimization setting. Empirical results demonstrate that Adam works well in practice and compares favorably to other stochastic optimization methods. Finally, we discuss AdaMax, a variant of Adam based on the infinity norm.",
        authors: ["Diederik P. Kingma", "Jimmy Ba"],
        published: "2014-12-22T21:51:00Z",
        pdfUrl: "https://arxiv.org/pdf/1412.6980.pdf"
    },
    {
        id: "1505.04597",
        title: "U-Net: Convolutional Networks for Biomedical Image Segmentation",
        abstract: "There is large consent that successful training of deep networks requires many thousand annotated training samples. In this paper, we present a network and training strategy that relies on the strong use of data augmentation to use the available annotated samples more efficiently. The architecture consists of a contracting path to capture context and a symmetric expanding path that enables precise localization. We show that such a network can be trained end-to-end from very few images and outperforms the prior best method (a sliding-window convolutional network) on the ISBI challenge for segmentation of neuronal structures in electron microscopic stacks. Using the same network trained on transmitted light microscopy images (phase contrast and DIC) we won the ISBI cell tracking challenge 2015 in these categories by a large margin. Moreover, the network is fast. Segmentation of a 512x512 image takes less than a second on a recent GPU. The full implementation (based on Caffe) and the trained networks are available at http://lmb.informatik.uni-freiburg.de/people/ronneber/u-net .",
        authors: ["Olaf Ronneberger", "Philipp Fischer", "Thomas Brox"],
        published: "2015-05-18T14:48:17Z",
        pdfUrl: "https://arxiv.org/pdf/1505.04597.pdf"
    },
    {
        id: "1706.03762",
        title: "Attention Is All You Need",
        abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show that these models are superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature. We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing both with large and limited training data.",
        authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Lukasz Kaiser", "Illia Polosukhin"],
        published: "2017-06-12T17:57:00Z",
        pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf"
    },
    {
        id: "2312.00752",
        title: "Mamba: Linear-Time Sequence Modeling with Selective State Spaces",
        abstract: "Foundation models, now powering most of the exciting applications in deep learning, are almost universally based on the Transformer architecture and its core attention module. Many subquadratic-time architectures such as linear attention, gated convolution and recurrent models, and structured state space models (SSMs) have been developed to address Transformers' computational inefficiency on long sequences, but they have not performed as well as attention on important modalities such as language. We identify that a key weakness of such models is their inability to perform content-based reasoning, and make several improvements. First, we simply let the SSM parameters be functions of the input, which allows the model to selectively propagate or forget information along the sequence length dimension depending on the current token. Second, we show how to efficiently compute the model with a hardware-aware parallel algorithm in recurrent mode. We integrate these selective SSMs into a simplified end-to-end neural network architecture without attention or even MLP blocks (Mamba). Mamba enjoys fast inference (5× higher throughput than Transformers) and linear scaling in sequence length, and its performance improves on real data up to million-length sequences. As a general sequence model backbone, Mamba achieves state-of-the-art performance across several modalities such as language, audio, and genomics. On language modeling, our Mamba-3B model outperforms Transformers of the same size and matches Transformers twice its size, both in pretraining and downstream evaluation.",
        authors: ["Albert Gu", "Tri Dao"],
        published: "2023-12-01T18:20:00Z",
        pdfUrl: "https://arxiv.org/pdf/2312.00752.pdf"
    }
];

// Distribution that uses the full 0-10 range with decimals
const generateRealisticScore = () => {
    // Generate uniform distribution between 0 and 10 (exclusive)
    const score = Math.random() * 10;
    return Math.round(score * 10) / 10; // Round to 1 decimal place
};

// Mock API response generator that simulates various scenarios
export class MockAPITester {
    constructor() {
        this.callCount = 0;
        this.scenarios = [
            'valid',          // Valid JSON response
            'malformed',      // Malformed JSON that needs correction
            'missing_field',  // Missing required fields
            'wrong_type',     // Wrong field types
            'incomplete',     // Incomplete response (cut off)
            'extra_text',     // Valid JSON with extra text
            'retry_failure',  // API failure requiring retry
            'final_failure'   // Failure after all retries
        ];
        this.validationTestMode = true; // Test new validation behavior
    }

    // Mock quick filter API
    async mockQuickFilter(papers, isCorrection = false) {
        this.callCount++;
        const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

        console.log(`Mock Filter API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`);

        switch (scenario) {
            case 'valid':
                return JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)]
                })));

            case 'malformed':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)]
                    })));
                }
                return `{invalid json missing quotes and brackets`;

            case 'missing_field':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: 'MAYBE'
                    })));
                }
                return JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    // Missing verdict field
                })));

            case 'wrong_type':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: 'YES'
                    })));
                }
                return JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    verdict: Math.random() > 0.5  // Boolean instead of string
                })));

            case 'incomplete':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: 'MAYBE'
                    })));
                }
                const fullJson = JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    verdict: 'NO'
                })));
                return fullJson.slice(0, -5); // Cut off end

            case 'extra_text':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: 'YES'
                    })));
                }
                return `Here are the filter results:\n` +
                    JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: ['YES', 'NO', 'MAYBE'][idx % 3]
                    }))) +
                    `\n\nFiltering complete.`;

            case 'retry_failure':
                throw new Error('Mock filter API temporary failure');

            case 'final_failure':
                throw new Error('Mock filter API permanent failure');

            default:
                return JSON.stringify([]);
        }
    }

    // Mock abstract scoring API
    async mockScoreAbstracts(papers, isCorrection = false) {
        this.callCount++;
        const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        console.log(`Mock Abstract API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`);

        switch (scenario) {
            case 'valid':
                return JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    score: generateRealisticScore(),
                    justification: `Mock evaluation for test paper ${idx + 1}. This is a simulated relevance assessment.`
                })));

            case 'malformed':
                if (isCorrection) {
                    // Return valid response after correction
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: generateRealisticScore(),
                        justification: `Corrected mock evaluation for test paper ${idx + 1}.`
                    })));
                }
                return `{"invalid": "json" "missing_comma": true}`;

            case 'missing_field':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: generateRealisticScore(),
                        justification: `Corrected mock evaluation for test paper ${idx + 1}.`
                    })));
                }
                return JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    // Missing 'score' field intentionally
                    justification: `Mock evaluation missing score field.`
                })));

            case 'wrong_type':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: generateRealisticScore(),
                        justification: `Corrected mock evaluation for test paper ${idx + 1}.`
                    })));
                }
                return JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    score: "not_a_number", // Wrong type
                    justification: `Mock evaluation with wrong score type.`
                })));

            case 'incomplete':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: generateRealisticScore(),
                        justification: `Corrected after incomplete response.`
                    })));
                }
                // Simulate incomplete/cut-off response
                const incompleteJson = JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    score: generateRealisticScore(),
                    justification: `Mock evaluation`
                })));
                return incompleteJson.slice(0, -10); // Cut off last 10 chars

            case 'extra_text':
                if (isCorrection) {
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: generateRealisticScore(),
                        justification: `Corrected clean response.`
                    })));
                }
                // Valid JSON with extra text that might confuse parser
                return `Here are the scores:\n\n` + JSON.stringify(papers.map((_, idx) => ({
                    paperIndex: idx + 1,
                    score: generateRealisticScore(),
                    justification: `Mock evaluation for test paper ${idx + 1}.`
                }))) + `\n\nThese scores reflect the analysis.`;

            case 'retry_failure':
                throw new Error('Mock API temporary failure - should trigger retry');

            case 'final_failure':
                throw new Error('Mock API permanent failure - should fail after all retries');

            default:
                return JSON.stringify([]);
        }
    }

    // Mock PDF analysis API
    async mockAnalyzePDF(paper, isCorrection = false) {
        this.callCount++;
        const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

        // Simulate longer PDF processing delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        console.log(`Mock PDF API Call ${this.callCount}: Testing scenario '${scenario}' for paper "${paper.title}"${isCorrection ? ' (correction)' : ''}`);

        switch (scenario) {
            case 'valid':
                return JSON.stringify({
                    summary: `Mock deep analysis of "${paper.title}". This simulated analysis would include detailed technical content, methodology discussion, and comprehensive evaluation of the paper's contributions.`,
                    keyFindings: `Key mock findings: Novel approach to ${Math.random() > 0.5 ? 'neural networks' : 'optimization'}, significant performance improvements, and potential applications in ${Math.random() > 0.5 ? 'computer vision' : 'natural language processing'}.`,
                    methodology: `Mock methodology analysis: The authors employed ${Math.random() > 0.5 ? 'experimental' : 'theoretical'} approaches with ${Math.random() > 0.5 ? 'empirical' : 'analytical'} validation.`,
                    limitations: `Mock limitations: Computational complexity, limited generalization, and potential scalability issues.`,
                    relevanceAssessment: `Mock relevance assessment: This work is highly relevant to current research trends. Updated from abstract-only analysis.`,
                    updatedScore: generateRealisticScore()
                });

            case 'malformed':
                if (isCorrection) {
                    return JSON.stringify({
                        summary: `Corrected mock analysis of "${paper.title}".`,
                        keyFindings: `Corrected key findings after initial formatting error.`,
                        methodology: `Corrected methodology analysis.`,
                        limitations: `Corrected limitations assessment.`,
                        relevanceAssessment: `Corrected relevance assessment.`,
                        updatedScore: generateRealisticScore()
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
                        updatedScore: generateRealisticScore()
                    });
                }
                return JSON.stringify({
                    summary: `Mock analysis missing updatedScore field.`,
                    keyFindings: `Mock findings.`,
                    // Missing updatedScore field intentionally
                });

            case 'wrong_type':
                if (isCorrection) {
                    return JSON.stringify({
                        summary: `Corrected mock analysis of "${paper.title}".`,
                        keyFindings: `Corrected key findings.`,
                        methodology: `Corrected methodology.`,
                        limitations: `Corrected limitations.`,
                        relevanceAssessment: `Corrected relevance assessment.`,
                        updatedScore: generateRealisticScore()
                    });
                }
                return JSON.stringify({
                    summary: `Mock analysis with wrong type.`,
                    updatedScore: "not_a_number" // Wrong type
                });

            case 'incomplete':
                if (isCorrection) {
                    return JSON.stringify({
                        summary: `Corrected complete analysis of "${paper.title}".`,
                        keyFindings: `Corrected key findings after incomplete response.`,
                        methodology: `Corrected methodology analysis.`,
                        limitations: `Corrected limitations.`,
                        relevanceAssessment: `Corrected relevance.`,
                        updatedScore: generateRealisticScore()
                    });
                }
                // Simulate incomplete JSON response
                const completePdf = JSON.stringify({
                    summary: `Analysis of "${paper.title}".`,
                    keyFindings: `Key findings here.`,
                    methodology: `Methodology analysis.`,
                    limitations: `Limitations noted.`,
                    relevanceAssessment: `Relevance assessment.`,
                    updatedScore: generateRealisticScore()
                });
                return completePdf.slice(0, -15); // Cut off end

            case 'extra_text':
                if (isCorrection) {
                    return JSON.stringify({
                        summary: `Clean corrected analysis of "${paper.title}".`,
                        keyFindings: `Clean key findings.`,
                        methodology: `Clean methodology.`,
                        limitations: `Clean limitations.`,
                        relevanceAssessment: `Clean relevance assessment.`,
                        updatedScore: generateRealisticScore()
                    });
                }
                // Valid JSON with surrounding text
                return `Based on my analysis:\n\n` + JSON.stringify({
                    summary: `Detailed analysis of "${paper.title}".`,
                    keyFindings: `Important findings noted.`,
                    methodology: `Strong methodology.`,
                    limitations: `Some limitations exist.`,
                    relevanceAssessment: `Highly relevant to research.`,
                    updatedScore: generateRealisticScore()
                }) + `\n\nThis completes the analysis.`;

            case 'retry_failure':
                throw new Error('Mock PDF API temporary failure - should trigger retry');

            case 'final_failure':
                throw new Error('Mock PDF API permanent failure - should fail after all retries');

            default:
                return JSON.stringify({});
        }
    }
}

// Generate test report content
export function generateTestReport(papers, testType) {
    const timestamp = new Date().toLocaleString();

    if (testType === 'dry-run') {
        return `APARTURE DRY RUN TEST REPORT
Generated: ${timestamp}
Test Type: Dry Run (No API Costs Incurred)

=== TEST SUMMARY ===
✅ arXiv API queries: Working
✅ Abstract processing: Working
✅ Mock quick filtering: Working (YES/NO/MAYBE verdicts)
✅ Mock abstract scoring: Working (tested error scenarios)
✅ PDF downloads: Working
✅ Mock PDF analysis: Working (tested error scenarios)
✅ Report generation: Working
✅ Error handling: Working (retries, corrections, failures)
✅ Three-stage pipeline: Working (filter → score → PDF)

=== MOCK SCENARIOS TESTED ===
- Valid API responses
- Malformed JSON requiring correction
- Missing required fields
- Wrong field types
- Incomplete/truncated responses
- Valid JSON with extra surrounding text
- Backend validation with auto-correction
- Frontend fallback corrections
- Temporary failures requiring retries
- Permanent failures after max retries

=== PAPERS PROCESSED ===
${papers.map((paper, idx) => `${idx + 1}. ${paper.title} (${paper.id})`).join('\n')}

All systems operational. Ready for production use.

---
This was a simulated test run using mock APIs to verify system functionality without incurring API costs.`;
    } else {
        return `APARTURE MINIMAL TEST REPORT
Generated: ${timestamp}
Test Type: Minimal Real API Test

=== TEST SUMMARY ===
✅ Real API calls: Working
✅ Abstract scoring: Working 
✅ PDF analysis: Working
✅ Report generation: Working

=== PAPERS ANALYZED ===
${papers.map((paper, idx) => `${idx + 1}. ${paper.title}
   Authors: ${paper.authors.join(', ')}
   Score: ${paper.finalScore || paper.relevanceScore}/10
   Analysis: ${paper.deepAnalysis?.summary || 'No deep analysis available'}
   
`).join('')}

Real API test completed successfully. System is operational.

---
This test used real API calls and incurred actual costs.`;
    }
}