# NotebookLM Podcast Generation Prompts

This guide provides optimized prompts for generating technical podcasts using NotebookLM based on Aparture analysis reports. Choose the prompt that matches your selected podcast duration.

## Before You Start

### Documents to Upload

1. **Main Analysis Report** - The comprehensive markdown report from Aparture
2. **NotebookLM Document** - The structured document generated specifically for podcast creation

### Key Instructions for All Durations

- The podcast should maintain an **expert-to-expert** tone throughout
- Assume listeners have technical familiarity with the field
- Focus on methodological innovations and research implications
- Include critical analysis, not just summaries
- Discuss connections between papers and emerging themes
- **CRITICAL: Always cite papers by author names and year when discussing any finding**
- **Mention paper titles when introducing major contributions**
- **Use phrases like "Smith et al. 2025 showed that..." or "In the Johnson paper on X..."**
- **This attribution is ESSENTIAL for listeners to follow up on interesting work**

---

## 5 Minutes - Quick Overview

### 5min Prompt

```text
Generate a 5-minute technical podcast discussing the key research findings in these documents. Focus on the top 3-5 most impactful papers and their main contributions.

Structure:
1. Quick introduction to the research landscape (30 seconds)
2. Highlight the most significant finding across all papers (90 seconds)
3. Briefly discuss 2-3 other notable contributions (2 minutes)
4. Identify one emerging theme or future direction (90 seconds)
5. Wrap-up with key takeaway for researchers (30 seconds)

Maintain an expert tone. Skip basic explanations and dive directly into technical implications. Prioritize breakthrough methods and surprising results over incremental work.

CITATION REQUIREMENT: Even in this short format, always cite papers by author (e.g., "The Chen et al. paper shows..."). Never discuss findings without attribution.
```

---

## 10 Minutes - Standard Discussion

### 10min Prompt

```text
Create a 10-minute expert-level podcast analyzing the research presented in these documents. Balance breadth and depth by covering major themes while diving into specific technical details.

Structure:
1. Set the research context and why these papers matter (1 minute)
2. Discuss the first major theme with 2-3 supporting papers (3 minutes)
3. Explore a second theme or methodological trend (3 minutes)
4. Analyze connections and contradictions between papers (2 minutes)
5. Future implications and open questions (1 minute)

Focus on:
- Novel methodologies that other researchers should know about
- Surprising findings that challenge current understanding
- Technical details that reveal deeper insights
- Practical implications for ongoing research

Keep the discussion at a graduate/postdoc level, assuming familiarity with the field's fundamentals.

ATTRIBUTION: Always mention author names when discussing findings (e.g., "Wang et al.'s novel approach...", "The surprising result from Liu and colleagues..."). This helps listeners locate papers for deeper reading.
```

---

## 15 Minutes - Detailed Analysis

### 15min Prompt

```text
Produce a 15-minute technical podcast providing detailed analysis of the research landscape captured in these documents. This should serve as a comprehensive briefing for active researchers in the field.

Structure:
1. Research landscape overview and significance (1.5 minutes)
2. Deep dive into Theme 1 with technical details (4 minutes)
   - Core papers and their contributions
   - Methodological innovations
   - Strengths and limitations
3. Deep dive into Theme 2 (4 minutes)
   - Complementary or competing approaches
   - Technical implementation details
   - Reproducibility considerations
4. Comparative analysis across all papers (3 minutes)
   - Common patterns and divergences
   - Quality of evidence
   - Methodological rigor
5. Research implications and actionable insights (2.5 minutes)

Emphasize:
- Technical depth that would interest specialists
- Critical evaluation of methods and claims
- Connections to broader research trends
- Specific techniques worth adopting
- Gaps that represent opportunities

Maintain high technical standards throughout, discussing statistical significance, experimental design, and theoretical foundations where relevant.

CITATION PROTOCOL: Every technical point must reference its source. Use clear attributions: "According to the Park et al. study...", "The Kumar paper on [topic] demonstrates...", "As shown by Martinez and colleagues in their work on [topic]..."
```

---

## 20 Minutes - In-depth Coverage (Recommended)

### 20min Prompt

