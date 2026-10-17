// The skill's runner: a paper with no HTML version gets its figure list
// from the PDF's captions, and render crops the chosen figure from the PDF.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const PDF = path.join(ROOT, 'tests/fixtures/pdf/figure.pdf');
const ID = '2610.00001';
const CAPTION =
  'Figure 1. Recovered population versus the injected one, for every bin of the survey.';
const QUOTE = 'We fit a hierarchical model to the survey and compare the recovered population';

let run;
beforeEach(() => {
  run = fs.mkdtempSync(path.join(os.tmpdir(), 'aparture-run-'));
});
afterEach(() => fs.rmSync(run, { recursive: true, force: true }));

function setUp(license) {
  const papers = path.join(run, 'papers');
  fs.mkdirSync(papers, { recursive: true });
  const pdfPath = path.join(papers, `${ID}.pdf`);
  fs.copyFileSync(PDF, pdfPath);
  const links = { abs: `https://arxiv.org/abs/${ID}`, pdf: `https://arxiv.org/pdf/${ID}` };
  fs.writeFileSync(
    path.join(run, 'candidates.json'),
    JSON.stringify({ papers: [{ id: ID, title: 'Paper One', links, categories: [] }] })
  );
  fs.writeFileSync(path.join(run, 'selection.json'), '{}');
  fs.writeFileSync(
    path.join(papers, `${ID}.md`),
    `# Paper One\n\n${QUOTE} with the injected one.\n`
  );
  fs.writeFileSync(
    path.join(papers, `${ID}.json`),
    JSON.stringify({
      id: ID,
      htmlAvailable: false,
      license,
      figures: [
        { id: 'Figure 1', label: 'Figure 1', caption: CAPTION, page: 1, images: [], source: 'pdf' },
      ],
      figureFiles: [],
      pdfPath,
      links,
    })
  );
  const paper = {
    id: ID,
    title: 'Paper One',
    authors: 'A. Author',
    tier: 'read',
    score: 8,
    pitch: 'Pitch.',
    whyYou: 'Why.',
    result: { text: 'Result.', quote: QUOTE },
    method: 'Method.',
    caveat: 'Caveat.',
    figure: { id: 'Figure 1', caption: 'Recovered versus injected.' },
    readingMinutes: 10,
    because: null,
    becauseRefs: [],
  };
  fs.writeFileSync(
    path.join(run, 'briefing.json'),
    JSON.stringify({
      version: 2,
      date: '2026-10-17',
      headline: 'H',
      lede: 'L.',
      readFirst: { id: ID, why: 'W.' },
      themes: [{ title: 'T', argument: 'A.', paperIds: [ID] }],
      papers: [paper],
      nearMisses: [],
      notes: { learned: '', questions: [], proposals: [] },
    })
  );
}

const render = () => {
  const out = path.join(run, 'briefing.html');
  execFileSync(
    process.execPath,
    ['bin/aparture.mjs', 'render', '--run', run, '--state', run, '--out', out],
    {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    }
  );
  return fs.readFileSync(out, 'utf8');
};

describe('runner render, PDF-only paper', () => {
  it('crops the chosen figure from the PDF under a reuse license', () => {
    setUp('CC BY 4.0');
    const html = render();
    expect(html).toMatch(/<img src="data:image\/png;base64,[A-Za-z0-9+/]{100,}/);
    expect(fs.existsSync(path.join(run, 'papers', 'figures', ID, 'Figure-1.png'))).toBe(true);
  });

  it('links to the PDF page instead under arXiv’s default license', () => {
    setUp('http://arxiv.org/licenses/nonexclusive-distrib/1.0/');
    const html = render();
    expect(html).not.toContain('data:image/png');
    expect(html).toContain(`https://arxiv.org/pdf/${ID}#page=1`);
  });
});
