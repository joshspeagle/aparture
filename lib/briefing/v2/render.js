// Renders a v2 briefing as one self-contained HTML page: the morning
// newsletter. Pure (string in, string out); the caller inlines figure images
// as data: URIs because the artifact viewer blocks every other image host.
//
// The page works as a plain file (read-only) and, published as a claude.ai
// artifact, lights up feedback controls through the `db` capability and a
// per-paper "ask" box through `sample`. The feedback documents it writes are
// read back by the next run (see the skill's references/feedback.md).

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Escape, then set inline TeX ($...$) in its own span so it reads as math
// source rather than stray dollar signs.
const prose = (s) => esc(s).replace(/\$([^$\n]{1,200})\$/g, '<span class="tex">$1</span>');

const paragraphs = (s) =>
  String(s ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${prose(p)}</p>`)
    .join('');

const TIER_LABEL = { read: 'Read', skim: 'Skim', radar: 'On the radar' };

function longDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function linksRow(id, links) {
  const l = links ?? {};
  const items = [
    ['Abstract', l.abs ?? `https://arxiv.org/abs/${id}`],
    ['PDF', l.pdf ?? `https://arxiv.org/pdf/${id}`],
    ['HTML', l.html ?? `https://arxiv.org/html/${id}`],
    ['alphaXiv', l.alphaxiv ?? `https://www.alphaxiv.org/abs/${id}`],
  ];
  if (l.code) items.push(['Code', l.code]);
  return `<nav class="links" aria-label="Links for ${esc(id)}">${items
    .map(([label, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`)
    .join('')}</nav>`;
}

function feedbackRow(id) {
  return `<div class="fb" data-paper="${esc(id)}">
  <button type="button" class="fb-btn" data-act="star" aria-pressed="false"><span aria-hidden="true">☆</span> Star</button>
  <button type="button" class="fb-btn" data-act="dismiss" aria-pressed="false">Not for me</button>
  <button type="button" class="fb-btn" data-act="knew" aria-pressed="false">Already knew it</button>
  <button type="button" class="fb-btn" data-act="comment" aria-expanded="false">Comment</button>
  <button type="button" class="fb-btn needs-sample" data-act="ask" aria-expanded="false" hidden>Ask about it</button>
  <div class="fb-comment" hidden>
    <label class="sr" for="c-${esc(id)}">Comment on ${esc(id)}</label>
    <textarea id="c-${esc(id)}" rows="2" placeholder="What did it get right or wrong for you?"></textarea>
    <button type="button" class="fb-save">Save comment</button>
  </div>
  <div class="fb-ask" hidden>
    <label class="sr" for="a-${esc(id)}">Question about ${esc(id)}</label>
    <input id="a-${esc(id)}" type="text" placeholder="How does their prior differ from a standard hierarchical model?">
    <button type="button" class="fb-ask-go">Ask</button>
    <div class="fb-answer" aria-live="polite"></div>
  </div>
</div>`;
}

// Figures are copied into the page only when the paper's license allows
// reuse (Creative Commons or public domain). arXiv's default non-exclusive
// license grants arXiv distribution rights, not ours, so those figures are
// linked instead.
export function figureReuseAllowed(license) {
  return /\bCC\b|creativecommons|public domain/i.test(license ?? '');
}

function figurePlate(p, ctx) {
  if (!p.figure) return '';
  const fig = ctx.figures?.get(p.id)?.get(p.figure.id);
  if (!fig) return '';
  const license = ctx.licenses?.get(p.id);
  if (fig.linkOnly) {
    return `<p class="figure-link"><a href="https://arxiv.org/html/${esc(p.id)}#${esc(p.figure.id)}" target="_blank" rel="noopener">View ${esc(fig.label ?? 'the figure')} on arXiv</a> <span>${prose(p.figure.caption)}</span></p>`;
  }
  if (!fig.dataUri) return '';
  return `<figure class="plate">
  <img src="${fig.dataUri}" alt="${esc(p.figure.caption)}" loading="lazy">
  <figcaption><span class="plate-label">${esc(fig.label ?? 'Figure')}${license ? ` · ${esc(license)}` : ''}</span> ${prose(p.figure.caption)}</figcaption>
