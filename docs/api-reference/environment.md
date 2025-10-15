# Environment Variables

Complete reference for environment variables used by Aparture.

## Overview

Aparture uses environment variables for:

- API authentication
- Application security
- Optional service integrations

All variables are stored in `.env.local` (not committed to git).

::: warning Never commit .env.local
Never commit `.env.local` to version control. It contains sensitive API keys and passwords.
:::

## Required Variables

### ACCESS_PASSWORD

**Purpose:** Application access password

**Description:** Protects the web interface from unauthorized access. Users must enter this password to use Aparture.

**Type:** String

**Example:**

```bash
ACCESS_PASSWORD=your-secure-password-here
```

**Security recommendations:**

- Use a strong, unique password (12+ characters)
- Include letters, numbers, and symbols
- Don't reuse passwords from other services
- Change periodically

**Note:** This is not enterprise-grade authentication. For public deployments, consider adding proper authentication.

---

## API Keys (At Least One Required)

You must provide **at least one** API key. Providing multiple gives you flexibility in model selection.

### CLAUDE_API_KEY

**Purpose:** Anthropic Claude API access

**Description:** Enables Claude models (Haiku 3.5, Sonnet 4.5, Opus 4.1)

**Type:** String (starts with `sk-ant-`)

**Example:**

```bash
CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to get:**

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create account or sign in
3. Go to "API Keys" section
4. Click "Create Key"
5. Copy and save immediately (shown only once)

**Pricing:**

- Haiku 3.5: $0.25/$1.25 per million tokens (input/output)
- Sonnet 4.5: $3/$15 per million tokens
- Opus 4.1: $15/$75 per million tokens

**Rate limits:**

- Free tier: Limited requests per minute
- Paid tier: Higher limits based on usage

**Models enabled:**

- `claude-haiku-3.5` - Fast, cheap
- `claude-sonnet-4.5` - Balanced
- `claude-opus-4.1` - Best quality

---

### OPENAI_API_KEY

**Purpose:** OpenAI API access

**Description:** Enables GPT models (GPT-5 Standard, Mini, Nano)

**Type:** String (starts with `sk-`)

**Example:**

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to get:**

1. Visit [platform.openai.com](https://platform.openai.com)
2. Create account or sign in
3. Go to "API Keys" section
4. Click "Create new secret key"
5. Copy and save immediately (shown only once)

**Pricing:**

- GPT-5 Nano: ~$0.10/$0.50 per million tokens (estimated)
- GPT-5 Mini: ~$1/$5 per million tokens (estimated)
- GPT-5 Standard: ~$5/$20 per million tokens (estimated)

**Note:** GPT-5 pricing is illustrative. Adjust based on actual OpenAI pricing.

**Rate limits:**

- Tier-based system
- Higher usage = higher tier = higher limits

**Models enabled:**

- `gpt-5-nano` - Fast, cheap
- `gpt-5-mini` - Balanced
- `gpt-5-standard` - High quality

---

### GOOGLE_AI_API_KEY

**Purpose:** Google AI (Gemini) API access

**Description:** Enables Gemini models (Pro, Flash, Flash-Lite)

**Type:** String

**Example:**

```bash
GOOGLE_AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to get:**

1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create account or sign in with Google
3. Click "Create API Key"
4. Copy and save the key

**Pricing:**

- Flash-Lite: $0.075/$0.30 per million tokens
- Flash: $0.10/$0.40 per million tokens
- Pro: $1.25/$5.00 per million tokens

**Rate limits:**

- Free tier: 15 requests/minute, 1M tokens/day
- Paid tier: Higher limits

**Models enabled:**

- `gemini-flash-lite` - Cheapest
- `gemini-flash` - Fast, efficient
- `gemini-pro` - Premium

::: tip Free Tier
Google's Gemini models offer a generous free tier, making them great for getting started.
:::

---

## Optional Variables

### NODE_ENV

**Purpose:** Environment mode

**Description:** Controls development vs. production behavior

**Type:** String

**Valid values:**

- `development` - Development mode (default)
- `production` - Production mode
- `test` - Testing mode

**Example:**

```bash
NODE_ENV=production
```

**Impact:**

- Development: Detailed error messages, hot reload
- Production: Optimized builds, minimal logging

**Default:** `development`

---

### PORT

**Purpose:** Development server port

**Description:** Port number for Next.js development server

**Type:** Number

**Valid range:** 1-65535

**Example:**

```bash
PORT=3001
```

**Default:** `3000`

**When to change:**

- Port 3000 already in use
- Running multiple instances
- Corporate proxy requirements

---

### VERCEL_URL

**Purpose:** Vercel deployment URL

**Description:** Automatically set by Vercel, used for production deployments

**Type:** String (URL)

**Example:**

```bash
VERCEL_URL=aparture.vercel.app
```

**Note:** You typically don't set this manually. Vercel provides it automatically.

