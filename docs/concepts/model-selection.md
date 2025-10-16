# Model Selection

Choosing the right AI models for each stage of analysis.

## Available Models

Aparture supports models from three providers:

### Anthropic (Claude)

**Claude Opus 4.1** - Most capable

- **Best for**: PDF analysis, complex reasoning
- **Speed**: Slow
- **Cost**: Highest
- **Context**: 200K tokens
- **Vision**: Excellent

**Claude Sonnet 4.5** - Balanced

- **Best for**: Abstract scoring, general use
- **Speed**: Medium
- **Cost**: Medium
- **Context**: 200K tokens
- **Vision**: Good

**Claude Haiku 4.5** - Fast, intelligent & cheap

- **Best for**: Quick filtering, batch processing, coding
- **Speed**: Fast
- **Cost**: Low
- **Context**: 200K tokens (1M available on Developer Platform)
- **Vision**: Good

### OpenAI (ChatGPT)

**GPT-5** - High quality

- **Best for**: Any stage, comprehensive analysis
- **Speed**: Medium
- **Cost**: High
- **Context**: 272K tokens
- **Vision**: Excellent

**GPT-5 Mini** - Balanced

- **Best for**: Abstract scoring, moderate complexity
- **Speed**: Fast
- **Cost**: Medium
- **Context**: 272K tokens
- **Vision**: Good

**GPT-5 Nano** - Efficient

- **Best for**: Quick filtering, simple tasks
- **Speed**: Very fast
- **Cost**: Low
- **Context**: 272K tokens
- **Vision**: Basic

### Google (Gemini)

**Gemini 2.5 Pro** - Premium

- **Best for**: Complex analysis, reasoning
- **Speed**: Medium
- **Cost**: High
- **Context**: 1M tokens
- **Vision**: Excellent

**Gemini 2.5 Flash** - Efficient

- **Best for**: Most stages, good balance
- **Speed**: Fast
- **Cost**: Medium
- **Context**: 1M tokens
- **Vision**: Good

**Gemini 2.5 Flash-Lite** - Budget

- **Best for**: Quick filtering, high volume
- **Speed**: Very fast
- **Cost**: Very low
- **Context**: 1M tokens
- **Vision**: Basic

::: info Context window
All models have sufficient context for Aparture's needs. Paper abstracts are typically <500 tokens, and PDFs rarely exceed 50K tokens.
:::

## Recommended Configurations

### Budget Configuration

**Goal**: Minimize costs while maintaining acceptable quality

```
Quick Filter: Claude Haiku 4.5
Abstract Scoring: Gemini Flash
PDF Analysis: Claude Sonnet 4.5
NotebookLM: Claude Opus 4.1 (fixed)
```

**Daily cost** (30 papers, 10 PDFs):

- Quick Filter: ~$0.05
- Abstract Scoring: ~$0.20
- PDF Analysis: ~$1.50
- NotebookLM: ~$0.30
- **Total**: ~$2.05/day

**Pros:**

- Very affordable for daily use
- Reasonable quality
- Fast processing

**Cons:**

- Lower scoring accuracy
- Less detailed PDF analyses
- May miss subtle relevance

### Balanced Configuration (Recommended)

**Goal**: Best quality-to-cost ratio

```
Quick Filter: Claude Haiku 4.5
Abstract Scoring: Claude Sonnet 4.5
PDF Analysis: Claude Opus 4.1
NotebookLM: Claude Opus 4.1 (fixed)
```

**Daily cost** (30 papers, 10 PDFs):

- Quick Filter: ~$0.05
- Abstract Scoring: ~$0.60
- PDF Analysis: ~$3.00
- NotebookLM: ~$0.30
- **Total**: ~$3.95/day

**Pros:**

- Excellent scoring accuracy
- High-quality PDF analyses
- Reliable relevance detection

**Cons:**

- Moderate cost
- Slower than budget config

### Premium Configuration

**Goal**: Maximum quality, cost secondary

```
Quick Filter: Claude Sonnet 4.5
Abstract Scoring: Claude Opus 4.1
PDF Analysis: Claude Opus 4.1
NotebookLM: Claude Opus 4.1 (fixed)
```

**Daily cost** (30 papers, 10 PDFs):

- Quick Filter: ~$0.15
- Abstract Scoring: ~$2.00
- PDF Analysis: ~$3.00
- NotebookLM: ~$0.30
- **Total**: ~$5.45/day

