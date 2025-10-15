# Setup

Configure your environment and API keys for Aparture.

## Environment Variables

Aparture uses a `.env.local` file to store sensitive configuration like API keys and passwords.

### Create .env.local

Create a `.env.local` file in the project root:

```bash
touch .env.local  # Linux/Mac
type nul > .env.local  # Windows
```

### Required Variables

Add the following to `.env.local`:

```bash
# Application Password (required)
ACCESS_PASSWORD=your-secure-password-here

# API Keys (at least one required)
CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

::: warning Security
Never commit `.env.local` to git! It's already in `.gitignore`.
:::

## API Keys

You need at least one API key to use Aparture. Having multiple providers gives you flexibility in model selection.

### Anthropic (Claude)

**Get your key:**

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)

**Models available:** Claude Haiku 3.5, Sonnet 4.5, Opus 4.1

See [Model Selection →](/concepts/model-selection) for detailed pricing and comparisons.

### OpenAI (ChatGPT)

**Get your key:**

1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

**Models available:** GPT-5, Mini, Nano

See [Model Selection →](/concepts/model-selection) for detailed pricing and comparisons.

::: tip Rate Limits
OpenAI has tier-based rate limits. Start with Tier 1 and upgrade as needed.
:::

### Google (Gemini)

**Get your key:**

1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with Google
3. Click "Create API Key"
4. Copy the key (starts with `AIzaSy`)

**Models available:** Gemini 2.5 Pro, Flash, Flash-Lite

See [Model Selection →](/concepts/model-selection) for detailed pricing and comparisons.

::: tip Free Tier
Google's Gemini models offer a generous free tier, making them great for getting started.
:::

## Access Password

The `ACCESS_PASSWORD` protects your web interface from unauthorized access.

**Requirements:**

- Minimum 8 characters
- Mix of letters, numbers, and symbols recommended
- Don't reuse passwords from other services

**Example:**

```bash
ACCESS_PASSWORD=MySecureP@ssw0rd
```

This password is required every time you access the web interface.

## Verify Setup

Test that your environment is configured correctly:

### 1. Check .env.local exists

```bash
ls -la .env.local  # Linux/Mac
dir .env.local     # Windows
```

### 2. Start the development server

```bash
npm run dev
```

### 3. Access the application

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Test authentication

- Enter your `ACCESS_PASSWORD`
- You should see the main application interface
- Check the model dropdowns show your available providers

::: tip Testing API Keys
The application will show which models are available based on your configured API keys. If a provider's models don't appear, check that API key.
:::

## Optional Configuration

### Port Configuration

Change the development server port with an environment variable:

```bash
PORT=3001 npm run dev
```

Or add to `.env.local`:

```bash
PORT=3001
```

### Node Environment

Set the environment mode:

```bash
NODE_ENV=development  # or production
```

## Security Best Practices

### Protect Your Keys

1. **Never commit `.env.local`** - Already in `.gitignore`
2. **Use environment variables in production** - Don't hardcode keys
3. **Rotate keys periodically** - Every 3-6 months
4. **Use different keys for dev/prod** - Separate environments
5. **Monitor usage dashboards** - Watch for unexpected usage

### Monitor Spending

Set up billing alerts in each provider:

**Anthropic:**

- Console → Settings → Usage
- Set monthly budget limits

**OpenAI:**

- Platform → Usage → Limits
- Set hard and soft limits

**Google:**

- AI Studio → Quota
- Monitor daily/monthly limits

### Rate Limit Best Practices

- Start with small batch sizes
- Increase gradually as needed
- Monitor rate limit errors
- Consider multiple API keys for high volume

## Troubleshooting

### API Key Not Working

**Check:**

1. Key copied correctly (no extra spaces)
2. Key is active in provider dashboard
3. Account has available credits
4. Correct environment variable name

**Test directly:**

```bash
# Test Claude key (example using Haiku)
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-haiku-20241022", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]}'
```

### Environment Variables Not Loading

**Next.js requires restart:**

```bash
# Stop the server (Ctrl+C)
# Start again
npm run dev
```

**Check .env.local location:**

- Must be in project root (same level as `package.json`)
- File name is `.env.local` not `env.local`

### Models Not Appearing in Dropdowns

If certain provider's models don't appear:

1. **Verify API key is set** - Check `.env.local` for the correct variable name
2. **Restart development server** - Stop with Ctrl+C, then `npm run dev`
3. **Check browser console** - Press F12 and look for API authentication errors
4. **Verify account status** - Ensure your API account is active with available credits

## Next Steps

Now that your environment is configured:

1. [Run your first analysis →](/getting-started/quick-start)
2. [Learn about model selection →](/concepts/model-selection)
3. [Set up CLI automation →](/user-guide/cli-automation)
