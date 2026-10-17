// Crop one labelled figure ("Figure 3", "Fig. 2") out of a paper's PDF.
//
// The full read names the figure; this finds its caption in the PDF's text
// layer and renders the region above it, up to the nearest line of body
// text. Axis labels and tick marks inside a figure are short lines, so they
// don't stop the upward scan. The caption returned is the paper's own text,
// not model output.
//
// Server-side only: pdf.js renders through @napi-rs/canvas. Both load
// lazily, so a missing native binary costs the figure, not the request.

const RENDER_SCALE = 2;
// A crop shorter than this (PDF points) is a caption-only hit, not a figure.
const MIN_FIGURE_HEIGHT_PT = 40;
const MAX_CAPTION_CHARS = 600;
const WHITE_THRESHOLD = 245;
const TRIM_PAD_PX = 12;

/**
 * The figure number from a label, as printed: "Figure 3" → "3",
 * "Fig. S2" → "S2". Null when the label names no figure.
 */
export function figureNumber(label) {
  const m = String(label ?? '').match(/\b(?:fig(?:ure)?)\.?\s*([A-Za-z]?\d+)/i);
  return m ? m[1] : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Group text items into visual lines, then split a line at wide gaps so the
// two columns of a two-column page become separate segments.
function segmentsOf(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const [a, b, , d, x, y] = it.transform;
    const h = Math.abs(d) || it.height || 1;
    let row = rows.find((r) => Math.abs(r.y - y) < h * 0.4);
    if (!row) rows.push((row = { y, h, items: [] }));
    row.items.push({ x, w: it.width, str: it.str, rotated: Math.abs(b) > Math.abs(a) });
  }
  const segs = [];
  for (const r of rows) {
    r.items.sort((p, q) => p.x - q.x);
    let cur = { y: r.y, h: r.h, items: [] };
    for (const it of r.items) {
      const prev = cur.items.at(-1);
      if (prev && it.x - (prev.x + prev.w) > r.h) {
        segs.push(cur);
        cur = { y: r.y, h: r.h, items: [] };
      }
      cur.items.push(it);
    }
    segs.push(cur);
  }
  for (const s of segs) {
    s.x0 = s.items[0].x;
    s.x1 = Math.max(...s.items.map((i) => i.x + i.w));
    s.text = s.items
      .map((i) => i.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    s.rotated = s.items.filter((i) => i.rotated).length > s.items.length / 2;
  }
  return segs.sort((p, q) => q.y - p.y); // top of the page first
}

function findCaption(segs, number) {
  const n = escapeRegExp(number);
  // A caption starts its line with the label and punctuation; a body
  // reference ("Fig. 3 shows") doesn't.
  const punctuated = new RegExp(`^(?:figure|fig\\.?)\\s*${n}\\s*[.:|—–-]`, 'i');
  const bare = new RegExp(`^(?:figure|fig\\.?)\\s*${n}\\s+[A-Z(]`);
  return segs.find((s) => punctuated.test(s.text)) ?? segs.find((s) => bare.test(s.text)) ?? null;
}

// Column: a caption that starts past mid-page, or ends before it, sits in
// one column of a two-column layout.
function columnOf(cap, pageWidth) {
  const mid = pageWidth / 2;
  if (cap.x0 > mid - 10) return [mid, pageWidth];
  if (cap.x1 - cap.x0 < pageWidth * 0.48 && cap.x1 < mid + 10) return [0, mid];
  return [0, pageWidth];
}

const ANY_CAPTION = /^((?:figure|fig\.?)\s*([A-Za-z]?\d+))\s*[.:|—–-]/i;

function captionText(segs, cap, colX0, colX1) {
  const lines = [cap.text];
  for (let i = segs.indexOf(cap) + 1; i < segs.length; i++) {
    const s = segs[i];
    const prev = segs[i - 1];
    if (prev.y - s.y > cap.h * 1.8) break;
    if (s.x0 < colX0 - 5 || s.x1 > colX1 + 5) continue;
    lines.push(s.text);
    if (lines.join(' ').length > MAX_CAPTION_CHARS) break;
  }
  const text = lines
    .join(' ')
    .replace(/(\w)- (\w)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_CAPTION_CHARS ? `${text.slice(0, MAX_CAPTION_CHARS - 1)}…` : text;
}

// Bounding box of non-white pixels, padded; null for a blank region.
function inkBox(ctx, w, h) {
  const px = ctx.getImageData(0, 0, w, h).data;
  let top = h;
  let bottom = -1;
  let left = w;
  let right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (px[k] < WHITE_THRESHOLD || px[k + 1] < WHITE_THRESHOLD || px[k + 2] < WHITE_THRESHOLD) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return null;
  const x0 = Math.max(0, left - TRIM_PAD_PX);
  const y0 = Math.max(0, top - TRIM_PAD_PX);
  return {
    x: x0,
    y: y0,
    w: Math.min(w, right + TRIM_PAD_PX) - x0,
    h: Math.min(h, bottom + TRIM_PAD_PX) - y0,
  };
}

async function loadLibraries() {
  try {
    const [pdfjs, canvas] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('@napi-rs/canvas'),
    ]);
    return { getDocument: pdfjs.getDocument, createCanvas: canvas.createCanvas };
  } catch (err) {
    console.warn('[cropFigure] pdf.js or the canvas binding is unavailable:', err.message);
    return null;
  }
}

