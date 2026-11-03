# Aparture

_Aparture brings the daily arXiv listing into focus._

Aparture exists so a researcher can stop skimming the arXiv without worrying about missing relevant papers. You describe your research in plain English. Each run filters the day's papers against that description, reads the strongest matches in full, and writes a single briefing that connects them. Every citation is verified against the input papers before the briefing renders because fabricated references undermine trust in automated synthesis. When the pipeline misjudges a paper, you record feedback, and Aparture proposes an edit to your profile that you can accept or reject. The application runs locally on your machine using your own API keys.

![Aparture renders a daily briefing with an executive summary, thematic synthesis, and claim-checked paper cards.](docs/public/screenshots/briefing-hero.png)

_Aparture renders a daily briefing with an executive summary, thematic synthesis, and claim-checked paper cards._

## Quickstart

```bash
git clone https://github.com/joshspeagle/aparture.git
cd aparture
npm install
cp .env.local.example .env.local   # then add your key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Follow the [Getting Started guide](https://joshspeagle.github.io/aparture/getting-started/install) for a complete walkthrough.

> **ARM64 platforms (Apple Silicon, Linux ARM, Windows ARM):** `npm install` completes normally, but `npm test` may fail with `Cannot find module '@rolldown/binding-*'` because of an npm optional-dependency bug. Run `npm install --no-save @rolldown/binding-<your-platform>` to install the missing binary, and see the [troubleshooting guide for rolldown bindings](https://joshspeagle.github.io/aparture/reference/troubleshooting#npm-install-failures) for platform-specific package names.

## Documentation

The complete documentation is published at [joshspeagle.github.io/aparture](https://joshspeagle.github.io/aparture/):

- **[Get Started](https://joshspeagle.github.io/aparture/getting-started/install):** Installation, API keys, and setup verification.
- **[Using Aparture](https://joshspeagle.github.io/aparture/using/first-briefing):** Running your first briefing, reading briefings, recording feedback, and writing a profile.
- **[Under the Hood](https://joshspeagle.github.io/aparture/concepts/pipeline):** Pipeline stages, model slots, and briefing anatomy.
- **[Reference](https://joshspeagle.github.io/aparture/reference/environment):** Environment variables, prompt templates, and troubleshooting.

## License

Aparture is released under the MIT License.

## Acknowledgements

Aparture was built in collaboration with Claude.

---

**Note:** Aparture was originally built to help the author (Josh Speagle) manage daily paper monitoring across `cs`, `stat`, and `astro-ph`, and it remains optimized for individual researcher workflows.
