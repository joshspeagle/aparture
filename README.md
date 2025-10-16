# Aparture

_Bringing the arXiv into focus._

Multi-stage research paper discovery and analysis tool that uses large language models (LLMs) to help search through arXiv and find the preprints that matter for your particular research interests.

## Documentation

📚 **[View Full Documentation](https://joshspeagle.github.io/aparture/)** (deployed automatically)

The complete documentation includes:

- **[Getting Started](https://joshspeagle.github.io/aparture/getting-started/installation)** - Installation, setup, and quick start guide
- **[User Guide](https://joshspeagle.github.io/aparture/user-guide/web-interface)** - Web interface, CLI automation, testing, and reports
- **[Concepts](https://joshspeagle.github.io/aparture/concepts/multi-stage-analysis)** - Multi-stage analysis, arXiv categories, model selection, NotebookLM
- **[API Reference](https://joshspeagle.github.io/aparture/api-reference/commands)** - CLI commands, configuration, environment variables

### Running Documentation Locally

```bash
npm run docs:dev      # Start dev server at http://localhost:5173
npm run docs:build    # Build static site
npm run docs:preview  # Preview built site
```

## Features

### Core Workflow

- **Multi-stage filtering**: Quick filter → Abstract scoring → PDF analysis
- **Flexible processing**: Process papers from multiple arXiv categories simultaneously
- **Smart scoring**: 0-10 scale relevance scoring with detailed justifications
- **Deep analysis**: Full PDF content analysis for top papers with vision-capable models
- **Post-processing**: Optional second-pass scoring for consistency
- **Report generation**: Comprehensive markdown reports with all analyses
- **Podcast creation**: Generate NotebookLM-optimized documents for AI podcasts

### Advanced Features

- **Testing modes**: Dry run with mock data and minimal API testing
- **Visual indicators**: Clear "TEST MODE" badges when using simulated data
- **Customizable models**: Choose different LLMs for each processing stage
- **Batch processing**: Efficient API usage with configurable batch sizes
- **Research criteria**: Fully editable prompts for domain-specific analysis
- **Error handling**: Automatic retries and correction mechanisms
- **CLI automation**: Complete end-to-end automation from analysis to podcast generation

## Supported Models

- **Anthropic**: Claude Opus 4.1, Claude Sonnet 4.5, Claude Haiku 4.5
- **OpenAI**: GPT-5, GPT-5 Mini, GPT-5 Nano
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file:

```bash
# Access Password (required)
ACCESS_PASSWORD=your-secure-password-here

# API Keys (at least one required)
CLAUDE_API_KEY=sk-ant-your-api-key-here        # From https://console.anthropic.com/
OPENAI_API_KEY=sk-your-openai-key-here         # From https://platform.openai.com/
GOOGLE_AI_API_KEY=your-google-ai-key-here      # From https://aistudio.google.com/apikey
```

### 3. Run Locally

**Web Interface** (recommended for first-time users):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**CLI Automation** (for frequent users):

```bash
# First time: Interactive setup
npm run setup

# Test configuration
npm run test:dryrun    # Mock API test (free)
npm run test:minimal   # Real API test (~$0.50)

# Run analysis
npm run analyze        # Full workflow: report + document + podcast
```

See the **[CLI Automation Guide](https://joshspeagle.github.io/aparture/user-guide/cli-automation)** for details.

## Web Interface

### Basic Workflow

1. Enter your password to access the app
2. Select arXiv categories you want to search
3. Configure your research interests (used for relevance scoring)
4. (Optional) Enable quick filtering to reduce paper volume
5. Select AI models for each processing stage
6. Click "Start Analysis" to begin processing

### Testing Your Configuration

1. **Dry Run Test**: Complete workflow with mock API responses (no costs)
2. **Minimal API Test**: Test with 3 real papers to verify API integration (~$0.10-0.50)
3. Look for "TEST MODE" badges to confirm you're using simulated data

See the **[Testing Guide](https://joshspeagle.github.io/aparture/user-guide/testing)** for more details.

### Generating Reports

1. **Download Report**: Export comprehensive markdown analysis
2. **NotebookLM Integration**:
   - Select target podcast duration (5-30 minutes)
   - Choose generation model
   - Generate structured document optimized for podcast creation
   - Upload to NotebookLM for audio generation

See the **[Reports Guide](https://joshspeagle.github.io/aparture/user-guide/reports)** for more information.

## Command Line Interface

For frequent users who prefer automation, Aparture includes comprehensive CLI tools.

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright (first time only)
npx playwright install chromium
```

### First-Time Setup

```bash
# Interactive configuration wizard
npm run setup
```

This opens a browser UI where you can:

- Select arXiv categories to monitor
- Choose AI models for each processing stage
- Set score thresholds and batch sizes
- Configure NotebookLM podcast duration
- Define your research interests

Settings are saved automatically for future runs.

### Testing

```bash
# Mock API test (fast, no costs)
npm run test:dryrun

# Real API test with 3 papers (minimal cost ~$0.50)
npm run test:minimal
```

### Running Analyses

```bash
# Full workflow (report + document + podcast)
npm run analyze

# Specific workflows
npm run analyze:report     # Report only (skip NotebookLM features)
npm run analyze:document   # Report + NotebookLM document (skip podcast)
npm run analyze:podcast    # Podcast only (use existing files)
```

**First Run**: Google will prompt you to log in for NotebookLM authentication. Your session will be cached for future runs.

All outputs are saved to the `reports/` directory with dated filenames.

See the **[CLI Automation Guide](https://joshspeagle.github.io/aparture/user-guide/cli-automation)** for comprehensive documentation.

## Deployment

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add ACCESS_PASSWORD
vercel env add CLAUDE_API_KEY
vercel env add OPENAI_API_KEY
vercel env add GOOGLE_AI_API_KEY

# Deploy to production
vercel --prod
```

For custom domains:

1. Go to Settings → Domains in Vercel dashboard
2. Add your custom domain
3. Follow DNS configuration instructions

See the **[Deployment Guide](https://joshspeagle.github.io/aparture/getting-started/setup)** for more options.

## Security

This app includes password protection to prevent unauthorized use of your API keys. The password is checked on every API call to ensure security.

API keys are stored in `.env.local` (local development) or Vercel environment variables (production) and are never exposed to the client.

## API Usage Notes

- **Batch Processing**: Abstracts processed in configurable batches to respect rate limits
- **PDF Analysis**: Direct multimodal analysis without text extraction
- **Error Recovery**: Automatic retries with correction prompts for malformed responses
- **Cost Optimization**:
  - Use quick filtering to reduce volume before scoring
  - Test with dry run mode before using real APIs
  - Choose appropriate models for each stage
- **Default Models**: Google Gemini models are set as defaults due to their generous [free tier offering](https://ai.google.dev/gemini-api/docs/rate-limits#free-tier)

See **[Model Selection Guide](https://joshspeagle.github.io/aparture/concepts/model-selection)** for detailed comparisons and cost analysis.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Acknowledgements

Created in collaboration with Claude Sonnet 4/4.5 and Claude Opus 4.1.

---

**Note**: This tool was primarily designed to help the author (Josh Speagle) manage daily paper monitoring across multiple arXiv categories (cs, stat, astro-ph) while keeping up with literature across a wide variety of fields.
