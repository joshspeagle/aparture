# Aparture

_Bringing the arXiv into focus._

A web app that turns daily arXiv scanning into a briefing — cross-paper synthesis tuned to your specific research interests. You write a profile in plain English, Aparture filters and analyzes new papers, and you get one structured read per run. Star, dismiss, or comment — the feedback loop refines your profile over time.

![a rendered briefing](docs/public/screenshots/briefing-hero.png)

## Quickstart

```bash
git clone https://github.com/joshspeagle/aparture.git
cd aparture
npm install
cp .env.local.example .env.local   # then add your key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Full walkthrough: [Getting Started →](https://joshspeagle.github.io/aparture/getting-started/install)

> **On ARM64 (Apple Silicon, Linux ARM, Windows ARM)?** `npm install` mostly works, but `npm test` may fail with `Cannot find module '@rolldown/binding-*'` due to an npm optional-deps bug. Fix with `npm install --no-save @rolldown/binding-<your-platform>` — see [troubleshooting → rolldown binding](https://joshspeagle.github.io/aparture/reference/troubleshooting#npm-install-failures).

## Documentation

[joshspeagle.github.io/aparture](https://joshspeagle.github.io/aparture/) — complete docs.

- [Get Started](https://joshspeagle.github.io/aparture/getting-started/install) — install, API keys, verify, first briefing
- [Using Aparture](https://joshspeagle.github.io/aparture/using/reading-a-briefing) — reading briefings, feedback loop, writing a profile
- [Under the Hood](https://joshspeagle.github.io/aparture/concepts/pipeline) — pipeline, models, briefing anatomy
- [Reference](https://joshspeagle.github.io/aparture/reference/environment) — env vars, prompts, troubleshooting

## License

MIT.

## Acknowledgements

Built in collaboration with Claude.

---

**Note:** Originally built to help the author (Josh Speagle) manage daily paper monitoring across cs, stat, and astro-ph. Still optimized for researcher-first workflows.
