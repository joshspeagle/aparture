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

Aparture is a local web application that reads the daily arXiv listings so you can stop skimming them manually. You describe your research in plain English and select the arXiv categories you follow. Each run scores the new preprints in those categories against your description, reads the highest-scoring manuscripts in full, and writes a cohesive briefing that groups the papers into themes and explains how each one connects to your work. Every citation in the briefing is verified against the input papers before the page renders.

Aparture is designed for continuous daily use over weeks and months. As you read each briefing, you star papers that were valuable, dismiss papers that missed the mark, and leave comments where you have specific reactions. When you request profile suggestions, Aparture turns those accumulated signals into concrete proposed edits to your research profile that you can accept or reject individually.

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

### Bring your own models

Aparture supports Anthropic, OpenAI, and Google models, and each pipeline stage can use a different model (such as a fast model for filtering and a frontier model for full-PDF reading). Your API keys stay in `.env.local` on your machine.

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
  <h4>API keys</h4>
  <p>Choose a provider, create an API key, and add it to <code>.env.local</code>.</p>
</a>

<a class="step-card" :href="withBase('/getting-started/verify-setup.html')">
  <span class="step-number">STEP 03</span>
  <h4>Verify setup</h4>
  <p>Run the free Dry Run and the Minimal API Test (~$0.20–$1 on paid tiers).</p>
</a>

</div>

<a class="step-card step-card-cta" :href="withBase('/using/first-briefing.html')">
  <span class="step-number">READY TO RUN</span>
  <h4>Start using Aparture →</h4>
  <p>Follow a narrated 10-minute walkthrough of your first live briefing from start to finish.</p>
</a>

If you already have Aparture running, the [Guide](/using/first-briefing) covers daily workflows from running and reading briefings to recording feedback and refining your profile, [Under the Hood](/concepts/pipeline) explains the pipeline architecture and briefing checks, and [Reference](/reference/environment) documents environment variables, prompt templates, and troubleshooting steps.

<div class="landing-footer">

MIT License · Built in collaboration with Claude · [Report an issue](https://github.com/joshspeagle/aparture/issues)

_Originally built to help the author ([Josh Speagle](https://joshspeagle.com/)) manage daily paper monitoring across cs, stat, and astro-ph._

</div>