**Pros:**

- Best possible quality
- Nuanced understanding
- Detailed justifications

**Cons:**

- Expensive for daily use
- Slower processing
- Diminishing returns on some stages

### Speed-Optimized Configuration

**Goal**: Fastest possible analysis

```
Quick Filter: Gemini Flash-Lite
Abstract Scoring: Gemini Flash
PDF Analysis: GPT-5 Mini
NotebookLM: Claude Opus 4.1 (fixed)
```

**Daily cost** (30 papers, 10 PDFs):

- Quick Filter: ~$0.02
- Abstract Scoring: ~$0.15
- PDF Analysis: ~$1.80
- NotebookLM: ~$0.30
- **Total**: ~$2.27/day

**Analysis time**: ~50% faster than balanced

**Pros:**

- Very fast completion
- Low cost
- Good enough for many use cases

**Cons:**

- Lower quality scoring
- Less detailed analyses

## Stage-Specific Recommendations

### Quick Filter (Stage 1)

**Purpose**: Fast YES/NO/MAYBE classification

**Best models:**

1. **Claude Haiku 4.5** - Best balance of speed and accuracy
2. **Gemini Flash-Lite** - Fastest, cheapest
3. **GPT-5 Nano** - Good alternative

**Don't use:**

- ❌ Opus/GPT-5 - Overkill for simple task
- ❌ Sonnet/GPT-5 Mini - Unnecessary cost

**Why it matters:**

- Processes all papers (high volume)
- Simple binary decision
- Cost adds up quickly

### Abstract Scoring (Stage 2)

**Purpose**: Detailed relevance scoring (0-10)

**Best models:**

1. **Claude Sonnet 4.5** - Best balance (recommended)
2. **Claude Opus 4.1** - Highest quality
3. **GPT-5** - Excellent alternative

**Good alternatives:**

- Gemini Flash - Budget option
- GPT-5 Mini - Fast and decent

**Don't use:**

- ❌ Haiku/Nano/Flash-Lite - Too simple for nuanced scoring

**Why it matters:**

- Core filtering step
- Determines which papers get deep analysis
- Quality directly impacts results

### PDF Analysis (Stage 3)

**Purpose**: Deep analysis of full papers

**Best models:**

1. **Claude Opus 4.1** - Best vision + reasoning (recommended)
2. **GPT-5** - Excellent alternative
3. **Gemini 2.5 Pro** - Good for long papers

**Acceptable alternatives:**

- Claude Sonnet 4.5 - Budget option
- GPT-5 Mini - Fast budget option

**Don't use:**

- ❌ Haiku/Nano/Flash-Lite - Insufficient for deep analysis

**Why it matters:**

- Most expensive stage (long context)
- Creates value-add summaries
- Vision capability important for figures/equations

### Post-Processing (Optional)

**Purpose**: Re-score papers for consistency

**Best models:**

- Same as Abstract Scoring
- **Recommended**: Claude Sonnet 4.5 or Opus 4.1

**Note**: This stage compares papers side-by-side, so use a high-quality model.

### NotebookLM Document Generation

**Fixed**: Claude Opus 4.1

This stage requires the highest quality model to create well-structured, podcast-optimized documents. The model is not configurable.

## Cost Analysis

### Cost Breakdown (Typical Daily Run)

**Assumptions:**

- 30 papers fetched
- Quick Filter enabled (20 pass to scoring)
- 10 papers selected for PDF analysis
- Average PDF size: 2.5 MB (~40K tokens)

**Budget Config**: $2.05/day

```
Quick Filter (Haiku):     $0.05
Abstract Scoring (Flash): $0.20
PDF Analysis (Sonnet):    $1.50
NotebookLM (Opus):        $0.30
```

**Balanced Config**: $3.95/day

```
Quick Filter (Haiku):     $0.05
Abstract Scoring (Sonnet):$0.60
PDF Analysis (Opus):      $3.00
NotebookLM (Opus):        $0.30
```

**Premium Config**: $5.45/day

```
Quick Filter (Sonnet):    $0.15
Abstract Scoring (Opus):  $2.00
PDF Analysis (Opus):      $3.00
NotebookLM (Opus):        $0.30
```

### Annual Costs