</figure>`;
}

function paperBlock(p, ctx) {
  const meta = ctx.meta?.get(p.id) ?? {};
  const cats = (meta.categories ?? []).slice(0, 3).join(' · ');
  const head = `<header class="paper-head">
  <p class="tier tier-${p.tier}"><span>${TIER_LABEL[p.tier]}</span>${p.tier !== 'radar' ? ` <span class="mins">${p.readingMinutes} min</span>` : ''}<span class="score" title="Relevance to your profile, 0–10">${p.score.toFixed(1)}</span></p>
  <h3 class="paper-title"><a href="https://arxiv.org/abs/${esc(p.id)}" target="_blank" rel="noopener">${prose(p.title)}</a></h3>
  <p class="byline">${esc(p.authors)} <span class="arxiv-id">arXiv:${esc(p.id)}</span>${cats ? ` <span class="cats">${esc(cats)}</span>` : ''}</p>
</header>`;
  const because = p.because ? `<p class="because">${prose(p.because)}</p>` : '';

  if (p.tier === 'radar') {
    return `<article class="paper paper-radar" id="p-${esc(p.id)}">${head}<p class="pitch">${prose(p.pitch)}</p>${because}${linksRow(p.id, meta.links)}${feedbackRow(p.id)}</article>`;
  }
  const detail =
    p.tier === 'read'
      ? `<dl class="facts"><div><dt>Method</dt><dd>${prose(p.method)}</dd></div><div><dt>Caveat</dt><dd>${prose(p.caveat)}</dd></div></dl>`
      : `<dl class="facts"><div><dt>Caveat</dt><dd>${prose(p.caveat)}</dd></div></dl>`;
  return `<article class="paper paper-${p.tier}" id="p-${esc(p.id)}">
${head}
${p.tier === 'read' ? figurePlate(p, ctx) : ''}
<p class="pitch">${prose(p.pitch)}</p>
${because}
<div class="why"><h4>Why it matters to you</h4><p>${prose(p.whyYou)}</p></div>
<div class="result"><h4>Key result</h4><p>${prose(p.result.text)}</p>
<blockquote class="quote"><p>${prose(p.result.quote)}</p><footer>From the paper${ctx.quoteChecked?.has(p.id) ? ' · <span class="verified">matched to the paper text</span>' : ''}</footer></blockquote></div>
${detail}
${linksRow(p.id, meta.links)}
${feedbackRow(p.id)}
</article>`;
}

function notesBlock(b) {
  const n = b.notes;
  const parts = [];
  if (n.learned) parts.push(`<p class="learned">${prose(n.learned)}</p>`);
  for (const q of n.questions) {
    parts.push(`<div class="question" data-question="${esc(q.id)}">
  <p class="q-text">${prose(q.text)}</p>
  <div class="q-options" role="group" aria-label="Answers">${q.options
    .map(
      (o) =>
        `<button type="button" class="q-opt" data-answer="${esc(o)}" aria-pressed="false">${esc(o)}</button>`
    )
    .join('')}</div>
</div>`);
  }
  for (const pr of n.proposals) {
    const verb = { insert: 'Add', replace: 'Change', delete: 'Remove' }[pr.edit.type];
    const target = pr.target === 'profile' ? 'your profile' : 'what Aparture has learned';
    parts.push(`<div class="proposal" data-proposal="${esc(pr.id)}">
  <p class="p-head">${verb} in ${target}</p>
  ${pr.edit.type !== 'insert' ? `<p class="diff del">${prose(pr.edit.anchor)}</p>` : ''}
  ${pr.edit.type !== 'delete' ? `<p class="diff add">${prose(pr.edit.content)}</p>` : ''}
  <p class="p-why">${prose(pr.rationale)}</p>
  <div class="p-actions"><button type="button" class="p-btn" data-decision="accept" aria-pressed="false">Accept</button><button type="button" class="p-btn" data-decision="decline" aria-pressed="false">Decline</button></div>
</div>`);
  }
  parts.push(`<div class="general">
  <label for="general-note">Anything else for the editor?</label>
  <textarea id="general-note" rows="2" placeholder="Too much on X this week; more on Y; a group I should be watching..."></textarea>
  <button type="button" class="fb-save" id="general-save">Send to tomorrow's run</button>
</div>`);
  return `<section class="notes" aria-labelledby="notes-h"><h2 id="notes-h" class="section-label">Notes from the editor</h2>${parts.join('')}<p class="fb-status" id="fb-status" role="status"></p></section>`;
}

const STYLE = `
/* Layout: one reading column (≤ 66ch) on paper; papers separated by
   hairlines, figures set as plates; the editor's notes as a quiet coda. */
