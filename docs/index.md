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

Aparture is a local web app for daily arXiv monitoring using LLMs. You write a profile describing your research interests in plain English, pick a set of arXiv categories to watch, and each run pulls down new preprints, scores them, reads the top PDFs, and produces a briefing — a short editorial summary, a handful of thematic groupings, and per-paper notes tuned to what you said you care about.

The tool is designed to be used over weeks rather than once. You star papers you liked, dismiss ones that missed the mark, and leave comments where you have specific reactions; those signals feed a profile-refinement flow that proposes edits you can accept or reject individually. Over time, the briefings get closer to what you actually want to see.

Aparture isn't a general-purpose search tool — it doesn't index arXiv's backlog, only looks at what's fresh in the categories you chose, and won't push back on your dismissals (except occasionally if a dismissed paper is central to a theme).

<div class="landing-cards">

<div class="landing-card">

### Your profile, your taxonomy

Write your interests as plain prose, not a keyword list. No taxonomies, no schemas, no tuning sliders — the LLM reads what you wrote and uses that to score and filter.

</div>

<div class="landing-card">

### Briefings, not summaries

Each run produces one structured reading piece: an editorial lead, themes, and per-paper cards. Designed to help you decide what to actually open, not just produce a list.

</div>

<div class="landing-card">

### A tight feedback loop

Star, dismiss, or comment on what you see. Those signals accumulate, and the suggest-improvements flow proposes concrete profile edits you can accept or reject per-change.

</div>

<div class="landing-card">

### Bring your own models

Works with Anthropic Claude, OpenAI, and Google Gemini. Mix providers across stages — cheap model for filtering, stronger model for synthesis. All keys stay in your local `.env.local`.

</div>

</div>

## Where to start

New? Walk the Get Started section in order: [Install](/getting-started/install) → [API keys](/getting-started/api-keys) → [Verify](/getting-started/verify-setup) → [Your first briefing](/getting-started/first-briefing). Most people get to their first run in 30–45 minutes.

Already have a briefing on screen? The [Guide](/using/reading-a-briefing) is the main daily reference — [Reading a briefing](/using/reading-a-briefing), [Giving feedback](/using/giving-feedback), [Writing a good profile](/using/writing-a-profile), [Refining over time](/using/refining-over-time) — and [Concepts](/concepts/pipeline) goes deeper into how the pipeline actually works.

## License

MIT.

## Acknowledgements

Built in collaboration with Claude.

---

_Originally built to help the author ([Josh Speagle](https://joshspeagle.com/)) manage daily paper monitoring across cs, stat, and astro-ph. Still optimized for researcher-first workflows._
