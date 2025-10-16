# Testing

Learn how to test Aparture before running expensive production analyses.

## Why Test?

Testing helps you:

- **Verify setup** - Ensure environment variables and dependencies are configured correctly
- **Validate configuration** - Test category selection and research criteria
- **Estimate costs** - See API usage before full runs
- **Debug issues** - Isolate problems in a controlled environment

Aparture provides two testing modes with different trade-offs.

## Dry Run Test (Mock API)

The dry run uses **simulated API responses** with no real API calls.

### When to Use

- **First-time setup** - Verify installation and configuration
- **UI/UX testing** - Test interface without costs
- **Development** - Test code changes safely
- **Demo purposes** - Show the workflow without API keys

### Running Dry Run

**Command Line:**

```bash
npm run test:dryrun
```

::: info Dry run is completely free
No API calls are made, and no credits are consumed.
:::

### What It Tests

- ✅ Category selection and form submission
- ✅ UI automation (CLI)
- ✅ Progress monitoring and state updates
- ✅ Report generation and formatting
- ✅ Download functionality
- ✅ Error handling and retries

### What It Doesn't Test

- ❌ Real API integration
- ❌ Model behavior and quality
- ❌ PDF download and analysis
- ❌ Actual processing times
- ❌ Cost estimation accuracy

### Mock Data

Dry run generates realistic mock data:

- **50 papers** - Mix of relevant and irrelevant
- **Quick Filter** - 20 YES, 15 MAYBE, 15 NO
- **Scores** - Realistic distribution (3-9 range)
- **PDF Analysis** - 5 papers with generated summaries

Look for the **"TEST MODE"** badge to confirm you're using mock data.

### Output

**Files created in `reports/`:**

- `YYYY-MM-DD_arxiv_analysis_dryrun.md` - Mock analysis report
- `screenshots/` - Progress captures (CLI only)

### Duration

- **Command Line**: ~45 seconds (includes browser automation)

## Minimal API Test

The minimal test runs a **real analysis with 3 papers**.

### When to Use

- **Validate API keys** - Ensure all APIs are accessible
- **Test model behavior** - See actual model responses
- **Verify PDF handling** - Test arXiv download logic
- **End-to-end validation** - Confirm complete workflow
- **Before production runs** - Catch issues early

### Running Minimal Test

**Command Line:**

```bash
npm run test:minimal
```

::: warning Minimal test uses real API calls
This will consume credits. Typical cost: $0.10-0.50 depending on models.
:::

### What It Tests

- ✅ All API integrations (Anthropic, OpenAI, Google)
- ✅ Real model responses and quality
- ✅ PDF download from arXiv
- ✅ Complete multi-stage pipeline
- ✅ Actual processing times
- ✅ Report generation with real data

### Test Configuration

The minimal test uses:

- **Categories**: cs.LG only
- **Papers**: 3 most recent
- **Quick Filter**: Enabled
- **Abstract Scoring**: Enabled
- **Post-Processing**: Disabled (to save time)
- **PDF Analysis**: Top 2 papers
- **NotebookLM**: Disabled

This configuration tests all core features while minimizing cost.

### Output

**Files created in `reports/`:**

- `YYYY-MM-DD_arxiv_analysis_minimal.md` - Real analysis report
- `screenshots/` - Progress captures

### Duration

- **Total**: 5-10 minutes
- Fetching: ~30 seconds
- Quick Filter: ~30 seconds
- Scoring: 1-2 minutes
- PDF Analysis: 3-5 minutes

### Cost Estimate

Depends on model selection:

**Budget Configuration** (Haiku + Gemini Flash)

- Quick Filter: ~$0.01
- Abstract Scoring: ~$0.02
- PDF Analysis: ~$0.05
- **Total**: ~$0.08

**Premium Configuration** (Opus + GPT-5)

- Quick Filter: ~$0.02
- Abstract Scoring: ~$0.10
- PDF Analysis: ~$0.30
- **Total**: ~$0.42

See [Model Selection](/concepts/model-selection) for cost comparisons.

## Comparing Test Modes

| Feature          | Dry Run            | Minimal         |
| ---------------- | ------------------ | --------------- |
| **Cost**         | Free               | ~$0.10-0.50     |
| **Duration**     | 45s                | 5-10min         |
| **API Calls**    | None               | Real            |
| **PDF Analysis** | Mock               | Real            |
| **Purpose**      | Setup verification | Full validation |

## Best Practices

### Before Production

1. **Run dry run** - Verify configuration and UI
2. **Run minimal test** - Validate APIs and models
3. **Review results** - Check quality and relevance
4. **Adjust settings** - Refine based on test results
5. **Run production** - Confident in full analysis

### Regular Testing

- **After environment changes** - Re-run minimal test
- **New categories** - Test with dry run first
- **Model changes** - Validate with minimal test
- **Before expensive runs** - Always dry run first

### Debugging Issues

If tests fail:

1. **Check environment variables** - Verify all API keys
2. **Review console output** - Look for error messages
3. **Check screenshots** - Visual debugging (CLI)
4. **Test individual APIs** - Isolate the problem
5. **Consult logs** - Check browser console (F12)

## Common Test Failures

### Dry Run Fails

**Possible causes:**

- Installation incomplete (`npm install` not run)
- Port 3000 already in use
- Browser automation issues (CLI)

**Solutions:**

- Run `npm install`
- Stop other applications on port 3000
- Install Playwright: `npx playwright install chromium`

### Minimal Test Fails

**API errors:**

- Invalid API key
- Insufficient credits
- Rate limiting

**Solutions:**

- Verify API keys in `.env.local`
- Check account balances
- Wait a few minutes and retry

**PDF download fails:**

- arXiv temporarily unavailable
- reCAPTCHA blocking automated downloads

**Solutions:**

- Retry after a few minutes
- Check arXiv status page
- Playwright fallback should handle reCAPTCHA automatically

## Testing Individual Components

### Test API Keys Only

Quick check without full analysis:

```bash
# Test Claude
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-haiku-4-5-20251001", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]}'

# Test OpenAI
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-5", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 10}'

# Test Google
curl "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=$GOOGLE_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hi"}]}]}'
```

### Test PDF Download

```bash
# Direct download test
curl -L "https://arxiv.org/pdf/2401.00001.pdf" -o test.pdf

# Check file is valid PDF
file test.pdf  # Should show "PDF document"
```

### Test Browser Automation

```bash
# Basic browser test
node cli/tests/test-browser-basic.js

# Authentication test
node cli/tests/test-browser-auth.js
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Aparture

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install chromium
      - run: npm run test:dryrun
        env:
          ACCESS_PASSWORD: test-password
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run test:dryrun
```

## Next Steps

- [Run your first production analysis →](/getting-started/quick-start)
- [Understand the reports →](/user-guide/reports)
- [Learn about model selection →](/concepts/model-selection)
