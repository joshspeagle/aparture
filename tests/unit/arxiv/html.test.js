import { describe, it, expect } from 'vitest';
import { parseArxivHtml } from '../../../lib/arxiv/html.js';

// A trimmed LaTeXML page with the structures arXiv's HTML rendering uses:
// math with alttext, an image figure, an inline-SVG (TikZ) figure, a table,
// nested list paragraphs, a subsection, an appendix, and a bibliography.
const PAGE = `<!DOCTYPE html><html><head><title>x</title></head><body>
<div class="ltx_page_main">License: CC BY 4.0
arXiv:2610.21205v1 [astro-ph.GA] 15 Oct 2026</div>
<article class="ltx_document">
  <h1 class="ltx_title ltx_title_document">A dataset of <math alttext="10^{5}" display="inline"><mn>10</mn></math> spectra</h1>
  <div class="ltx_authors">Ada Author</div>
  <div class="ltx_abstract"><h6>Abstract</h6><p class="ltx_p">We release spectra.</p></div>
  <section class="ltx_section" id="S1">
    <h2 class="ltx_title ltx_title_section">1 Introduction</h2>
    <div class="ltx_para"><p class="ltx_p">The energy is <math alttext="E=mc^{2}" display="inline"><mi>E</mi></math> as usual.</p></div>
    <div class="ltx_para"><ul class="ltx_itemize"><li class="ltx_item"><div class="ltx_para"><p class="ltx_p">First item.</p></div></li></ul></div>
    <section class="ltx_subsection" id="S1.SS1">
      <h3 class="ltx_title ltx_title_subsection">1.1 Data</h3>
      <div class="ltx_para"><p class="ltx_p">We used <math alttext="N=144" display="block"><mi>N</mi></math> sources.</p></div>
    </section>
    <figure class="ltx_figure" id="S1.F1">
      <img src="2610.21205v1/F1.png" class="ltx_graphics" alt="Refer to caption">
      <figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 1: </span>Overview of the <math alttext="\\chi^{2}"><mi>x</mi></math> fit.</figcaption>
    </figure>
    <figure class="ltx_figure" id="S1.F2">
      <svg class="ltx_picture"><g></g></svg>
      <figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 2: </span>A tree.</figcaption>
    </figure>
    <figure class="ltx_figure" id="S1.F3">
      <object type="image/svg+xml" data="2610.21205v1/rv_hist.svg" class="ltx_graphics"></object>
      <figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 3: </span>RV amplitudes.</figcaption>
    </figure>
    <figure class="ltx_table" id="S1.T1">
      <figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_table">Table 1: </span>Results.</figcaption>
    </figure>
  </section>
  <section class="ltx_appendix" id="A1">
    <h2 class="ltx_title ltx_title_appendix">Appendix A Proofs</h2>
    <div class="ltx_para"><p class="ltx_p">Proof text.</p></div>
  </section>
  <section class="ltx_bibliography"><h2>References</h2><ul><li>Ref one.</li></ul></section>
</article></body></html>`;

describe('parseArxivHtml', () => {
  const r = parseArxivHtml(PAGE, { id: '2610.21205', url: 'https://arxiv.org/html/2610.21205' });

  it('reads title, abstract and license, with math as TeX', () => {
    expect(r.ok).toBe(true);
    expect(r.title).toBe('A dataset of $10^{5}$ spectra');
    expect(r.abstract).toBe('We release spectra.');
    expect(r.license).toBe('CC BY 4.0');
  });

  it('resolves image figures to absolute URLs and flags vector figures', () => {
    expect(r.figures).toEqual([
      {
        id: 'S1.F1',
        label: 'Figure 1',
        caption: 'Overview of the $\\chi^{2}$ fit.',
        images: ['https://arxiv.org/html/2610.21205v1/F1.png'],
        inlineSvg: false,
      },
      { id: 'S1.F2', label: 'Figure 2', caption: 'A tree.', images: [], inlineSvg: true },
      {
        id: 'S1.F3',
        label: 'Figure 3',
        caption: 'RV amplitudes.',
        images: ['https://arxiv.org/html/2610.21205v1/rv_hist.svg'],
        inlineSvg: false,
      },
    ]);
    expect(r.tables).toEqual([{ id: 'S1.T1', label: 'Table 1', caption: 'Results.' }]);
  });

  it('emits subsection headings and each paragraph once, display math as $$', () => {
    const intro = r.sections.find((s) => s.heading === '1 Introduction');
    expect(intro.text).toContain('$E=mc^{2}$');
    expect(intro.text).toContain('### 1.1 Data');
    expect(intro.text).toContain('$$N=144$$');
    expect(intro.text.match(/First item\./g)).toHaveLength(1);
  });

  it('marks appendices and drops the bibliography and author block', () => {
    expect(r.sections.map((s) => [s.heading, s.appendix])).toEqual([
      ['1 Introduction', false],
      ['Appendix A Proofs', true],
    ]);
    expect(r.body).not.toContain('Ref one');
    expect(r.body).not.toContain('Ada Author');
  });

  it('reports a page without a LaTeXML article as unavailable', () => {
    const missing = parseArxivHtml('<html><body><p>No HTML for this paper.</p></body></html>', {
      id: '2610.00001',
    });
    expect(missing.ok).toBe(false);
  });
});