```text
Generate a 20-minute comprehensive podcast for research professionals, providing in-depth coverage of the papers and themes in these documents. This should be valuable for researchers deciding which papers to read in full and which methods to explore.

Structure:
1. Introduction and research context (2 minutes)
   - Why this collection of papers matters now
   - Connection to major challenges in the field

2. First major research theme (6 minutes)
   - Detailed discussion of 3-4 key papers
   - Technical implementation details
   - Comparative strengths and weaknesses
   - Reproducibility and code availability

3. Second major research theme (6 minutes)
   - Alternative approaches to similar problems
   - Methodological innovations worth adopting
   - Critical analysis of claims and evidence

4. Cross-cutting analysis (4 minutes)
   - Synthesis across themes
   - Contradictions and controversies
   - Quality assessment of the overall body of work

5. Forward-looking discussion (2 minutes)
   - Next steps for the field
   - Most promising directions
   - Practical recommendations for researchers

Include:
- Specific equation or algorithm mentions where groundbreaking
- Discussion of experimental setups and datasets
- Honest critique of limitations and overselling
- Recommendations for which papers deserve full reads vs skims
- Potential collaboration opportunities suggested by complementary work

Assume listeners are deciding how to allocate their limited time and resources. Help them prioritize.

ESSENTIAL FOR FOLLOW-UP: When recommending papers, always use full attribution: "The must-read is the Zhang et al. paper titled 'X' because...", "You can skip the Brown study unless...". Every recommendation must include author names so listeners can find the papers.
```

---

## 30 Minutes - Comprehensive Review

### 30min Prompt

```text
Create a 30-minute comprehensive podcast providing exhaustive coverage of the research documented here. This should serve as a definitive technical briefing that could replace reading the abstracts for time-constrained researchers.

Structure:
1. Setting the stage (3 minutes)
   - Research landscape and driving questions
   - Why this particular collection matters
   - Overview of major themes and tensions

2. Theme 1: [Identify from document] (8 minutes)
   - Detailed technical walkthrough of key papers
   - Mathematical/algorithmic innovations
   - Experimental methodology critique
   - Reproducibility and open science aspects
   - Direct comparisons between approaches

3. Theme 2: [Identify from document] (8 minutes)
   - Deep technical analysis
   - Implementation challenges and solutions
   - Data requirements and limitations
   - Generalization potential
   - Connection to theoretical foundations

4. Theme 3 or Cross-theme synthesis (6 minutes)
   - Emerging patterns across all papers
   - Methodological meta-analysis
   - Quality and rigor assessment
   - Identifying hype vs substance

5. Critical discussion (3 minutes)
   - What's genuinely new vs incremental
   - Red flags and concerns
   - Overselling and underselling

6. Actionable insights (2 minutes)
   - Specific recommendations for different researcher types
   - Tools and resources to explore
   - Collaboration opportunities
   - Grant proposal angles

Throughout the discussion:
- Name specific techniques, equations, and algorithms
- Discuss computational requirements and scalability
- Address statistical power and significance
- Compare to gold-standard baselines
- Identify which claims are well-supported vs speculative
- Suggest follow-up experiments

This comprehensive review should leave listeners feeling they have a complete understanding of the current research landscape and concrete next steps for their own work.

COMPREHENSIVE CITATION REQUIREMENT: In this extended format, maintain rigorous attribution throughout:
- Start each topic with "The [Author] et al. paper on [topic] introduces..."
- Use varied citation styles: "As demonstrated by [Author] and colleagues...", "In '[Paper Title]' by [Author] et al....", "[Author]'s team found that..."
- When comparing papers: "While [Author1] et al. argue X, [Author2]'s group shows Y..."
- Never leave listeners wondering "which paper was that?" - every claim needs clear attribution
```

---

## Tips for Using These Prompts

### Customization

- Add your specific field or domain to make discussions more targeted
- Include particular technical aspects you want emphasized
- Specify if you want more focus on theory vs applications

### Quality Checks

After generating the podcast, verify that it:

- Maintains technical accuracy
- Avoids oversimplification
- Includes critical analysis, not just summaries
- Provides actionable insights for researchers
- Correctly attributes EVERY finding to specific papers with author names
- Uses frequent citations throughout (aim for author names every 30-60 seconds)
- Makes it easy for listeners to identify which paper to read for any topic
- Never discusses results without clear attribution

### Follow-up Prompts

If the initial generation needs adjustment:

- "Make the discussion more technical and less introductory"
- "Add more critical analysis of the methodological limitations"
- "Include more specific details about the algorithms and implementations"
- "Compare these findings more directly to established baselines in the field"
- "Focus more on practical implications for researchers starting new projects"
- "Add more specific citations - always mention author names when discussing findings"
- "Include paper titles when introducing major contributions"
- "Ensure every technical claim is attributed to its source paper by author"

### Integration with Research Workflow

Consider using these podcasts for:

- Lab meeting preparations
- Literature review sessions
- Grant proposal brainstorming
- Identifying collaboration opportunities
- Staying current with rapid developments

---

## Notes on Aparture + NotebookLM Integration

The two-document approach (main report + NotebookLM document) provides NotebookLM with both detailed technical content and a pre-structured narrative framework. This combination typically produces higher-quality podcasts that:

1. Stay focused on the most important findings
2. Maintain logical flow between topics
3. Include appropriate technical depth
4. Provide balanced coverage across papers
5. Generate meaningful synthesis and insights

For best results, always upload both documents and use these prompts as a starting point, adjusting based on your specific needs and audience.
