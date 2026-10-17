import { describe, it, expect } from 'vitest';
import { renderBriefingHtml } from '../../../../lib/briefing/v2/render.js';

const b = {
  version: 2,
  date: '2026-10-17',
  headline: 'Flows meet <spectra>',
  lede: 'First paragraph about $\\chi^2$.\n\nSecond paragraph.',
  readFirst: { id: '2610.00001', why: 'Read it.' },
  themes: [{ title: 'Theme one', argument: 'Argument.', paperIds: ['2610.00001', '2610.00002'] }],
  papers: [
    {
      id: '2610.00001',
      title: 'Paper One',
      authors: 'A. Author',
      tier: 'read',
      score: 8.1,
      pitch: 'Pitch.',
      whyYou: 'Why.',
      result: { text: 'Result.', quote: 'A long enough verbatim quote from the paper body text.' },
      method: 'Method.',
      caveat: 'Caveat.',
      figure: { id: 'S1.F1', caption: 'Caption' },
      readingMinutes: 25,
      because: null,
      becauseRefs: [],
    },
    {
      id: '2610.00002',
      title: 'Paper </script> Two',
      authors: 'B. Author',
      tier: 'radar',
      score: 5.2,
      pitch: 'Short.',
      whyYou: 'Why.',
      result: { text: 'R.', quote: 'Another long enough verbatim quote from the paper body.' },
      method: 'M.',
      caveat: 'C.',
      figure: null,
      readingMinutes: 10,
      because: null,
      becauseRefs: [],
    },
  ],
  nearMisses: [{ id: '2610.00003', line: 'Almost.' }],
  notes: {
    learned: '',
    questions: [{ id: 'q1', text: 'Want X?', options: ['Yes', 'No'] }],
    proposals: [],
  },
};

const ctx = {
  meta: new Map(),
  figures: new Map([
    [
      '2610.00001',
      new Map([['S1.F1', { label: 'Figure 1', dataUri: 'data:image/png;base64,AAAA' }]]),
    ],
  ]),
  licenses: new Map([['2610.00001', 'CC BY 4.0']]),
  quoteChecked: new Set(['2610.00001']),
  context: new Map([
    ['2610.00001', { title: 'Paper One', report: 'Report </script><script>alert(1)</script>' }],
  ]),
  stats: { harvested: 1020, yes: 40, maybe: 90, citationsChecked: 3 },
};

describe('renderBriefingHtml', () => {
  const html = renderBriefingHtml(b, ctx);

  it('starts with the page title and escapes model text', () => {
    expect(html.startsWith('<title>Aparture Briefing</title>')).toBe(true);
    expect(html).toContain('Flows meet &lt;spectra&gt;');
    expect(html).toContain('Paper &lt;/script&gt; Two');
  });

  it('keeps embedded JSON from closing its script element', () => {
    const dataBlock = html
      .split('<script type="application/json" id="aparture-data">')[1]
      .split('</script>')[0];
    expect(dataBlock).not.toMatch(/<\/?script/i);
    expect(JSON.parse(dataBlock).context['2610.00001'].report).toContain('alert(1)');
  });

  it('inlines the chosen figure with its license, and shows tiers, counts and near misses', () => {
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('Figure 1 · CC BY 4.0');
    expect(html).toContain('1,020 papers screened');
    expect(html).toContain('130 kept by triage');
    expect(html).toContain('matched to the paper text');
    expect(html).toContain('arXiv:2610.00003');
    expect(html).toContain('On the radar');
    expect(html).toContain('data-question="q1"');
  });

  it('wraps a standalone document only when asked', () => {
    expect(html).not.toContain('<!doctype');
    expect(renderBriefingHtml(b, { ...ctx, standalone: true }).startsWith('<!doctype html>')).toBe(
      true
    );
  });
});

describe('figure licensing', () => {
  it('links instead of copying a figure under a non-reuse license', () => {
    const html = renderBriefingHtml(b, {
      ...ctx,
      figures: new Map([
        ['2610.00001', new Map([['S1.F1', { label: 'Figure 1', linkOnly: true }]])],
      ]),
      licenses: new Map([['2610.00001', 'arXiv.org perpetual non-exclusive license']]),
    });
    expect(html).not.toContain('data:image/png');
    expect(html).toContain('View Figure 1 on arXiv');
    expect(html).toContain('https://arxiv.org/html/2610.00001#S1.F1');
  });

  it('recognizes Creative Commons and public-domain licenses', async () => {
    const { figureReuseAllowed } = await import('../../../../lib/briefing/v2/render.js');
    expect(figureReuseAllowed('CC BY 4.0')).toBe(true);
    expect(figureReuseAllowed('http://creativecommons.org/licenses/by-nc-sa/4.0/')).toBe(true);
    expect(figureReuseAllowed('Public Domain')).toBe(true);
    expect(figureReuseAllowed('arXiv.org perpetual non-exclusive license')).toBe(false);
    expect(figureReuseAllowed(null)).toBe(false);
  });
});