| Configuration | Daily | Monthly | Annual |
| ------------- | ----- | ------- | ------ |
| Budget        | $2.05 | $61.50  | $738   |
| Balanced      | $3.95 | $118.50 | $1,422 |
| Premium       | $5.45 | $163.50 | $1,962 |

::: tip Quick Filter saves money
Enabling Quick Filter can reduce abstract scoring costs by 40-60% by pre-filtering irrelevant papers.
:::

## Quality Considerations

### Scoring Consistency

**Problem**: Different batches may get different scores

**Impact**: Paper with score 7 in batch 1 might score 6 in batch 2

**Solutions:**

1. **Enable Post-Processing** - Re-scores papers for consistency
2. **Use higher-quality models** - Opus/GPT-5 more consistent than Haiku/Nano
3. **Smaller batches** - More API calls but better consistency

**Model rankings** (consistency):

1. Claude Opus 4.1 (most consistent)
2. GPT-5
3. Claude Sonnet 4.5
4. Gemini Pro
5. Others (less consistent)

### Justification Quality

**What makes good justifications:**

- Specific references to paper content
- Clear reasoning for score
- Comparison to research criteria
- Mentions of key contributions

**Model rankings** (justification quality):

1. Claude Opus 4.1 (most detailed)
2. GPT-5
3. Claude Sonnet 4.5
4. Gemini Pro
5. Others (more generic)

### Vision Capability

**Importance**: Papers with complex figures, equations, diagrams

**Vision rankings:**

1. Claude Opus 4.1 (excellent)
2. GPT-5 (excellent)
3. Gemini Pro (very good)
4. Claude Sonnet 4.5 (good)
5. Others (basic)

**When vision matters:**

- Machine learning (architecture diagrams)
- Mathematics (equations, proofs)
- Experimental sciences (plots, data)

**When vision matters less:**

- Theory papers (text-heavy)
- Reviews (narrative)
- Position papers (conceptual)

## Switching Models

### Testing Different Models

**Recommended approach:**

1. Run minimal test with different configurations
2. Compare score distributions and justifications
3. Check cost vs. quality trade-off
4. Select based on your priorities

**Example test:**

```bash
# Test 1: Budget config
npm run test:minimal
mv reports/minimal.md reports/test_budget.md

# Test 2: Balanced config (change settings in UI)
npm run test:minimal
mv reports/minimal.md reports/test_balanced.md

# Compare results
diff reports/test_budget.md reports/test_balanced.md
```

### When to Change Models

**Upgrade to better models:**

- Too many false negatives (missing relevant papers)
- Scores seem inconsistent
- Justifications too generic
- PDF analyses lacking depth

**Downgrade to cheaper models:**

- Costs too high for daily use
- Current quality exceeds needs
- Fast turnaround more important
- High paper volume with good filtering

## API Key Requirements

**Minimum** (single provider):

- Anthropic (Claude) API key only
- Use Claude models for all stages

**Recommended** (two providers):

- Anthropic + OpenAI or Google
- Flexibility to optimize each stage

**Maximum** (all three):

- Anthropic + OpenAI + Google
- Full flexibility, redundancy if one is down

::: info Model availability
Aparture gracefully handles missing API keys by showing only available models in dropdowns.
:::

## Provider Comparison

### Anthropic (Claude)

**Strengths:**

- Best vision capability
- Excellent reasoning
- Strong consistency
- Great for research tasks

**Weaknesses:**

- Slower than competitors
- Higher cost (Opus)
- Rate limits on free tier

**Best for**: PDF analysis, high-quality scoring

### OpenAI (ChatGPT)

**Strengths:**

- Fast response times
- Good quality across models
- Reliable API
- Strong vision (GPT-5)

**Weaknesses:**

- Less detailed than Claude Opus
- Higher cost than Gemini
- Stricter content policies

**Best for**: Balanced speed and quality

### Google (Gemini)

**Strengths:**

- Largest context window (1M)
- Very fast (Flash models)
- Lowest cost (Flash-Lite)
- Good for high volume

**Weaknesses:**

- Less consistent than Claude/GPT
- Justifications more generic
- Newer, less proven

**Best for**: Budget configurations, quick filtering

## Next Steps

- [Understand multi-stage analysis →](/concepts/multi-stage-analysis)
- [Test different configurations →](/user-guide/testing)
- [Learn about CLI automation →](/user-guide/cli-automation)
