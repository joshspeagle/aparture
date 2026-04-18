# Install

Aparture is a Next.js app that runs locally. This page walks you through installing Node.js, cloning the repo, and getting a working dev server on macOS, Linux, Windows, or WSL2.

Total time: 10-15 minutes on a clean machine.

## Prerequisites

- **Node.js 22 LTS.** Next.js 14 supports Node 18.17+, but Node 18 is end-of-life and Node 20 reaches EOL 2026-04-30. Use Node 22 unless you have a reason not to.
- **Git.** For cloning the repo.
- **~1 GB of disk.** `node_modules` is ~500 MB; Playwright's Chromium adds another ~300 MB if you install it.
- **A shell you're comfortable in.** macOS/Linux: bash or zsh. Windows: PowerShell or WSL2 (WSL2 is faster, see §2d).

## 1. Install Node 22 LTS

### macOS

Use [nvm](https://github.com/nvm-sh/nvm) — it lets you switch Node versions per-project without sudo.

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

Same nvm approach. Avoid distro packages (`apt install nodejs`) — they pin you to whatever the distro ships.

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

Use [fnm](https://github.com/Schniz/fnm). It's faster than nvm-windows and installs via winget.

```powershell
# Install fnm
winget install Schniz.fnm

# Add shell integration (paste into $PROFILE, then reopen PowerShell)
# fnm env --use-on-cd | Out-String | Invoke-Expression

fnm install 22
fnm default 22

# Enable Windows long paths (required — node_modules trees are deep).
# Run as Administrator:
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
git config --global core.longpaths true
```

If `npm install` takes more than a few minutes, Windows Defender is probably scanning `node_modules`. Add exclusions for your dev tree, `%APPDATA%\npm-cache`, and `node.exe` — installs drop from ~10 minutes to ~1-3.

### WSL2 (Ubuntu on Windows)

WSL2 is meaningfully faster than native Windows for Next.js dev. If you have the option, use it.

**Critical rule: keep the repo on the Linux filesystem (`~/projects/...`), not `/mnt/c/...`.** Cross-filesystem I/O is the single biggest WSL2 footgun — `npm run dev` can take 60+ seconds to start if the repo lives on `/mnt/c`.

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

`npm install` pulls ~700 packages (~500 MB). Expect 1-3 minutes on a clean machine.

You now have a `.env.local` file you'll fill in on the [API keys page](/getting-started/api-keys). Don't run the dev server yet — it'll fail without at least one API key.

## 3. Playwright (optional)

Playwright is used to bypass arXiv's reCAPTCHA during PDF downloads. It's **optional** — Aparture works fine without it, and most of the pipeline doesn't touch PDFs at all.

If you skip Playwright:

- Direct PDF downloads (no reCAPTCHA) still work.
- Papers that hit reCAPTCHA get a notification in the run log and are skipped from deep analysis (Stage 4).
- Those papers are still ranked in the briefing based on their abstract-level score, with a note that deep analysis was unavailable.
- Quick filter, abstract scoring, and briefing synthesis all work regardless.

Install it if you expect to analyze 10+ papers per day and want full PDF coverage:

```bash
npx playwright install chromium

# Linux only — installs libnss3, libatk-bridge, etc.
npx playwright install-deps chromium
```

First PDF download after install may prompt reCAPTCHA interactively in a headed browser; solve it once and Playwright caches the session in `temp/playwright-profile/`. **Don't delete that folder** — losing it forces a re-solve on the next run.

## 4. Verify the toolchain

Before moving on, confirm everything installed cleanly:

```bash
node -v                       # v22.x.x
npm -v                        # 10.x or 11.x
npm run lint                  # ESLint passes
npm test                      # Vitest — ~400 tests, ~30s, $0 (fixture-based)
```

If all four pass, the local setup is ready. `npm run dev` won't work yet — you need at least one API key in `.env.local` first.

## Common gotchas

**macOS**

- `npm install` fails with `gyp ERR! not found: python` — `brew install python@3.12`.
- `EACCES` on global install — you installed Node via Homebrew instead of nvm. Never `sudo npm install -g`. Reinstall via nvm.

**Linux**

- `Error: Cannot find module` after `nvm install` — shell init didn't load. Check `~/.bashrc` has the nvm block and you `source`d it.
- Playwright chromium missing `libnss3.so` — `npx playwright install-deps chromium` (needs sudo).

**Windows native**

- `ENAMETOOLONG` during `npm install` — enable long paths (§1 step), and `git config --global core.longpaths true`.
- `.env.local` values appear `undefined` — CRLF line endings. Re-save with LF. VS Code's bottom-right status bar shows current endings; click to switch.

**WSL2**

- `npm run dev` takes 60+ seconds to start — repo is under `/mnt/c`. Move it to `~/projects/` (Linux filesystem).
- `localhost:3000` doesn't load from a Windows browser — WSL2 port-forwarding takes a few seconds on first start. If persistent, `wsl --shutdown` and reopen.

More symptom→fix pairs on the [troubleshooting](/reference/troubleshooting) page once it lands.

## Next

[Add at least one API key →](/getting-started/api-keys)
