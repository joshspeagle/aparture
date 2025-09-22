# Aparture

*Bringing the arXiv into focus.*

`aparture` is multi-stage research paper discovery and analysis tool that uses large language models (LLMs) to help search through arXiv to find the preprints that matter for your particular research interests.

It was mainly designed to help the author (Josh Speagle) survive searching through 3 categories (cs, stat, astro-ph) on a daily basis to help keep up with literature across a wide variety of fields.

## Features

### Core Workflow

- **Multi-stage filtering**: Optional quick filter → Abstract scoring → PDF analysis
- **Flexible processing**: Process papers from multiple ArXiv categories simultaneously
- **Smart scoring**: 0-10 scale relevance scoring with detailed justifications
- **Deep analysis**: Full PDF content analysis for top papers
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

## Supported Models

The package currently supports the following APIs:

- **Anthropic**: Claude Opus 4.1, Claude Sonnet 4, Claude Haiku 3.5
- **OpenAI**: GPT-5, GPT-5 Mini, GPT-5 Nano
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Access Password - Set this to any password you want
ACCESS_PASSWORD=your-secure-password-here

# Anthropic API Key - Get this from https://console.anthropic.com/
CLAUDE_API_KEY=sk-ant-your-api-key-here

# OpenAI API Key - Get this from https://platform.openai.com/
OPENAI_API_KEY=sk-your-openai-key-here

# Google AI API Key - Get this from https://makersuite.google.com/app/apikey
GOOGLE_AI_API_KEY=your-google-ai-key-here
```

**Note:** You only need the API keys for the models you plan to use.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### OR: Deploy to Vercel

Install Vercel CLI:

```bash
npm install -g vercel
```

Deploy:

```bash
vercel
```

Set environment variables in Vercel (add only the ones you need):

```bash
vercel env add ACCESS_PASSWORD
vercel env add CLAUDE_API_KEY
vercel env add OPENAI_API_KEY
vercel env add GOOGLE_AI_API_KEY
```

Redeploy:

```bash
vercel --prod
```

If you want to apply a custom domain, in your Vercel dashboard:

1. Go to Settings → Domains
2. Add your custom domain
3. Follow the DNS configuration instructions

## Security

This app includes password protection to prevent unauthorized use of your API keys. The password is checked on every API call to ensure security.

## Usage

### Basic Workflow

1. Enter your password to access the app
2. Select the ArXiv categories you want to search
3. Configure your research interests (used for relevance scoring)
4. (Optional) Enable quick filtering to reduce paper volume
5. Select AI models for each processing stage
6. Click "Start Analysis" to begin processing

### Testing Your Configuration

1. **Dry Run Test**: Complete workflow with mock API responses (no API costs)
2. **Minimal API Test**: Test with 3 real papers to verify API integration
3. Look for "TEST MODE" badges to confirm you're using simulated data

### Advanced Configuration

- **Abstract Scoring Options**: Batch size, post-processing, score thresholds
- **PDF Analysis Options**: Number of papers to analyze, minimum score threshold
- **Model Selection**: Choose different models for filtering, scoring, and analysis
- **Research Criteria**: Edit the prompt to match your specific research interests

### Generating Reports

1. **Download Report**: Export comprehensive markdown analysis
2. **NotebookLM Integration**:
   - Select target podcast duration (5-30 minutes)
   - Choose generation model
   - Generate structured document optimized for podcast creation
   - Upload to NotebookLM along with the main report for best results

## API Usage Notes

- **Batch Processing**: Abstracts are processed in configurable batches to respect rate limits
- **PDF Analysis**: Direct multimodal analysis without text extraction
- **Error Recovery**: Automatic retries with correction prompts for malformed responses
- **Security**: All API calls routed through secure backend endpoints
- **Cost Optimization**:
  - Use quick filtering to reduce volume before scoring
  - Test with dry run mode before using real APIs
  - Choose appropriate models for each stage (e.g., cheaper models for filtering)

## License

MIT

## Acknowledgements

Created in collaboration with Claude Sonnet 4 and Claude Opus 4.1

## Recent Updates

- **NotebookLM Integration**: Generate podcast-ready documents from analysis results
- **Post-Processing**: Two-stage scoring for improved consistency
- **Quick Filtering**: Optional first-pass filtering to reduce API costs
- **Visual Indicators**: Clear badges showing when test mode is active
- **Enhanced Testing**: Comprehensive mock API for workflow validation
