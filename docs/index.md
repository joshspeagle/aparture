---
layout: home

hero:
  name: <span class="hero-name">Ap<span class="ar-highlight">ar</span>ture</span>
  text: <span class="tagline-text">Bringing the <span class="arxiv-highlight"><span class="arxiv-ar-highlight">ar</span>Xiv</span> into focus</span>
  tagline: One briefing a day replaces the listings. Every citation in it is checked against the papers it was given.
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

Aparture is a local web app that reads the day's arXiv so you can stop skimming it. You describe your research in plain English and pick the arXiv categories to watch. Each run scores the new preprints in those categories against your description and reads the strongest ones in full. It then writes a briefing that groups the papers into themes and says why each one matters for your work. Every citation in the briefing is checked against the papers it was actually given before anything renders.

It's designed to be used over weeks rather than once. You star papers you liked, dismiss ones that missed the mark, and comment where you have specific reactions. When you ask for suggestions, Aparture turns those signals into proposed edits to your profile, and you accept or reject each one.

<div class="landing-cards">

<div class="landing-card">
<div class="landing-icon">📝</div>

### A profile in plain prose

You describe your research the way you would to a colleague, not as a keyword list. Every stage reads that description, from the first filter to the briefing.

</div>

<div class="landing-card">
<div class="landing-icon">📰</div>

### One briefing per run

Each run produces one piece of writing that argues across the day's papers. It opens with an editorial lead and tells you which papers to open first.

</div>

<div class="landing-card">
<div class="landing-icon">🔁</div>

### Feedback becomes profile edits

Star, dismiss, or comment on what you see. The Suggest Improvements flow reads that feedback and proposes specific edits to your profile, each with the feedback that motivated it. You accept or reject each edit.

</div>

<div class="landing-card">
<div class="landing-icon">🧩</div>

### Bring your own models

Aparture works with Anthropic, OpenAI, and Google models, and each stage can use a different one: a cheap model for filtering, a stronger one for reading papers. Your keys stay in `.env.local` on your machine.

</div>

</div>

## Get started

<div class="step-cards step-cards-3">

<a class="step-card" :href="withBase('/getting-started/install.html')">
  <span class="step-number">STEP 01</span>
  <h4>Install</h4>
  <p>Node, the repo, optional Playwright. About 5 minutes.</p>
</a>

<a class="step-card" :href="withBase('/getting-started/api-keys.html')">
  <span class="step-number">STEP 02</span>
  <h4>API keys</h4>
  <p>Pick a provider, create a key, paste into <code>.env.local</code>.</p>
</a>

<a class="step-card" :href="withBase('/getting-started/verify-setup.html')">
  <span class="step-number">STEP 03</span>
  <h4>Verify setup</h4>
  <p>Dry run (free) and Minimal API Test (~$0.20–$1 on paid tiers).</p>
</a>

</div>

<a class="step-card step-card-cta" :href="withBase('/using/first-briefing.html')">
  <span class="step-number">READY TO RUN</span>
  <h4>Start using Aparture →</h4>
  <p>A narrated 10-minute walk through your first real briefing, end to end.</p>
</a>

Already have Aparture running? The [Guide](/using/first-briefing) covers daily use, from running and reading briefings to giving feedback and refining your profile. [Under the Hood](/concepts/pipeline) explains how the pipeline and briefings work. [Reference](/reference/environment) is where to look up environment variables, prompt files, and troubleshooting symptoms.

<div class="landing-footer">

MIT License · Built in collaboration with Claude · [Report an issue](https://github.com/joshspeagle/aparture/issues)

_Originally built to help the author ([Josh Speagle](https://joshspeagle.com/)) manage daily paper monitoring across cs, stat, and astro-ph._

</div>