/**
 * @param {Uint8Array|Buffer} pdfBytes
 * @param {string} label  the figure's label as the paper prints it
 * @returns {Promise<{png: Buffer, caption: string, page: number, width: number, height: number} | null>}
 */
export async function cropFigure(pdfBytes, label) {
  const number = figureNumber(label);
  if (!number || !pdfBytes?.length) return null;
  const libs = await loadLibraries();
  if (!libs) return null;

  // pdf.js takes ownership of the buffer it is given; copy so the caller's
  // bytes stay usable.
  const data = new Uint8Array(pdfBytes);
  const loading = libs.getDocument({ data, verbosity: 0, isEvalSupported: false });
  const doc = await loading.promise;
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const segs = segmentsOf((await page.getTextContent()).items);
      const cap = findCaption(segs, number);
      if (!cap) continue;

      const [colX0, colX1] = columnOf(cap, vp.width);
      const colW = colX1 - colX0;

      const isBody = (s) =>
        s.y > cap.y + cap.h &&
        s.x0 >= colX0 - 5 &&
        s.x1 <= colX1 + 5 &&
        s.x1 - s.x0 > colW * 0.6 &&
        s.h >= cap.h * 0.8 &&
        !s.rotated &&
        s.text.split(' ').length >= 5;
      // The running header stops the scan too.
      const isHeader = (s) => s === segs[0] && s.y > vp.height * 0.88 && s.y > cap.y;
      let above = segs.filter((s) => isBody(s) || isHeader(s)).sort((a, b) => a.y - b.y)[0];
      // A paragraph's short last line sits just below a full one; it belongs
      // to the text, not the figure.
      for (let extended = true; above && extended;) {
        extended = false;
        const next = segs.find(
          (s) =>
            s.y < above.y &&
            s.y > cap.y + cap.h &&
            above.y - s.y < above.h * 1.6 &&
            Math.abs(s.h - above.h) < above.h * 0.15 &&
            s.x0 >= colX0 - 5 &&
            s.x1 <= colX1 + 5 &&
            Math.abs(s.x0 - above.x0) < above.h * 2 &&
            !s.rotated
        );
        if (next) {
          above = next;
          extended = true;
        }
      }
      const topY = above ? above.y - above.h * 0.3 : vp.height - 20;
      const bottomY = cap.y + cap.h * 1.2;
      if (topY - bottomY < MIN_FIGURE_HEIGHT_PT) continue;

      const v2 = page.getViewport({ scale: RENDER_SCALE });
      const pageCanvas = libs.createCanvas(Math.ceil(v2.width), Math.ceil(v2.height));
      const pctx = pageCanvas.getContext('2d');
      pctx.fillStyle = '#fff';
      pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await page.render({ canvasContext: pctx, canvas: pageCanvas, viewport: v2 }).promise;

      const sx = Math.max(0, Math.floor(colX0 * RENDER_SCALE));
      const sw = Math.min(pageCanvas.width - sx, Math.ceil(colW * RENDER_SCALE));
      const sy = Math.max(0, Math.floor((vp.height - topY) * RENDER_SCALE));
      const sh = Math.min(pageCanvas.height - sy, Math.ceil((topY - bottomY) * RENDER_SCALE));
      const region = libs.createCanvas(sw, sh);
      const rctx = region.getContext('2d');
      rctx.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      const box = inkBox(rctx, sw, sh);
      if (!box) continue;

      // A landscape figure set sideways on the page: its text runs up the
      // page, so turn the crop upright.
      const inside = segs.filter((s) => s.y < topY && s.y > bottomY);
      const sideways =
        inside.length > 0 && inside.filter((s) => s.rotated).length > inside.length / 2;
      const outW = sideways ? box.h : box.w;
      const outH = sideways ? box.w : box.h;
      const out = libs.createCanvas(outW, outH);
      const octx = out.getContext('2d');
      octx.fillStyle = '#fff';
      octx.fillRect(0, 0, outW, outH);
      if (sideways) {
        octx.translate(outW, 0);
        octx.rotate(Math.PI / 2);
      }
      octx.drawImage(region, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

      return {
        png: out.toBuffer('image/png'),
        caption: captionText(segs, cap, colX0, colX1),
        page: p,
        width: outW,
        height: outH,
      };
    }
    return null;
  } finally {
    await loading.destroy();
  }
}

/**
 * Every figure caption in a PDF, first occurrence of each number, in page
 * order. For papers with no HTML rendering, this stands in for the figure
 * list arXiv's HTML gives.
 * @returns {Promise<Array<{id: string, label: string, caption: string, page: number}>>}
 */
export async function listFigures(pdfBytes) {
  if (!pdfBytes?.length) return [];
  const libs = await loadLibraries();
  if (!libs) return [];
  const loading = libs.getDocument({
    data: new Uint8Array(pdfBytes),
    verbosity: 0,
    isEvalSupported: false,
  });
  const doc = await loading.promise;
  const seen = new Set();
  const figures = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const segs = segmentsOf((await page.getTextContent()).items);
      for (const s of segs) {
        const m = s.text.match(ANY_CAPTION);
        if (!m || seen.has(m[2].toUpperCase())) continue;
        seen.add(m[2].toUpperCase());
        const [colX0, colX1] = columnOf(s, vp.width);
        figures.push({
          id: `Figure ${m[2]}`,
          label: m[1],
          caption: captionText(segs, s, colX0, colX1),
          page: p,
        });
      }
    }
    return figures;
  } finally {
    await loading.destroy();
  }
}