---

## .env.local File Format

Complete example `.env.local`:

```bash
# Application Security
ACCESS_PASSWORD=your-secure-password-here

# API Keys (provide at least one)
CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional Configuration
NODE_ENV=development
PORT=3000
```

**File location:** Project root directory (same level as `package.json`)

**Permissions:** Should be readable only by you

```bash
chmod 600 .env.local  # Linux/Mac
```

---

## Environment Setup

### Initial Setup

1. **Create `.env.local`:**

   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`:**
   - Set `ACCESS_PASSWORD` to a secure password
   - Add at least one API key
   - Adjust optional variables if needed

3. **Verify setup:**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000) and authenticate

### Verification

**Check if variables are loaded:**

```javascript
// In pages/api/test.js
export default function handler(req, res) {
  res.status(200).json({
    hasClaudeKey: !!process.env.CLAUDE_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasGoogleKey: !!process.env.GOOGLE_AI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}
```

**Test API keys:**

- Run `npm run test:minimal` to verify API connectivity
- Check console for authentication errors

---

## Security Best Practices

### Protect Your Keys

**Do:**

- ✅ Store in `.env.local` (gitignored)
- ✅ Use environment variables in production
- ✅ Rotate keys periodically
- ✅ Use different keys for dev/prod
- ✅ Monitor API usage dashboards

**Don't:**

- ❌ Commit to git
- ❌ Share in screenshots/videos
- ❌ Hardcode in source files
- ❌ Include in client-side code
- ❌ Share publicly

### Key Rotation

**When to rotate:**

- Suspected compromise
- Employee departure
- Periodic refresh (quarterly)
- After public exposure

**How to rotate:**

1. Generate new key in provider dashboard
2. Update `.env.local`
3. Restart application
4. Test functionality
5. Delete old key from provider

### Usage Monitoring

**Set up alerts:**

- Anthropic: [console.anthropic.com](https://console.anthropic.com)
- OpenAI: [platform.openai.com/usage](https://platform.openai.com/usage)
- Google: [aistudio.google.com](https://aistudio.google.com)

**Monitor:**

- Daily/monthly spend
- Unusual usage spikes
- Failed authentication attempts
- Rate limit hits

### Spending Limits

**Recommended:**

- Set daily/monthly budget caps
- Enable email alerts
- Start conservative, increase as needed

**Example limits:**

- Testing: $10/month
- Daily use: $50-100/month
- Heavy use: $200-500/month

---

## Deployment

### Vercel Deployment

**Set environment variables:**

1. Go to Vercel dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add each variable:
   - `ACCESS_PASSWORD`
   - `CLAUDE_API_KEY`
   - `OPENAI_API_KEY`
   - `GOOGLE_AI_API_KEY`
5. Select environments (Production, Preview, Development)
6. Save and redeploy

**Note:** Never use production API keys for preview/development deployments

### Other Platforms

**Netlify:**

- Site Settings → Build & Deploy → Environment Variables

**Railway:**

- Project → Variables tab

**Docker:**

```bash
docker run -e ACCESS_PASSWORD=xxx -e CLAUDE_API_KEY=yyy aparture
```

**Heroku:**

```bash
heroku config:set ACCESS_PASSWORD=xxx
heroku config:set CLAUDE_API_KEY=yyy
```

---

## Troubleshooting

### Variables Not Loading

**Symptoms:**

- "Missing API key" errors
- Authentication failures
- Empty responses

**Solutions:**

1. **Check file name:** Must be exactly `.env.local` (note the leading dot)
2. **Check location:** Must be in project root
3. **Restart server:** Changes require restart
4. **Check syntax:** No quotes around values, no spaces around `=`

### API Key Invalid

**Symptoms:**

- 401 Unauthorized errors
- "Invalid API key" messages

**Solutions:**

1. **Verify key format:** Should start with provider-specific prefix
2. **Check for whitespace:** Copy/paste may add spaces
3. **Regenerate key:** Create new key in provider dashboard
4. **Check account status:** Ensure account is active and funded

### Rate Limits

**Symptoms:**

- 429 Too Many Requests errors
- Slow responses

**Solutions:**

1. **Check usage dashboard:** See current limits
2. **Reduce batch sizes:** Smaller batches = more gradual usage
3. **Upgrade account:** Higher tiers have higher limits
4. **Implement delays:** Add artificial delays between requests

### Missing Environment

**Symptoms:**

- Variables undefined in API routes
- Works in development, fails in production

**Solutions:**

1. **Check deployment platform:** Ensure variables set in platform UI
2. **Verify environment:** Production vs. Preview vs. Development
3. **Redeploy:** Changes may require rebuild
4. **Check build logs:** Look for environment variable warnings

---

## Next Steps

- [Complete setup guide →](/getting-started/setup)
- [CLI commands reference →](/api-reference/commands)
- [Test your configuration →](/user-guide/testing)
