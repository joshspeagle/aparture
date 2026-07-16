# Aparture

_Bringing the arXiv into focus._

Aparture exists so a researcher can stop skimming the arXiv without worrying about what they're missing. You describe your research in plain English. Each run filters the day's papers against that description, reads the strongest matches in full, and writes one briefing that connects them. Every citation is checked against the papers it was actually given before the briefing renders. When it misjudges a paper, you say so, and it proposes an edit to your profile that you accept or reject. It runs on your machine, with your API keys.

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
