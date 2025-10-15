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

```env
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

**Pricing:**

- Haiku 3.5: $0.25/$1.25 per million tokens (input/output)
- Sonnet 4.5: $3/$15 per million tokens
- Opus 4.1: $15/$75 per million tokens

**Models enabled:**

- `claude-haiku-3.5` - Fast and economical
- `claude-sonnet-4.5` - Balanced quality and cost
- `claude-opus-4.1` - Highest quality

### OpenAI (GPT)

**Get your key:**

1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

**Pricing:**

- GPT-5 Nano: ~$0.10/$0.50 per million tokens
- GPT-5 Mini: ~$1/$5 per million tokens
- GPT-5 Standard: ~$5/$20 per million tokens

**Models enabled:**

- `gpt-5-nano` - Fast and economical
- `gpt-5-mini` - Balanced
- `gpt-5-standard` - High quality

::: tip Rate Limits
OpenAI has tier-based rate limits. Start with Tier 1 (free) and upgrade as needed.
:::

### Google (Gemini)

**Get your key:**

1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with Google
3. Click "Create API Key"
4. Copy the key (starts with `AIzaSy`)

**Pricing:**

- Flash-Lite: $0.075/$0.30 per million tokens
- Flash: $0.10/$0.40 per million tokens
- Pro: $1.25/$5.00 per million tokens

**Models enabled:**

- `gemini-flash-lite` - Most economical
- `gemini-flash` - Fast and efficient
- `gemini-pro` - Premium quality

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

```env
ACCESS_PASSWORD=MySecureP@ssw0rd2024
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

Change the development server port in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 3001"
  }
}
```

### Node Environment

Set the environment mode:

```env
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
# Test Claude key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-haiku-20240307", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]}'
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

### Models Not Appearing

If certain models don't appear in dropdowns:

1. **Check API key** - Is it set in `.env.local`?
2. **Restart server** - Environment changes need restart
3. **Check console** - Look for API errors (F12 in browser)

## Next Steps

Now that your environment is configured:

1. [Run your first analysis →](/getting-started/quick-start)
2. [Learn about model selection →](/concepts/model-selection)
3. [Set up CLI automation →](/user-guide/cli-automation)
