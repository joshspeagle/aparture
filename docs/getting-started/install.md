# Install

Aparture is a Next.js web application that runs locally on your machine. Installing Node.js, cloning the repository, and starting the development server on macOS, Linux, Windows, or WSL2 takes about 10–15 minutes on a clean system.

## Prerequisites

- **Node.js 22 or newer:** `package.json` enforces Node 22+, and continuous integration tests against Node 22 and Node 24. The examples below install Node 22.
- **Git:** Used to clone the repository.
- **Approximately 1 GB of free disk space:** `node_modules` occupies roughly 500 MB, and installing Playwright for the optional reCAPTCHA PDF fallback (§5) uses an additional 300 MB.
- **A terminal shell:** Use `bash` or `zsh` on macOS and Linux, or PowerShell or WSL2 on Windows (WSL2 provides a Linux environment on Windows that executes Node file I/O faster than native Windows filesystems).

## 1. Install Node

### macOS

Install Node with [nvm](https://github.com/nvm-sh/nvm) so that you can manage Node versions in your home directory without `sudo`:

```bash
# Xcode CLI tools (git, make, clang)
xcode-select --install

# Homebrew (skip if installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.zshrc

# Node 22
nvm install 22
nvm alias default 22
node -v   # should print v22.x.x
```

### Linux (Ubuntu/Debian, Fedora, Arch)

Use `nvm` on Linux as well because distribution packages (`apt install nodejs`) often ship older Node releases:

```bash
# Build deps (native modules need these)
sudo apt update && sudo apt install -y curl build-essential git   # Debian/Ubuntu
# sudo dnf install -y curl gcc-c++ make git                       # Fedora
# sudo pacman -S --needed curl base-devel git                     # Arch

# nvm + Node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
```

### Windows (native PowerShell)

On native Windows, install [fnm](https://github.com/Schniz/fnm) via `winget` and enable long filesystem paths for deep `node_modules` trees:

```powershell
# Install fnm
winget install Schniz.fnm

# Add shell integration (paste into $PROFILE, then reopen PowerShell)
# fnm env --use-on-cd | Out-String | Invoke-Expression

fnm install 22
fnm default 22

# Enable Windows long paths (node_modules trees are deep).
# Run as Administrator:
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
git config --global core.longpaths true
```

::: tip Windows Defender can slow npm install dramatically
If `npm install` takes several minutes on Windows, real-time scanning in Windows Defender is likely inspecting `node_modules` as files are written. Adding exclusions for your project directory, `%APPDATA%\npm-cache`, and `node.exe` typically reduces install times from ~10 minutes to 1–3 minutes.
:::

### WSL2 (Ubuntu on Windows)

If you use Windows and are comfortable working in a Linux shell, WSL2 offers faster package installation and server startup.

::: tip Keep the repo on the Linux filesystem
Clone the repository inside the native Linux filesystem (such as `~/projects/aparture`) rather than under `/mnt/c/...` because cross-filesystem I/O across the WSL mount bridge can cause `npm run dev` to take over 60 seconds to start.
:::

Run the following command once as Administrator in PowerShell:

```powershell
# One-time, as Administrator in PowerShell
wsl --install -d Ubuntu-24.04
```

Then run these commands inside the Ubuntu shell:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl build-essential git
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22

mkdir -p ~/projects
cd ~/projects
```

## 2. Clone and install

```bash
git clone https://github.com/joshspeagle/aparture.git
cd aparture
cp .env.local.example .env.local
npm install
```

`npm install` downloads roughly 700 packages (~500 MB) in 1–3 minutes.

Briefing cards crop key figures from each paper's PDF using `pdf.js` and a prebuilt native canvas binding (`@napi-rs/canvas`) that `npm install` fetches automatically for macOS, Windows, and Linux. If the native canvas module cannot load on your platform, briefing cards simply omit the figure thumbnail.

## 3. Set a local access password

Open `.env.local` in a text editor and set `ACCESS_PASSWORD` to a passphrase you will remember:

```bash
ACCESS_PASSWORD=pick-anything-memorable
```

Aparture protects the web interface and all API routes with this password: the login screen prompts for it, and every API request verifies it on the server. The example configuration file ships with `ACCESS_PASSWORD=change-me` as a starter value.

Because `npm run dev` binds to `127.0.0.1` by default, only processes on your local machine can reach the server. If you expose the server to other devices on your local network via `npm run dev -- -H 0.0.0.0`, set a strong password first.

You will also add your LLM provider API key to `.env.local` on the next page. The development server starts without an API key, and pipeline runs check for the key when making their first LLM request.

## 4. Identify yourself to arXiv (optional but encouraged)

arXiv's API documentation asks automated clients to include a contact email address on requests so operations staff can reach the maintainer if traffic from an IP address causes issues. When `ARXIV_CONTACT_EMAIL` is set in `.env.local`, Aparture sends that address in the HTTP `From` request header:

```bash
# .env.local
ARXIV_CONTACT_EMAIL=you@example.edu
```

arXiv's public endpoints do not require account registration or authentication; the `From` header serves as a politeness signal used by arXiv's rate-limit heuristics.

::: tip Academic addresses carry more weight
Institutional email addresses (`.edu`, `.ac.*`) receive more lenient treatment from arXiv's rate-limit heuristics than consumer webmail domains (`@gmail.com`, `@outlook.com`). If you do not have an institutional address, providing a personal email address is still preferable to leaving the variable unset.
:::

Aparture works without `ARXIV_CONTACT_EMAIL`, but setting it reduces the likelihood of rate-limit throttling during large multi-category harvests.

## 5. Playwright (optional fallback for reCAPTCHA)

Aparture downloads PDFs directly from arXiv by default. When arXiv occasionally serves a reCAPTCHA challenge page on a PDF URL after a burst of downloads, Aparture automatically falls back to a headless Chromium browser managed by Playwright if Playwright is installed.

When Playwright is not installed, papers blocked by reCAPTCHA are logged in the activity timeline and skip Stage 4 full-PDF analysis; they remain in the ranking based on their Stage 3 abstract score, still appear in the briefing, and are listed in an end-of-run summary card. All other pipeline stages (quick filter, abstract scoring, briefing synthesis, and podcast generation) run normally without Playwright.

To enable the headless browser fallback, install Playwright's Chromium binary:

```bash
npx playwright install chromium

# Linux only: installs libnss3, libatk-bridge, and system libraries
npx playwright install-deps chromium
```

Re-run `npx playwright install chromium` whenever a dependency update upgrades Playwright to a newer release, because each Playwright version requires its matching Chromium build.

::: tip Preserve the Playwright profile directory
The Playwright fallback runs headlessly in the background and stores its session cookies in `temp/playwright-profile/` so subsequent PDF downloads bypass the challenge automatically. Keeping `temp/playwright-profile/` intact avoids an extra 5–10 second browser startup delay on later runs.
:::

## 6. Verify the toolchain

Confirm that the repository and test suite run cleanly:

```bash
node -v                       # v22.x.x
npm -v                        # 10.x or 11.x
npm run lint                  # ESLint passes
npm test                      # Vitest, fixture-based: no API calls, $0
```

Once all four commands succeed, your local toolchain is ready. Next, add at least one LLM provider key to `.env.local`.

## Common gotchas

**macOS**

- **`EACCES` permission error on global install:** Node was likely installed via Homebrew using system directories. Reinstall Node using `nvm` so packages live under `~/.nvm/` without requiring `sudo`.

**Linux**

- **`Error: Cannot find module` after `nvm install`:** Your shell startup file did not load `nvm`. Confirm that `~/.bashrc` contains the `nvm` initialization block and run `source ~/.bashrc` (or open a new terminal).
- **Playwright reports missing `libnss3.so`:** Run `npx playwright install-deps chromium` (which prompts for `sudo` to install system shared libraries).
- **ARM64 only (`npm test` fails with `Cannot find module '@rolldown/binding-linux-arm64-gnu'`):** An npm optional-dependency bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) occasionally omits the platform-specific native binding for Vitest's `rolldown` bundler. The development server (`npm run dev`) is unaffected, and you can install the binding directly for `npm test`:
  ```bash
  npm install --no-save @rolldown/binding-linux-arm64-gnu
  ```
  Alternatively, run `rm -rf node_modules package-lock.json && npm install`. The same fix applies on Windows ARM64 (`@rolldown/binding-win32-arm64-msvc`) and macOS ARM64 (`@rolldown/binding-darwin-arm64`).

**Windows native**

- **`ENAMETOOLONG` during `npm install`:** Windows long paths are disabled. Run the Administrator PowerShell registry command from §1 and run `git config --global core.longpaths true`.

**arXiv rate limits**

- **Repeated `arXiv rate limit: exhausted 3 retries` errors on normal runs:** Set `ARXIV_CONTACT_EMAIL` in `.env.local` (§4) and restart `npm run dev`. See [troubleshooting for arXiv rate limits](/reference/troubleshooting#arxiv-rate-limits) for full details on retry and backoff behavior.

**WSL2**

- **`npm run dev` takes over 60 seconds to start:** The repository is located on a mounted Windows drive under `/mnt/c/...`. Move the checkout to `~/projects/` on the native Linux filesystem.
- **`localhost:3000` does not load in a Windows browser:** WSL2 port forwarding occasionally stalls after hibernate or sleep; run `wsl --shutdown` in PowerShell and reopen your Ubuntu terminal.

## Next

Continue to [API keys](/getting-started/api-keys) to configure at least one model provider.
