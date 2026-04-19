---
layout: home

hero:
  name: <span class="hero-name">Ap<span class="ar-highlight">ar</span>ture</span>
  text: <span class="tagline-text">Bringing the <span class="arxiv-highlight"><span class="arxiv-ar-highlight">ar</span>Xiv</span> into focus</span>
  tagline: Multi-stage research paper discovery and analysis using LLMs
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/install
    - theme: alt
      text: View on GitHub
      link: https://github.com/joshspeagle/aparture
---

Aparture is a local web app for daily arXiv monitoring using LLMs. You write a profile describing your research interests in plain English, pick a set of arXiv categories to watch, and each run pulls down new preprints, scores them, reads the top PDFs, and produces a briefing — a short editorial summary, a handful of thematic groupings, and per-paper notes tuned to your profile.

It's designed to be used over weeks rather than once: you star papers you liked, dismiss ones that missed the mark, and comment where you have specific reactions. Those signals feed into a profile-refinement flow that proposes edits you can accept or reject individually, so the briefings gradually converge on what you actually want to see.

<div class="landing-cards">

<div class="landing-card">
<div class="landing-icon">📝</div>

### Your profile, your taxonomy

Write your interests as plain prose, not a keyword list. No taxonomies, no schemas, no tuning sliders — the LLM reads what you wrote and uses that to score and filter.

</div>

<div class="landing-card">
<div class="landing-icon">📰</div>

### Briefings, not summaries

Each run produces one structured reading piece: an editorial lead, themes, and per-paper cards. Designed to help you decide what to actually open, not just produce a list.

</div>

<div class="landing-card">
<div class="landing-icon">🔁</div>

### A tight feedback loop

Star, dismiss, or comment on what you see. Those signals accumulate, and the suggest-improvements flow proposes concrete profile edits you can accept or reject per-change.

</div>

<div class="landing-card">
<div class="landing-icon">🧩</div>

### Bring your own models

Works with Anthropic Claude, OpenAI, and Google Gemini. Mix providers across stages — cheap model for filtering, stronger model for synthesis. All keys stay in your local `.env.local`.

</div>

</div>

## Get started

<div class="step-cards step-cards-3">

<a class="step-card" href="/aparture/getting-started/install.html">
  <span class="step-number">STEP 01</span>
  <h4>Install</h4>
  <p>Node, the repo, optional Playwright. About 5 minutes.</p>
</a>

<a class="step-card" href="/aparture/getting-started/api-keys.html">
  <span class="step-number">STEP 02</span>
  <h4>API keys</h4>
  <p>Pick a provider, create a key, paste into <code>.env.local</code>.</p>
</a>

<a class="step-card" href="/aparture/getting-started/verify-setup.html">
  <span class="step-number">STEP 03</span>
  <h4>Verify setup</h4>
  <p>Dry run (free) and Minimal API Test (~$0.20–$1 on paid tiers).</p>
</a>

</div>

<a class="step-card step-card-cta" href="/aparture/using/first-briefing.html">
  <span class="step-number">READY TO RUN</span>
  <h4>Start using Aparture →</h4>
  <p>A narrated 10-minute walk through your first real briefing, end to end.</p>
</a>

Already have Aparture running? The [Guide](/using/first-briefing) covers daily use — running briefings, reading them, giving feedback, writing a profile, refining over time — [Under the Hood](/concepts/pipeline) goes deeper into how the pipeline and briefings actually work, and [Reference](/reference/environment) is the lookup surface for env vars, prompt files, and troubleshooting symptoms.

<div class="landing-footer">

MIT License · Built in collaboration with Claude · [Report an issue](https://github.com/joshspeagle/aparture/issues)

_Originally built to help the author ([Josh Speagle](https://joshspeagle.com/)) manage daily paper monitoring across cs, stat, and astro-ph._

</div>
