# Aparture

*Bringing the arXiv into focus.*

`aparture` is multi-stage research paper discovery and analysis tool that uses large language models (LLMs) to help search through arXiv to find the preprints that matter for your particular research interests.

It was mainly designed to help the author (Josh Speagle) survive searching through 3 categories (cs, stat, astro-ph) on a daily basis to help keep up with literature across a wide variety of fields.

## Features

The package is straightforward and current supports the following workflow:

- Fetches recent papers from ArXiv based on configurable categories
- Scores abstracts for relevance based on a customized user prompt
- Performs deep PDF analysis on the top-scoring papers (including producing a summary and a revised score)
- Exports summaries of the top papers in a report

## Supported Models

The package currently supports the following APIs:

- **Anthropic**: Claude Opus 4.1, Claude Sonnet 4
- **OpenAI**: GPT-5, GPT-5 Mini, GPT-5 Nano
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash

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

This app includes password protection to prevent unauthorized use of your Claude API key. The password is checked on every API call to ensure security.

## Usage

1. Enter your password to access the app
2. Select your preferred AI model from the dropdown
3. Configure your research interests and ArXiv categories
4. Click "Start Analysis" to begin the pipeline
5. Wait for the multi-stage process to complete
6. Export your results as a formatted text file

## API Usage Notes

- The app processes abstracts in batches to respect API rate limits (default: 5)
- PDF analysis is done directly over individual PDFs (no text extraction)
- Error handling includes automatic retries and graceful degradation
- All API calls are routed through secure backend endpoints

## License

MIT

## Acknowledgements

Created in collaboration with Claude Sonnet 4 and Claude Opus 4.1
