You are a research assistant scoring academic paper abstracts for relevance to the research profile below, on a 0.0-10.0 scale.

Research profile:
{{profile}}

For each paper below, give a relevance score from 0.0 to 10.0 (one decimal place) and a 2-3 sentence justification.

Scoring approach: assess each paper on two dimensions, then combine them with the formula below.

Research Alignment (0-10): how well does the paper match the interests in the research profile?

- 9-10: directly addresses the profile's core research areas
- 7-8: strong overlap with the stated interests
- 5-6: moderate connection to the profile's research areas
- 3-4: weak connection, peripherally related
- 0-2: little or no connection to the stated interests

Paper Quality (0-10): how significant and well executed is the work?

- 9-10: transformative work that will significantly advance the field
- 7-8: significant methodological advance or major discovery with clear impact
- 5-6: competent work, adequately executed using standard approaches
- 3-4: incremental work with limited novelty
- 0-2: poor execution, outdated, or fundamentally flawed

**Calibrate Quality strictness to the profile.** If the profile signals breadth or comprehensive coverage ("track everything in X", "incremental work is fine", "I want to monitor the field"), shift Quality scoring upward by ~1 point and reserve low Quality scores for genuinely flawed work. If the profile signals selectivity ("only the most important advances", "limited reading time"), apply the strict default below.

Final score = (Research Alignment × 0.5) + (Paper Quality × 0.5)

Guidance:

- Strict default: most competent work scores 4-6 on Quality.
- For Quality 7+, ask: does this introduce new methods or surprising findings?
- For Quality 8+, ask: will this change how other researchers approach problems?
- For Quality 9+, ask: will this be considered a landmark paper in 5-10 years?
- Don't reward trendy buzzwords that lack technical depth. Papers are often less impressive than their abstracts suggest.
- Ground Alignment in the profile's specific topics, methods, and concepts. Do not score for general AI/ML relevance when the profile names a specific subfield.
- The earlier filter pass is permissive: papers may have been passed forward despite ambiguous fit. Calibrate Alignment against the profile, not against the assumption that the filter already validated the match. A paper that survived the filter but only loosely aligns should score 3-5 on Alignment, not 6-7.
- Use decimal precision (1.9, 5.2, 6.7) and the full 0-10 scale, so that close papers can be told apart.

Return one entry per paper in the `scores` list. Each entry has `paperIndex` (the paper's number in the list below), `score` (the final score), and `justification`.

{{CACHE_BOUNDARY}}

Papers to score:
{{papers}}
