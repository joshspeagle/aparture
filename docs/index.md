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

Aparture is a local web app for daily arXiv monitoring. Describe your research interests in natural language, point it at the categories you read, and it produces a cross-paper briefing — themes, debates, longitudinal observations, and per-paper reports — tuned to your profile. You keep refining over time by starring, dismissing, and commenting on what you see; your profile learns from the feedback.

![A rendered Aparture briefing](/screenshots/briefing-hero.png)

<div class="landing-cards">

<div class="landing-card">

### For researchers

Daily arXiv monitoring in natural language. No keyword lists, no taxonomy gymnastics — write what you care about, and the pipeline does the rest.

</div>

<div class="landing-card">

### Briefings, not reports

Cross-paper synthesis tuned to your interests. Debates between papers, longitudinal observations, question-of-the-day — not just a list of summaries.

</div>

<div class="landing-card">

### You stay in the loop

Star, dismiss, override, comment. Your feedback feeds back into the profile, so next week's briefing reflects what you actually care about.

</div>

<div class="landing-card">

### Claude, GPT, or Gemini

Use whatever you have keys for. Mix providers across stages — cheap model for filtering, premium model for briefing synthesis.

</div>

</div>

## New here?

Walk the recipe in order — most people get to their first briefing in 30-45 minutes.

1. **[Install](/getting-started/install)** — Node, the repo, optional Playwright.
2. **[API keys](/getting-started/api-keys)** — pick a provider, create a key, paste into `.env.local`.
3. **[Verify setup](/getting-started/verify-setup)** — Dry Run (free) + Minimal API Test (~$0.01-0.05).
4. **[Your first briefing](/getting-started/first-briefing)** — a narrated 10-minute run through the UI.

## Already set up?

Jump into the daily-use guides:

- [Reading a briefing](/using/reading-a-briefing) — the view you'll stare at every morning.
- [Giving feedback](/using/giving-feedback) — star, dismiss, override, comment.
- [Writing a good profile](/using/writing-a-profile) — the highest-leverage input you control.
- [Refining over time](/using/refining-over-time) — the suggest-improvements loop.

## License

MIT.

## Acknowledgements

Built in collaboration with Claude.

---

_Originally built to help the author ([Josh Speagle](https://joshspeagle.com/)) manage daily paper monitoring across cs, stat, and astro-ph. Still optimized for researcher-first workflows._