:root {
  --bg: #fafaf7; --surface: #f4f1ea; --surface-2: #ede6d5; --ink: #1a1a1a;
  --mute: #6b6862; --hairline: #d8d4ca; --accent: #b31b1b; --ok: #2f7d4f;
  --serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141211; --surface: #1f1c1a; --surface-2: #2a2520; --ink: #e8e4dc;
  --mute: #9a948a; --hairline: #34302b; --accent: #e05a52; --ok: #6cc08b; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #141211; --surface: #1f1c1a; --surface-2: #2a2520; --ink: #e8e4dc;
  --mute: #9a948a; --hairline: #34302b; --accent: #e05a52; --ok: #6cc08b; color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font: 18px/1.62 var(--serif);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.issue { max-width: 66ch; margin: 0 auto; padding-block: 40px 72px; }
a { color: inherit; text-decoration-color: var(--hairline); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.tex { font-family: var(--mono); font-size: 0.86em; }
.masthead { border-bottom: 1px solid var(--ink); padding-bottom: 20px; margin-bottom: 28px; }
.mast-line { font: 600 13px/1.4 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; margin: 0;
  display: flex; flex-wrap: wrap; gap: 4px 14px; justify-content: space-between; }
.mast-line .brand { color: var(--accent); }
.headline { font: 600 clamp(30px, 6vw, 44px)/1.12 var(--serif); letter-spacing: -0.015em; text-wrap: balance; margin: 18px 0 14px; }
.counts { font: 13px/1.5 var(--mono); color: var(--mute); margin: 0; font-variant-numeric: tabular-nums; }
.lede p:first-child::first-letter { font-weight: 600; }
.read-first { margin: 28px 0 8px; padding: 16px 18px; background: var(--surface); border-radius: 3px; }
.read-first .label, .section-label, .theme-label, .facts dt, .why h4, .result h4 {
  font: 600 12px/1.3 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--mute); margin: 0 0 6px; }
.read-first .label { color: var(--accent); }
.read-first p { margin: 0; }
.read-first .rf-title { font: 600 19px/1.35 var(--sans); margin-bottom: 6px; }
.theme { margin-top: 56px; }
.theme-label { color: var(--accent); }
.theme-title { font: 600 26px/1.25 var(--sans); letter-spacing: -0.01em; text-wrap: balance; margin: 0 0 10px; }
.theme-arg { color: var(--ink); }
.paper { border-top: 1px solid var(--hairline); padding-top: 22px; margin-top: 26px; }
.tier { display: flex; gap: 12px; align-items: baseline; font: 500 12px/1.3 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px; color: var(--mute); }
.tier-read span:first-child { color: var(--accent); font-weight: 600; }
.tier .score { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--ink); }
.paper-title { font: 600 21px/1.3 var(--sans); letter-spacing: -0.005em; margin: 0 0 6px; text-wrap: balance; }
.paper-skim .paper-title, .paper-radar .paper-title { font-size: 18px; }
.byline { font: 14px/1.5 var(--sans); color: var(--mute); margin: 0 0 14px; }
.arxiv-id, .cats { font-family: var(--mono); font-size: 12.5px; margin-left: 6px; white-space: nowrap; }
.pitch { font-style: italic; color: var(--mute); }
.because { font: 14px/1.5 var(--sans); background: var(--surface-2); border-radius: 3px; padding: 6px 10px; }
.why h4, .result h4 { margin-top: 18px; }
.why p, .result p { margin: 0 0 10px; }
.quote { margin: 8px 0 0; padding: 2px 0 2px 16px; border-left: 2px solid var(--hairline); color: var(--mute); font-size: 16px; }
.quote p { margin: 0 0 4px; }
.quote footer { font: 12px/1.4 var(--sans); }
.verified { color: var(--ok); }
.facts { display: grid; gap: 10px; margin: 16px 0; }
.facts div { display: grid; grid-template-columns: 6.5em 1fr; gap: 12px; align-items: baseline; }
.facts dt { margin: 0; }
.facts dd { margin: 0; font-size: 16px; min-width: 0; }
.plate { margin: 16px 0 18px; background: var(--surface); padding: 14px; border-radius: 3px; }
.plate img { display: block; margin: 0 auto; max-height: 420px; width: auto; max-width: 100%; background: #fff; border-radius: 2px; }
.plate figcaption { font: 13.5px/1.5 var(--sans); color: var(--mute); margin-top: 10px; }
.plate-label { font-weight: 600; color: var(--ink); }
.figure-link { font: 14px/1.5 var(--sans); color: var(--mute); background: var(--surface); padding: 10px 12px; border-radius: 3px; }
.figure-link a { font-weight: 600; color: var(--ink); margin-right: 6px; }
.links { display: flex; flex-wrap: wrap; gap: 6px 16px; font: 500 14px/1.4 var(--sans); margin: 14px 0 10px; }
.fb { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
.fb-btn, .q-opt, .p-btn, .fb-save, .fb-ask-go { font: 500 13px/1 var(--sans); color: var(--ink); background: transparent;
  border: 1px solid var(--hairline); border-radius: 999px; padding: 8px 12px; min-height: 34px; cursor: pointer; }
.fb-btn:hover, .q-opt:hover, .p-btn:hover, .fb-save:hover { border-color: var(--mute); }
.fb-btn[aria-pressed="true"], .q-opt[aria-pressed="true"], .p-btn[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.fb-btn[data-act="star"][aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.fb-comment, .fb-ask { flex-basis: 100%; display: grid; gap: 8px; }
.fb-comment[hidden], .fb-ask[hidden] { display: none; }
textarea, input[type="text"] { font: 15px/1.5 var(--sans); color: var(--ink); background: var(--surface); border: 1px solid var(--hairline);
  border-radius: 3px; padding: 8px 10px; width: 100%; box-sizing: border-box; }
.fb-save, .fb-ask-go { justify-self: start; }
.fb-answer { font: 15px/1.55 var(--sans); white-space: pre-wrap; }
.fb-saved { font: 12px/1 var(--sans); color: var(--ok); }
.near { margin-top: 56px; }
.near ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.near li { font: 15px/1.5 var(--sans); display: grid; grid-template-columns: 9.5em 1fr; gap: 12px; }
.near .arxiv-id { margin: 0; }
.notes { margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--ink); }
.learned, .q-text, .p-head, .p-why { margin: 0 0 10px; }
.question, .proposal, .general { margin: 18px 0; display: grid; gap: 8px; }
.q-options, .p-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.p-head { font: 600 13px/1.3 var(--sans); text-transform: uppercase; letter-spacing: 0.06em; color: var(--mute); }
.diff { margin: 0; padding: 6px 10px; border-radius: 3px; font-size: 16px; }
.diff.del { background: var(--surface); text-decoration: line-through; color: var(--mute); }
.diff.add { background: var(--surface-2); }
.p-why { font: 14px/1.5 var(--sans); color: var(--mute); }
.general label { font: 600 14px/1.4 var(--sans); }
.fb-status { font: 13px/1.5 var(--sans); color: var(--mute); }
.colophon { margin-top: 56px; font: 13px/1.6 var(--sans); color: var(--mute); border-top: 1px solid var(--hairline); padding-top: 14px; }
.colophon p { margin: 0 0 6px; }
@media (max-width: 520px) {
  body { font-size: 17px; }
  .facts div, .near li { grid-template-columns: 1fr; gap: 2px; }
  .theme-title { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`;

// Page script: feedback through the `db` capability, questions through
// `sample`. Everything degrades to a read-only page when neither exists.
const SCRIPT = `
(() => {
  const DATA = JSON.parse(document.getElementById('aparture-data').textContent);
  const statusEl = document.getElementById('fb-status');
  const docs = new Map();
  let col = null;
  const say = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const key = (kind, k) => DATA.date + '__' + kind + '__' + k;

  function paint() {
    document.querySelectorAll('.fb[data-paper]').forEach((row) => {
      const d = docs.get(key('paper', row.dataset.paper)) || {};
      row.querySelector('[data-act="star"]').setAttribute('aria-pressed', String(!!d.star));
      row.querySelector('[data-act="star"] span').textContent = d.star ? '★' : '☆';
      row.querySelector('[data-act="dismiss"]').setAttribute('aria-pressed', String(!!d.dismiss));
      row.querySelector('[data-act="knew"]').setAttribute('aria-pressed', String(!!d.knew));
      const ta = row.querySelector('textarea');
      if (d.comment && document.activeElement !== ta && !ta.value) ta.value = d.comment;
    });
    document.querySelectorAll('.question').forEach((q) => {
      const d = docs.get(key('answer', q.dataset.question)) || {};
      q.querySelectorAll('.q-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.answer === d.answer)));
    });
    document.querySelectorAll('.proposal').forEach((p) => {
      const d = docs.get(key('proposal', p.dataset.proposal)) || {};
      p.querySelectorAll('.p-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.decision === d.decision)));
    });
    const g = docs.get(key('general', 'note'));
    const gta = document.getElementById('general-note');
    if (g && g.comment && gta && !gta.value && document.activeElement !== gta) gta.value = g.comment;
  }

  async function write(kind, k, patch) {
    const id = key(kind, k);
    const body = Object.assign({}, docs.get(id) || {}, patch, { date: DATA.date, kind, key: k, updatedAt: new Date().toISOString() });
    docs.set(id, body);
    paint();
    if (!col) { say('Feedback works when this page is opened in Claude.'); return; }
    try { await col.doc(id).set(body); say('Saved. Tomorrow\\'s run will read it.'); }
    catch (e) { say(e && e.code === 'quota_exceeded' ? 'Feedback storage is full; tell Aparture in chat instead.' : 'Could not save just now. Try again in a moment.'); }
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const row = btn.closest('.fb[data-paper]');
    if (row && btn.dataset.act) {
      const id = row.dataset.paper;
      const cur = docs.get(key('paper', id)) || {};
      const act = btn.dataset.act;
      if (act === 'star') write('paper', id, { id, star: !cur.star, dismiss: cur.star ? cur.dismiss : false });
      else if (act === 'dismiss') write('paper', id, { id, dismiss: !cur.dismiss, star: cur.dismiss ? cur.star : false });
      else if (act === 'knew') write('paper', id, { id, knew: !cur.knew });
      else if (act === 'comment' || act === 'ask') {
        const panel = row.querySelector(act === 'comment' ? '.fb-comment' : '.fb-ask');
        panel.hidden = !panel.hidden;
        btn.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) panel.querySelector('textarea, input').focus();
      }
      return;
    }
    if (btn.classList.contains('fb-save') && row) {
      const text = row.querySelector('textarea').value.trim();
      write('paper', row.dataset.paper, { id: row.dataset.paper, comment: text });
      return;
    }
    if (btn.id === 'general-save') {
      write('general', 'note', { comment: document.getElementById('general-note').value.trim() });
      return;
    }
    const q = btn.closest('.question');
    if (q && btn.dataset.answer) { write('answer', q.dataset.question, { question: q.dataset.question, answer: btn.dataset.answer }); return; }
    const p = btn.closest('.proposal');
    if (p && btn.dataset.decision) { write('proposal', p.dataset.proposal, { proposal: p.dataset.proposal, decision: btn.dataset.decision }); return; }
    if (btn.classList.contains('fb-ask-go')) ask(btn.closest('.fb'));
  });

  let sample = null;
  async function ask(row) {
    const input = row.querySelector('.fb-ask input');
    const out = row.querySelector('.fb-answer');
    const question = input.value.trim();
    if (!question || !sample) return;
    const ctx = DATA.context[row.dataset.paper];
    out.textContent = 'Thinking…';
    const prompt = 'You are answering a researcher\\'s question about one arXiv paper, using only the report below (written from the full paper). ' +
      'If the report does not cover the question, say so plainly and suggest which section of the paper to read. Answer in at most 150 words, no preamble.\\n\\n' +
      'Reader\\'s research profile (for context):\\n' + DATA.profileExcerpt + '\\n\\nPaper: ' + ctx.title + ' (arXiv:' + row.dataset.paper + ')\\n\\nReport:\\n' + ctx.report + '\\n\\nQuestion: ' + question;
    try {
      const res = await sample(prompt, { onText: ({ text }) => { out.textContent = text; } });
      out.textContent = res.text;
    } catch (e) {
      out.textContent = e && e.code === 'rate_limited' ? 'Too many questions at once; try again in a minute.' : 'Asking is not available here.';
    }
  }

  async function boot() {
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') { say('This copy is read-only. Open it in Claude to leave feedback.'); return; }
    const [db, smp] = await Promise.all([claude.use('db'), claude.use('sample')]);
    if (smp) { sample = smp; document.querySelectorAll('.needs-sample').forEach((b) => { b.hidden = false; }); }
    if (!db) { say('Sign in to Claude to leave feedback on this briefing.'); return; }
    col = db.collection('feedback');
    col.where('date', '==', DATA.date).onSnapshot((snap) => {
      snap.docs.forEach((d) => { if (d.exists) docs.set(d.id, d.data()); });
      paint();
    }, () => say('Feedback is unavailable right now; your choices on this page are not being saved.'));
    say('Your stars, comments and answers save here and shape tomorrow\\'s briefing.');
  }
  boot();
})();
`;

/**
 * @param {Object} b  a validated v2 briefing
 * @param {Object} ctx
 * @param {Map<string,Object>} ctx.meta        id -> {links, categories}
 * @param {Map<string,Map<string,Object>>} ctx.figures id -> figureId -> {label, dataUri}
 * @param {Map<string,string>} ctx.licenses    id -> license line
 * @param {Set<string>} ctx.quoteChecked       ids whose result.quote matched the text
 * @param {Map<string,{title:string, report:string}>} ctx.context  per-paper text for "ask"
 * @param {Object} ctx.stats                   {harvested, yes, maybe, read, categories, audit, quotesChecked, citationsChecked, model}
 * @param {string} [ctx.profileExcerpt]
 * @param {boolean} [ctx.standalone]           wrap in a full HTML document for local viewing
 */
export function renderBriefingHtml(b, ctx) {
  const byId = new Map(b.papers.map((p) => [p.id, p]));
  const placed = new Set();
  const themes = b.themes
    .map((t) => {
      const papers = t.paperIds
        .filter((id) => byId.has(id) && !placed.has(id))
        .map((id) => {
          placed.add(id);
          return byId.get(id);
        })
        .sort(
          (a, z) =>
            ['read', 'skim', 'radar'].indexOf(a.tier) - ['read', 'skim', 'radar'].indexOf(z.tier)
        );
      return `<section class="theme"><p class="theme-label">Theme</p><h2 class="theme-title">${prose(t.title)}</h2><div class="theme-arg">${paragraphs(t.argument)}</div>${papers.map((p) => paperBlock(p, ctx)).join('')}</section>`;
    })
    .join('');

  const rf = byId.get(b.readFirst.id);
  const s = ctx.stats ?? {};
  const minutes = b.papers.reduce(
    (m, p) => m + (p.tier === 'read' ? 4 : p.tier === 'skim' ? 2 : 1),
    3
  );
  const near = b.nearMisses.length
    ? `<section class="near" aria-labelledby="near-h"><h2 id="near-h" class="section-label">Also worth a look</h2><ul>${b.nearMisses
        .map(
          (n) =>
            `<li><a class="arxiv-id" href="https://arxiv.org/abs/${esc(n.id)}" target="_blank" rel="noopener">arXiv:${esc(n.id)}</a><span>${prose(n.line)}</span></li>`
        )
        .join('')}</ul></section>`
    : '';

  const data = {
    date: b.date,
    profileExcerpt: ctx.profileExcerpt ?? '',
    context: Object.fromEntries(ctx.context ?? []),
  };
  const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');

  const body = `<title>Aparture Briefing</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>${STYLE}</style>
<main class="issue">
<header class="masthead">
  <p class="mast-line"><span class="brand">Aparture</span><span>${esc(longDate(b.date))}</span></p>
  <h1 class="headline">${prose(b.headline)}</h1>
  <p class="counts">${[
    s.harvested != null ? `${s.harvested.toLocaleString('en-US')} papers screened` : null,
    s.yes != null ? `${(s.yes + (s.maybe ?? 0)).toLocaleString('en-US')} kept by triage` : null,
    `${b.papers.length} read in full`,
    `about ${minutes} min`,
  ]
    .filter(Boolean)
    .join(' · ')}</p>
</header>
<div class="lede">${paragraphs(b.lede)}</div>
${rf ? `<aside class="read-first"><p class="label">If you read one paper today</p><p class="rf-title"><a href="#p-${esc(rf.id)}">${prose(rf.title)}</a></p><p>${prose(b.readFirst.why)}</p></aside>` : ''}
${themes}
${near}
${notesBlock(b)}
<footer class="colophon">
  <p>${[
    s.citationsChecked != null
      ? `${s.citationsChecked} citations checked against today's harvest`
      : null,
    s.quotesChecked != null
      ? `${s.quotesChecked} of ${b.papers.length} key results matched verbatim to the paper text`
      : null,
    s.audit ? `claim audit: ${esc(s.audit)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')}.</p>
  <p>Written by Aparture${s.model ? ` with ${esc(s.model)}` : ''} from arXiv's listings for ${esc((s.categories ?? []).length || 'your')} categories. Figures are the authors', reproduced under each paper's arXiv license.</p>
</footer>
</main>
<script type="application/json" id="aparture-data">${dataJson}</script>
<script>${SCRIPT}</script>`;

  if (!ctx.standalone) return body;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${body}</body></html>`;
}
