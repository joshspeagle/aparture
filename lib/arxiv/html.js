// Parser for arXiv's HTML rendering of a paper (https://arxiv.org/html/<id>),
// which arXiv produces with LaTeXML for most new submissions.
//
// Returns readable text for deep reading (math replaced by its LaTeX source,
// bibliography dropped), the figures with captions and absolute image URLs,
// table captions, and the license line. Pure: takes the HTML string, does no
// I/O. Needs a DOMParser (native in the browser; lib/headless/runtime.js
// installs jsdom's under Node).

const ARXIV_HTML_ROOT = 'https://arxiv.org/html/';

const squash = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

// LaTeXML emits MathML with the TeX source in `alttext`. Swapping each math
// node for `$tex$` keeps equations legible to a model and to a reader.
function replaceMath(root) {
  const doc = root.ownerDocument ?? root;
  for (const math of Array.from(root.querySelectorAll('math'))) {
    const tex = math.getAttribute('alttext');
    const display = math.getAttribute('display') === 'block';
    const text = tex ? (display ? `$$${tex}$$` : `$${tex}$`) : squash(math.textContent);
    math.replaceWith(doc.createTextNode(` ${text} `));
  }
}

function textOf(el) {
  return el ? squash(el.textContent) : '';
}

function absoluteUrl(src, baseUrl) {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

function figureLabel(fig) {
  const tag = fig.querySelector('.ltx_tag_figure, .ltx_tag_table, .ltx_tag_float');
  return tag ? squash(tag.textContent).replace(/[:.]\s*$/, '') : null;
}

function captionWithoutTag(fig) {
  const cap = fig.querySelector('figcaption');
  if (!cap) return '';
  const clone = cap.cloneNode(true);
  for (const tag of Array.from(clone.querySelectorAll('.ltx_tag'))) tag.remove();
  return squash(clone.textContent);
}

/**
 * @param {string} html     the page HTML
 * @param {Object} opts
 * @param {string} opts.id  versionless arXiv id the page belongs to
 * @param {string} [opts.url]  final URL the page was served from (for resolving relative srcs)
 */
export function parseArxivHtml(html, { id, url } = {}) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const baseUrl = url ?? `${ARXIV_HTML_ROOT}${id}`;
  const article = doc.querySelector('article.ltx_document') ?? doc.querySelector('article');
  if (!article) {
    return { ok: false, reason: 'no LaTeXML article element (HTML version unavailable?)' };
  }

  const licenseMatch = (doc.body?.textContent ?? '').match(/License:\s*([^\n]+?)\s*(?:\n|$)/);
  const license = licenseMatch ? squash(licenseMatch[1]) : null;

  replaceMath(article);

  // LaTeXML emits raster figures as <img src>, vector figures converted
  // from PDF as <object type="image/svg+xml" data>, and TikZ drawings as
  // inline <svg>. The first two have fetchable files; inline SVG doesn't.
  const figures = [];
  for (const fig of Array.from(article.querySelectorAll('figure.ltx_figure'))) {
    // Sub-figures nest inside a parent figure; report the outermost only.
    if (fig.parentElement?.closest('figure.ltx_figure')) continue;
    const images = [
      ...Array.from(fig.querySelectorAll('img')).map((img) => img.getAttribute('src')),
      ...Array.from(fig.querySelectorAll('object[data]'))
        .filter((obj) => (obj.getAttribute('type') ?? 'image/').startsWith('image/'))
        .map((obj) => obj.getAttribute('data')),
    ]
      .map((src) => absoluteUrl(src, baseUrl))
      .filter(Boolean);
    const hasSvg = fig.querySelector('svg') !== null;
    if (images.length === 0 && !hasSvg) continue;
    figures.push({
      id: fig.getAttribute('id'),
      label: figureLabel(fig),
      caption: captionWithoutTag(fig),
      images,
      inlineSvg: hasSvg && images.length === 0,
    });
  }

  const tables = Array.from(article.querySelectorAll('figure.ltx_table')).map((t) => ({
    id: t.getAttribute('id'),
    label: figureLabel(t),
    caption: captionWithoutTag(t),
  }));

  const title = textOf(article.querySelector('.ltx_title_document'));
  const abstract = textOf(article.querySelector('.ltx_abstract'))
    .replace(/^Abstract\s*/i, '')
    .trim();

  // Drop what a reader of the argument doesn't need before flattening.
  for (const el of Array.from(
    article.querySelectorAll('.ltx_bibliography, .ltx_authors, .ltx_dates, nav, script, style')
  )) {
    el.remove();
  }

  // Walk each top-level section in document order: subsection titles become
  // `###` lines, and only outermost paragraphs are emitted (list items nest
  // .ltx_para inside .ltx_para, and the outer textContent already has them).
  const sections = [];
  const topLevel = Array.from(
    article.querySelectorAll('section.ltx_section, section.ltx_appendix')
  ).filter((sec) => !sec.parentElement?.closest('section.ltx_section, section.ltx_appendix'));
  for (const sec of topLevel) {
    const heading = textOf(sec.querySelector(':scope > .ltx_title'));
    const parts = [];
    for (const el of Array.from(sec.querySelectorAll('.ltx_title, .ltx_para'))) {
      if (el.classList.contains('ltx_title')) {
        if (el.parentElement === sec) continue; // the section's own heading
        if (el.closest('figure')) continue; // figure titles live in captions
        const sub = textOf(el);
        if (sub) parts.push(`### ${sub}`);
      } else if (!el.parentElement?.closest('.ltx_para')) {
        const text = squash(el.textContent);
        if (text) parts.push(text);
      }
    }
    sections.push({
      heading,
      appendix: sec.classList.contains('ltx_appendix'),
      text: parts.join('\n\n'),
    });
  }

  const body = sections.length
    ? sections.map((s) => `## ${s.heading}\n\n${s.text}`).join('\n\n')
    : squash(article.textContent);
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return {
    ok: true,
    id,
    url: baseUrl,
    title,
    abstract,
    license,
    figures,
    tables,
    sections,
    body,
    wordCount,
  };
}
