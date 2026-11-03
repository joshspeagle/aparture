---
layout: home

hero:
  name: <span class="hero-name">Ap<span class="ar-highlight">ar</span>ture</span>
  text: <span class="tagline-text">Bringing the <span class="arxiv-highlight"><span class="arxiv-ar-highlight">ar</span>Xiv</span> into focus</span>
  tagline: One daily briefing replaces raw arXiv skimming, with every citation verified against the source papers.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/install
    - theme: alt
      text: View on GitHub
      link: https://github.com/joshspeagle/aparture
---

<script setup>
import { withBase } from 'vitepress';
</script>

Aparture reads the daily arXiv listings so you can stop skimming them manually. You describe your research in plain English and select the arXiv categories you follow. Each run scores the new preprints in those categories against your description, reads the highest-scoring manuscripts in full, and writes a cohesive briefing that groups the papers into themes and explains how each one connects to your work. Every citation in the briefing is verified against the input papers before the page renders.

Aparture is designed for continuous daily use over weeks and months, and you can run it either as a local web application (`npm run dev`, using your own provider API keys in `.env.local` with interactive review gates) or as a headless Agent Skill (`SKILL.md` paired with `node bin/aparture.mjs`, running inside Claude Code, Antigravity, or OpenAI Codex on your existing agent subscription). As you read each briefing, you star papers that were valuable, dismiss papers that missed the mark, and leave comments where you have specific reactions. When you request profile suggestions, Aparture turns those accumulated signals into concrete proposed edits to your research profile that you can accept or reject individually.

<div class="landing-cards">

<div class="landing-card">
<div class="landing-icon">📝</div>

### A profile in plain prose

You describe your research in natural prose the way you would explain it to a colleague. Every stage of the pipeline reads that description, from the initial abstract filter through the final synthesis.

</div>

<div class="landing-card">
<div class="landing-icon">📰</div>

### One briefing per run

Each run produces a single editorial document that synthesizes across the day's papers, opening with an executive summary and highlighting which papers to read first.

</div>

<div class="landing-card">
<div class="landing-icon">🔁</div>

### Feedback becomes profile edits

Star, dismiss, or comment on papers as you read. The Suggest Improvements workflow analyzes your feedback and proposes targeted edits to your profile, citing the specific events that motivated each change so you can accept or reject it.

</div>

<div class="landing-card">
<div class="landing-icon">🧩</div>

### Web app or agent skill

Run the interactive web application in your browser (mixing Anthropic, OpenAI, and Google models per stage with keys in `.env.local`), or invoke the built-in `SKILL.md` workflow inside Claude Code, Antigravity, or Codex without separate API keys.

</div>

</div>

## Get started

<div class="step-cards step-cards-3">

<a class="step-card" :href="withBase('/getting-started/install.html')">
  <span class="step-number">STEP 01</span>
  <h4>Install</h4>
  <p>Install Node.js, clone the repository, and optionally set up Playwright in about 5 minutes.</p>
</a>

<a class="step-card" :href="withBase('/getting-started/api-keys.html')">
  <span class="step-number">STEP 02</span>
  <h4>API keys (web app)</h4>
  <p>Add a provider key to <code>.env.local</code> for the browser app, or skip directly to the Agent Skill.</p>
</a>

<a class="step-card" :href="withBase('/getting-started/verify-setup.html')">
  <span class="step-number">STEP 03</span>
  <h4>Verify setup</h4>
  <p>Run the free Dry Run and the Minimal API Test (~$0.20–$1 on paid tiers).</p>
</a>

</div>

<div class="step-cards step-cards-cta">

<a class="step-card step-card-cta" :href="withBase('/using/first-briefing.html')">
  <span class="step-number">WEB APPLICATION</span>
  <h4>Start in the browser →</h4>
  <p>Follow a narrated 10-minute walkthrough of your first live briefing in the local web interface.</p>
</a>

<a class="step-card step-card-cta" :href="withBase('/add-ons/agent-skill.html')">
  <span class="step-number">AGENT SKILL (SKILL.MD)</span>
  <h4>Run in your coding agent →</h4>
  <p>Execute the pipeline headlessly via <code>SKILL.md</code> and <code>node bin/aparture.mjs</code> in Claude Code, Antigravity, or Codex.</p>
</a>

</div>

If you already have Aparture running, the [Guide](/using/first-briefing) covers daily workflows from running and reading briefings to recording feedback and refining your profile, [Running as an agent skill](/add-ons/agent-skill) documents the `SKILL.md` workflow and headless CLI runner, [Under the Hood](/concepts/pipeline) explains the pipeline architecture and briefing checks, and [Reference](/reference/environment) documents environment variables, prompt templates, and troubleshooting steps.

<div class="landing-footer">

MIT License · Built in collaboration with Claude · [Report an issue](https://github.com/joshspeagle/aparture/issues)

_Originally built to help the author ([Josh Speagle](https://joshspeagle.com/)) manage daily paper monitoring across cs, stat, and astro-ph._

</div>
