# Installation

Learn how to install Aparture and its dependencies.

## Prerequisites

Before installing Aparture, ensure you have the following:

### Required

- **Node.js** 18.0 or higher ([download](https://nodejs.org))
- **npm** 8.0 or higher (comes with Node.js)
- **Git** (for cloning the repository)

### Optional

- **Playwright** (for CLI automation and testing)
- **API keys** for at least one LLM provider (Anthropic, OpenAI, or Google)

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/joshspeagle/aparture.git
cd aparture
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:

- Next.js 14
- React 18
- Lucide React (icons)
- CLI dependencies (chalk, ora, prompts, commander)

### 3. Install Playwright (Optional)

For CLI automation and browser-based testing:

```bash
npx playwright install chromium
```

::: tip Why Chromium only?
Aparture only uses Chromium for automation. Installing just Chromium saves ~1GB compared to installing all browsers.
:::

## Verify Installation

Check that everything is installed correctly:

```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check npm version
npm --version   # Should be 8.0.0 or higher

# List installed packages
npm list --depth=0
```

## Project Structure

After installation, your directory should look like:

```
aparture/
├── pages/              # Next.js pages and API routes
├── components/         # React components
├── cli/                # CLI tools and automation
├── utils/              # Utility functions
├── styles/             # Global styles
├── public/             # Static assets
├── temp/               # Temporary files (Playwright profiles, PDFs)
├── reports/            # Generated analysis reports
├── package.json        # Dependencies and scripts
├── next.config.mjs     # Next.js configuration
└── .env.local          # Environment variables (you'll create this)
```

## Troubleshooting

### Node.js Version Issues

If you have an older Node.js version:

**Using nvm (Linux/Mac):**

```bash
nvm install 18
nvm use 18
```

**Using nvm-windows:**

```bash
nvm install 18
nvm use 18
```

**Or download directly:**
Visit [nodejs.org](https://nodejs.org) and install the LTS version.

### npm Install Failures

**Clear cache and retry:**

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Permission errors (Linux/Mac):**

```bash
sudo chown -R $(whoami) ~/.npm
```

### Playwright Installation Issues

**Disk space:**
Chromium requires ~300MB. Check available space:

```bash
df -h  # Linux/Mac
```

**System dependencies (Linux):**

```bash
# Ubuntu/Debian
sudo apt-get install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1

# Fedora
sudo dnf install nss atk at-spi2-atk cups-libs libdrm libxkbcommon mesa-libgbm
```

## Next Steps

Now that Aparture is installed:

1. [Set up environment variables →](/getting-started/setup)
2. [Run your first analysis →](/getting-started/quick-start)
3. [Configure CLI automation →](/user-guide/cli-automation)

## Updating

To update Aparture to the latest version:

```bash
git pull origin main
npm install
```

::: warning Breaking Changes
Check the [changelog](https://github.com/joshspeagle/aparture/blob/main/CHANGELOG.md) for breaking changes before updating.
:::
