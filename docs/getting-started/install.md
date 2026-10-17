# Install

Aparture is a Next.js app that runs locally. This page walks through installing Node.js, cloning the repo, and getting a working dev server on macOS, Linux, Windows, or WSL2. On a clean machine, expect 10–15 minutes from start to finish.

## Prerequisites

- **Node.js 22 or newer.** `package.json` requires it, and CI tests Node 22 and 24. The examples below use Node 22.
- **Git** for cloning the repository.
- **~1 GB of disk.** `node_modules` is about 500 MB. Another 300 MB if you install Playwright for the reCAPTCHA fallback (optional, see §3).
- **A shell you're comfortable in.** Bash or zsh on macOS and Linux, PowerShell or WSL2 on Windows. WSL2 is Microsoft's Linux-on-Windows environment; it tends to be faster than native PowerShell for Node-based dev work.

## 1. Install Node

### macOS

Install with [nvm](https://github.com/nvm-sh/nvm), which lets you switch Node versions per project without sudo.

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

Same nvm approach. Distro packages (`apt install nodejs`) tend to lag behind, so nvm is the simpler path.

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

On Windows, [fnm](https://github.com/Schniz/fnm) is the cleanest Node manager. It installs via winget.

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
If `npm install` takes more than a few minutes, Windows Defender is probably scanning `node_modules` as it's written. Adding exclusions for your dev tree, `%APPDATA%\npm-cache`, and `node.exe` usually drops install time from ~10 minutes to ~1–3.
:::

### WSL2 (Ubuntu on Windows)

If you're on Windows and don't mind a Linux shell, WSL2 is the faster option.

::: tip Keep the repo on the Linux filesystem
Keep the repo at `~/projects/...` inside WSL, not under `/mnt/c/...`. Cross-filesystem I/O is slow, and `npm run dev` can take 60+ seconds to start if the repo lives on a Windows path.
:::

```powershell
# One-time, as Administrator in PowerShell
wsl --install -d Ubuntu-24.04
```

Then inside the Ubuntu shell:

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

`npm install` pulls roughly 700 packages (~500 MB) and takes 1–3 minutes on a clean machine.

Key figures on briefing cards are cropped from each paper's PDF with pdf.js and a prebuilt native canvas module (`@napi-rs/canvas`), which `npm install` fetches for macOS, Windows and Linux. If the module can't load on your machine, cards simply show no figure.

## 3. Set a local access password

Open `.env.local` in any editor and set `ACCESS_PASSWORD` to something you'll remember:

```bash
ACCESS_PASSWORD=pick-anything-memorable
```

Aparture gates the web UI behind this password — the login screen prompts for it, and every API call re-checks it server-side. There's no auto-generation; you pick the value yourself. The example file ships with `ACCESS_PASSWORD=change-me` as a placeholder.

`npm run dev` listens on 127.0.0.1, so only this machine can open the app, and the placeholder is enough to get started. To reach the app from another device on your network, start it with `npm run dev -- -H 0.0.0.0`, and set a long password first.

You'll also add your LLM API key to this same `.env.local` file on the next page. The dev server starts without one — there's no startup validation — but every pipeline run will fail at its first LLM call until a key is present.

## 4. Identify yourself to arXiv (optional but encouraged)

arXiv's API docs ask clients to include a contact email on every request, so their ops team can reach whoever's responsible if traffic from your IP starts causing issues. Aparture sends this as an HTTP `From` header when `ARXIV_CONTACT_EMAIL` is set in `.env.local`, and sends nothing when it isn't:

```bash
# .env.local
ARXIV_CONTACT_EMAIL=you@example.edu
```

This is not an arXiv account — there's no signup, no password, no verification. arXiv has no auth system for the public query endpoint; the header is purely a goodwill signal, weighted by their abuse heuristics.

::: tip Academic addresses carry more weight
Institutional emails (`.edu`, `.ac.*`) get better treatment from arXiv's rate-limit heuristics than generic webmail (`@gmail.com`, `@outlook.com`). If you have one, use it. If not, setting a webmail address is still better than leaving the variable unset — at least you're reachable.
:::

Skipping this step is fine — Aparture will still work — but enabling it reduces your chance of being throttled, especially on dense runs across many arXiv categories.

## 5. Playwright (optional fallback for reCAPTCHA)

Aparture downloads PDFs directly from arXiv by default, and this works most of the time. Occasionally, arXiv serves a reCAPTCHA challenge instead of the PDF, and the direct download fails. When that happens, Aparture falls back to Playwright — a headless browser that handles the reCAPTCHA session — if it's installed.

Without Playwright, affected papers get a notice in the run log and skip the deep-analysis stage. They stay in the ranking on their abstract score and still reach the briefing, without a full report, and an end-of-run card lists them. Everything else in the pipeline (quick filter, abstract scoring, briefing synthesis, NotebookLM generation) works regardless.

Install it if you'd like the fallback available:

```bash
npx playwright install chromium

# Linux only — installs libnss3, libatk-bridge, etc.
npx playwright install-deps chromium
```

Run `npx playwright install chromium` again after an update that moves Playwright to a new version: each release looks for its own Chromium build, and until it's downloaded the fallback fails to launch.

::: tip Don't delete the Playwright profile
The fallback runs a headless browser in the background; you never see a window or solve a challenge yourself. It keeps its cookies in `temp/playwright-profile/`, which is what lets later downloads skip the challenge. Deleting that folder means the next affected download starts from a fresh session, and the first one after that can take 5–10 seconds longer.
:::

## 6. Verify the toolchain

Before moving on, confirm everything installed cleanly:

```bash
node -v                       # v22.x.x
npm -v                        # 10.x or 11.x
npm run lint                  # ESLint passes
npm test                      # Vitest, fixture-based: no API calls, $0
```

If all four pass, the local setup is ready. `npm run dev` will start and serve the UI now, but pipeline runs will fail at the first LLM call until you've added at least one API key in `.env.local`.

## Common gotchas

**macOS**

- `EACCES` on global install: you likely installed Node via Homebrew instead of nvm. Avoid `sudo npm install -g`; reinstall Node via nvm.

**Linux**

- `Error: Cannot find module` after `nvm install`: your shell init didn't load nvm. Check that `~/.bashrc` contains the nvm block and that you sourced it (or just open a new terminal).
- Playwright complains about `libnss3.so`: run `npx playwright install-deps chromium` (needs sudo).
- **ARM64 only** — `npm test` fails with `Cannot find module '@rolldown/binding-linux-arm64-gnu'`: npm occasionally fails to install the correct platform-specific native binding for vitest's rolldown dependency ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). The dev server (`npm run dev`) is unaffected; only vitest needs the binding. Fix:
  ```bash
  npm install --no-save @rolldown/binding-linux-arm64-gnu
  ```
  If a plain reinstall is preferred: `rm -rf node_modules package-lock.json && npm install`. Same situation applies on Windows ARM64 (`@rolldown/binding-win32-arm64-msvc`) and macOS ARM64 (`@rolldown/binding-darwin-arm64`) if npm's optional-deps handling misses the matching binding.

**Windows native**

- `ENAMETOOLONG` during `npm install`: long paths aren't enabled. Re-run the long-paths step from §1 and set `git config --global core.longpaths true`.

**arXiv rate limits**

- Hitting `arXiv rate limit: exhausted 3 retries` repeatedly on otherwise-modest runs: set `ARXIV_CONTACT_EMAIL` in `.env.local` (see §4) and restart `npm run dev`. See [troubleshooting → arXiv rate limits](/reference/troubleshooting#arxiv-rate-limits) for the full retry/backoff behavior.

**WSL2**

- `npm run dev` takes 60+ seconds to start: the repo is probably under `/mnt/c/...`. Move it to `~/projects/` on the Linux filesystem.
- `localhost:3000` doesn't load from a Windows browser: WSL2 port-forwarding can take a few seconds on first start. If it persists, run `wsl --shutdown` from PowerShell and reopen.

## Next

[Add at least one API key →](/getting-started/api-keys)
