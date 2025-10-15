---
layout: home

hero:
  name: Aparture
  text: Bringing the arXiv into focus
  tagline: Multi-stage research paper discovery and analysis using LLMs
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/joshspeagle/aparture

features:
  - icon: 🔍
    title: Multi-stage Filtering
    details: Quick filter → Abstract scoring → PDF analysis for precision discovery
  - icon: 🤖
    title: Multiple LLM Support
    details: Claude, GPT-5, and Gemini models for flexible analysis
  - icon: 📊
    title: Smart Scoring
    details: 0-10 scale relevance with detailed justifications
  - icon: 📄
    title: Deep PDF Analysis
    details: Full content analysis for top papers with vision support
  - icon: 🎙️
    title: Podcast Generation
    details: Auto-generate AI podcasts via NotebookLM integration
  - icon: ⚙️
    title: CLI Automation
    details: Fully automated daily workflow with unattended execution
---

## What is Aparture?

**Aparture** is a multi-stage research paper discovery and analysis tool that uses large language models (LLMs) to help you search through arXiv to find the preprints that matter for your particular research interests.

It was mainly designed to help the author (Josh Speagle) survive searching through 3 categories (cs, stat, astro-ph) on a daily basis to help keep up with literature across a wide variety of fields.

## Supported Models

The package currently supports the following APIs:

- **Anthropic**: Claude Opus 4.1, Claude Sonnet 4.5, Claude Haiku 3.5
- **OpenAI**: GPT-5, GPT-5 Mini, GPT-5 Nano
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite

## Quick Links

- [Installation Guide →](/getting-started/installation)
- [Web Interface →](/user-guide/web-interface)
- [CLI Automation →](/user-guide/cli-automation)
- [API Reference →](/api-reference/commands)

## License

MIT License - Created in collaboration with Claude Sonnet 4/4.5 and Claude Opus 4.1.
