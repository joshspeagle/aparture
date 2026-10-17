#!/usr/bin/env node
// Headless Aparture runner. Runs pipeline steps from Node without the web
// app, reusing lib/ and the API route handlers in-process. Used by the
// agent skill (.claude/skills/aparture) and usable from cron/launchd.
//
//   node bin/aparture.mjs fetch --categories stat.ML,astro-ph.GA --days 1 --out run/candidates.json
//   node bin/aparture.mjs help
//
// Every command writes JSON to --out (or stdout) and logs progress to stderr,
// so stdout stays machine-readable.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// stdout carries only command output. Route handlers log with console.log,
// so send those lines to stderr with the rest of the progress log.
console.log = (...args) => console.error(...args);

// lib/ is ESM without "type": "module" in package.json (postcss and
// tailwind configs are CommonJS), so Node detects the syntax per file and
// warns once per file. The warning is noise here.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...rest) => {
  const code = typeof rest[0] === 'object' ? rest[0]?.code : rest[1];
  if (code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
  emitWarning(warning, ...rest);
};

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) {
      flags[arg.slice(2)] = rest[++i];
    } else {
      flags[arg.slice(2)] = true;
    }
  }
  return { command, flags };
}

const log = (...args) => console.error('[aparture]', ...args);

function readJson(file, fallback) {
  if (!file || !fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeOut(file, data) {
  const text = typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`;
  if (!file) {
    process.stdout.write(text);
    return;
  }
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, text);
  log(`wrote ${file}`);
}

function list(value) {
  if (!value || value === true) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function paperLinks(id) {
  return {
    abs: `https://arxiv.org/abs/${id}`,
    pdf: `https://arxiv.org/pdf/${id}`,
    html: `https://arxiv.org/html/${id}`,
    alphaxiv: `https://www.alphaxiv.org/abs/${id}`,
  };
}

// --- fetch -----------------------------------------------------------------

async function cmdFetch(flags) {
  const { ensureDomParser, headlessPassword, createArxivFetch } = await import(
    '../lib/headless/runtime.js'
  );
  const { buildHarvestWindow } = await import('../lib/arxiv/window.js');
  const { harvest } = await import('../lib/arxiv/ingest.js');
  const { harvestOai } = await import('../lib/arxiv/harvestOai.js');
  const { fetchAtom } = await import('../lib/arxiv/fetchAtom.js');
  const { applyDedupe } = await import('../lib/analyzer/applyDedupe.js');

  await ensureDomParser();
  const password = headlessPassword();
  const routeFetch = await createArxivFetch();

  const config = readJson(flags.config, {});
  // The skill's config.json says `categories`; the app's config says
  // `selectedCategories`. Accept either.
  config.selectedCategories ??= config.categories;
  if (flags.categories) config.selectedCategories = list(flags.categories);
  if (flags.days) config.daysBack = Number(flags.days);
  if (flags.semantics) config.arxivWindowSemantics = flags.semantics;
  // The localStorage cache doesn't exist under Node.
  config.arxivCacheTtlMinutes = 0;
  if (!config.selectedCategories?.length) {
    throw new Error('fetch: pass --categories a,b,c or --config <file> with selectedCategories');
  }

  const now = flags.now ? new Date(flags.now) : new Date();
  const window = buildHarvestWindow(config, now);
  log(
    `harvesting ${window.selectedSubcategories.length} categories, ` +
      `OAI window ${window.from}..${window.until}, ${window.targetDaysBack} day(s) of content`
  );

  const result = await harvest(window, {
    password,
    abortSignal: { aborted: false },
    statusCallback: (msg) => log(msg),
    harvestOaiImpl: (args) => harvestOai({ ...args, fetchImpl: routeFetch }),
    fetchAtomImpl: (args) => fetchAtom({ ...args, fetchImpl: routeFetch }),
  });

  const seenIndex = readJson(flags.seen, {});
  const keepDuplicates = flags['keep-duplicates'] === true;
  const dedupe = applyDedupe(result.papers, seenIndex, !keepDuplicates);

  const perCategory = {};
  for (const p of dedupe.kept) {
    perCategory[p.fetchedCategory] = (perCategory[p.fetchedCategory] ?? 0) + 1;
  }
  const v1Dates = [...new Set(dedupe.kept.map((p) => p.published))].sort();

  const out = {
    generatedAt: new Date().toISOString(),
    window,
    modeUsed: result.modeUsed,
    v1Dates,
    counts: {
      harvested: result.papers.length,
      duplicates: dedupe.matched,
      kept: dedupe.kept.length,
    },
    perCategory,
    fillups: result.fillups,
    papers: dedupe.kept.map((p) => ({ ...p, links: paperLinks(p.id) })),
  };
  log(
    `${out.counts.kept} papers (v1 ${v1Dates[0] ?? '-'}..${v1Dates.at(-1) ?? '-'}; ` +
      `${out.counts.duplicates} duplicates removed; mode ${result.modeUsed})`
  );
  writeOut(flags.out, out);

  // Optional: numbered plain-text chunks for parallel reading (one file per
  // chunk), so triage workers each get an even slice.
  if (flags.chunks) {
    const n = Math.max(1, Number(flags.chunks));
    const dir = flags['chunk-dir'] ?? path.join(path.dirname(flags.out ?? '.'), 'chunks');
    fs.mkdirSync(dir, { recursive: true });
    const size = Math.ceil(out.papers.length / n);
    for (let c = 0; c < n; c++) {
      const slice = out.papers.slice(c * size, (c + 1) * size);
      if (slice.length === 0) continue;
      const text = slice
        .map(
          (p) =>
            `## ${p.id}\n${p.title}\n[${p.categories.join(', ')}] ` +
            `${p.authors.slice(0, 4).join(', ')}${p.authors.length > 4 ? ' et al.' : ''}\n\n${p.abstract}\n`
        )
        .join('\n');
      fs.writeFileSync(path.join(dir, `chunk-${String(c + 1).padStart(2, '0')}.md`), text);
    }
    log(`wrote ${n} chunk(s) to ${dir}`);
  }
}

// --- enrich ----------------------------------------------------------------

const ARXIV_HEADERS = () => ({
  'User-Agent': 'Aparture/1.0 (arXiv paper discovery tool)',
  ...(process.env.ARXIV_CONTACT_EMAIL ? { From: process.env.ARXIV_CONTACT_EMAIL } : {}),
});

// Plain text from a PDF via poppler's pdftotext when it is installed, so
// quotes from PDF-only papers can still be checked. Returns null otherwise.
function pdfToText(pdfPath) {
  try {
    const out = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', pdfPath, '-'], {
      timeout: 60_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const text = out
      .toString('utf8')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    return text.length > 500 ? text : null;
  } catch {
    return null;
  }
}

// arxiv.org asks crawlers for 15 s between requests (robots.txt). Tests and
// one-off debugging can pass --spacing-ms to shorten it.
function pageSpacing(flags, defaultSpacing) {
  if (flags['spacing-ms'] === undefined) return defaultSpacing;
  const ms = Number(flags['spacing-ms']);
  return () => ms;
}

function paperMarkdown(meta, parsed, { withAppendix }) {
  const lines = [
    `# ${meta.title}`,
    '',
    `arXiv: ${meta.id} · v1 ${meta.published} · ${meta.categories.join(', ')}`,
    `Authors: ${meta.authors.join(', ')}`,
  ];
  if (parsed?.license) lines.push(`License: ${parsed.license}`);
  lines.push('', '## Abstract', '', meta.abstract, '');
  if (parsed?.ok) {
    if (parsed.figures.length) {
      lines.push('## Figures', '');
      for (const f of parsed.figures) {
        lines.push(`- ${f.label ?? f.id}: ${f.caption}${f.inlineSvg ? ' (vector figure)' : ''}`);
      }
      lines.push('');
    }
    if (parsed.tables.length) {
      lines.push('## Tables', '');
      for (const t of parsed.tables) lines.push(`- ${t.label ?? t.id}: ${t.caption}`);
      lines.push('');
    }
    for (const s of parsed.sections) {
      if (s.appendix && !withAppendix) continue;
      lines.push(`## ${s.heading}`, '', s.text, '');
    }
    const skipped = parsed.sections.filter((s) => s.appendix && !withAppendix);
    if (skipped.length) {
      lines.push(`(Appendices omitted: ${skipped.map((s) => s.heading).join('; ')})`, '');
    }
  }
  return lines.join('\n');
}

async function cmdEnrich(flags) {
  const { ensureDomParser } = await import('../lib/headless/runtime.js');
  const { parseArxivHtml } = await import('../lib/arxiv/html.js');
  const { arxivPageSpacingMs, arxivSleep } = await import('../lib/arxiv/spacing.js');
  await ensureDomParser();
  const spacing = pageSpacing(flags, arxivPageSpacingMs);

  const candidates = readJson(flags.in, null);
  if (!candidates?.papers) throw new Error('enrich: --in <candidates.json> is required');
  const ids = flags['ids-file']
    ? list(fs.readFileSync(flags['ids-file'], 'utf8').replace(/\s+/g, ','))
    : list(flags.ids);
  if (ids.length === 0) throw new Error('enrich: pass --ids a,b,c or --ids-file <file>');
  const outDir = flags['out-dir'] ?? 'enriched';
  const figureCount = flags.figures ? Number(flags.figures) : 0;
  const withAppendix = flags['with-appendix'] === true;
  fs.mkdirSync(outDir, { recursive: true });

  const byId = new Map(candidates.papers.map((p) => [p.id, p]));
  const summary = [];
  let first = true;
  const politely = async () => {
    if (!first) await arxivSleep(spacing());
    first = false;
  };

  for (const id of ids) {
    const meta = byId.get(id);
    if (!meta) {
      log(`${id}: not in candidates, skipped`);
      summary.push({ id, ok: false, reason: 'not in candidates' });
      continue;
    }
    await politely();
    let parsed = null;
    try {
      const res = await fetch(meta.links.html, {
        headers: ARXIV_HEADERS(),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) parsed = parseArxivHtml(await res.text(), { id, url: res.url });
      else parsed = { ok: false, reason: `HTML ${res.status}` };
    } catch (err) {
      parsed = { ok: false, reason: err.message };
    }

    let pdfPath = null;
    let pdfText = null;
    if (!parsed.ok) {
      // No HTML rendering: keep the PDF so a reader can open it directly.
      await politely();
      try {
        const res = await fetch(meta.links.pdf, {
          headers: ARXIV_HEADERS(),
          signal: AbortSignal.timeout(90_000),
        });
        const buf = Buffer.from(await res.arrayBuffer());
        if (res.ok && buf.subarray(0, 5).toString() === '%PDF-') {
          pdfPath = path.join(outDir, `${id}.pdf`);
          fs.writeFileSync(pdfPath, buf);
          pdfText = pdfToText(pdfPath);
        }
      } catch (err) {
        log(`${id}: PDF fallback failed: ${err.message}`);
      }
    }

    const figureFiles = [];
    if (parsed.ok && figureCount > 0) {
      const figDir = path.join(outDir, 'figures', id);
      for (const fig of parsed.figures.filter((f) => f.images.length).slice(0, figureCount)) {
        const src = fig.images[0];
        await politely();
        try {
          const res = await fetch(src, {
            headers: ARXIV_HEADERS(),
            signal: AbortSignal.timeout(60_000),
          });
          if (!res.ok) continue;
          fs.mkdirSync(figDir, { recursive: true });
          const file = path.join(
            figDir,
            `${fig.id}${path.extname(new URL(src).pathname) || '.png'}`
          );
          fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
          figureFiles.push({ id: fig.id, label: fig.label, file, src });
        } catch (err) {
          log(`${id}: figure ${fig.id} failed: ${err.message}`);
        }
      }
    }

    const record = {
      id,
      htmlAvailable: parsed.ok,
      reason: parsed.ok ? null : parsed.reason,
      license: parsed.ok ? parsed.license : null,
      wordCount: parsed.ok ? parsed.wordCount : null,
      figures: parsed.ok ? parsed.figures : [],
      tables: parsed.ok ? parsed.tables : [],
      figureFiles,
      pdfPath,
      textPath: path.join(outDir, `${id}.md`),
      links: meta.links,
    };
    record.textSource = parsed.ok ? 'html' : pdfText ? 'pdf' : 'abstract';
    fs.writeFileSync(
      record.textPath,
      paperMarkdown(meta, parsed, { withAppendix }) +
        (pdfText ? `\n## Full text (extracted from PDF)\n\n${pdfText}\n` : '')
    );
    fs.writeFileSync(path.join(outDir, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
    log(
      `${id}: ${parsed.ok ? `HTML ${record.wordCount} words, ${record.figures.length} figures` : `no HTML (${parsed.reason})${pdfPath ? ', PDF saved' : ''}`}`
    );
    summary.push({
      id,
      ok: parsed.ok || Boolean(pdfPath),
      htmlAvailable: parsed.ok,
      figures: record.figures.length,
      figureFiles: figureFiles.length,
      textPath: record.textPath,
      pdfPath,
    });
  }
  writeOut(flags.out, { generatedAt: new Date().toISOString(), outDir, papers: summary });
}

// --- validate --------------------------------------------------------------

function readJsonl(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function readText(file) {
  return file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function triagedPapers(runDir) {
  const dir = path.join(runDir, 'triage');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => readJson(path.join(dir, f), { papers: [] }).papers ?? []);
}

// References a briefing may cite in `becauseRefs`: the arXiv id of any
// feedback event, and "comment <date>" / "answer <qid> <date>" handles.
export function feedbackRefSet(events) {
  const refs = new Set();
  for (const e of events) {
    if (e.id) refs.add(e.id);
    if (e.type === 'comment' && e.date) refs.add(`comment ${e.date}`);
    if (e.type === 'answer' && e.question && e.date) refs.add(`answer ${e.question} ${e.date}`);
  }
  return refs;
}

async function cmdValidate(flags) {
  const { validateBriefingV2 } = await import('../lib/briefing/v2/validate.js');
  const runDir = flags.run;
  const stateDir = flags.state ?? path.resolve(runDir, '..', '..');
  if (!runDir) throw new Error('validate: --run <run dir> is required');

  const briefing = readJson(flags.briefing ?? path.join(runDir, 'briefing.json'), null);
  if (!briefing) throw new Error('validate: no briefing.json in the run directory');
  const candidates = readJson(path.join(runDir, 'candidates.json'), { papers: [] });
  const selection = readJson(path.join(runDir, 'selection.json'), { read: [] });
  const triaged = triagedPapers(runDir);

  const papersDir = path.join(runDir, 'papers');
  const paperText = new Map();
  const figureIds = new Map();
  for (const { id } of selection.read) {
    const text = readText(path.join(papersDir, `${id}.md`));
    if (text) paperText.set(id, text);
    const rec = readJson(path.join(papersDir, `${id}.json`), null);
    figureIds.set(id, new Set((rec?.figures ?? []).map((f) => f.id)));
  }

  const result = validateBriefingV2(briefing, {
    readIds: new Set(selection.read.map((r) => r.id)),
    nearMissPool: new Set(
      triaged.filter((t) => t.verdict === 'YES' || t.verdict === 'MAYBE').map((t) => t.id)
    ),
    titles: new Map(candidates.papers.map((p) => [p.id, p.title])),
    paperText,
    figureIds,
    feedbackRefs: feedbackRefSet(readJsonl(path.join(stateDir, 'feedback.jsonl'))),
    targets: {
      profile: readText(path.join(stateDir, 'profile.md')),
      learned: readText(path.join(stateDir, 'learned.md')),
    },
  });
  for (const e of result.errors) log(`error: ${e}`);
  for (const w of result.warnings) log(`warning: ${w}`);
  log(result.ok ? `valid: ${JSON.stringify(result.stats)}` : `${result.errors.length} error(s)`);
  writeOut(flags.out ?? path.join(runDir, 'validation.json'), {
    checkedAt: new Date().toISOString(),
    ...result,
  });
  if (!result.ok) process.exitCode = 1;
}

// --- render ----------------------------------------------------------------

const FIGURE_MAX_BYTES = 2_500_000;
const FIGURES_TOTAL_BYTES = 10_000_000;

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function cmdRender(flags) {
  const { renderBriefingHtml, figureReuseAllowed } = await import('../lib/briefing/v2/render.js');
  const { normalizeForQuote } = await import('../lib/briefing/v2/validate.js');
  const { arxivPageSpacingMs, arxivSleep } = await import('../lib/arxiv/spacing.js');
  const spacing = pageSpacing(flags, arxivPageSpacingMs);
  const runDir = flags.run;
  if (!runDir) throw new Error('render: --run <run dir> is required');
  const stateDir = flags.state ?? path.resolve(runDir, '..', '..');
  const briefing = readJson(path.join(runDir, 'briefing.json'), null);
  if (!briefing) throw new Error('render: no briefing.json in the run directory');
  const validation = readJson(path.join(runDir, 'validation.json'), null);
  if (validation && !validation.ok) {
    log('warning: rendering a briefing that failed validation (do not publish it)');
  }
  const candidates = readJson(path.join(runDir, 'candidates.json'), { papers: [] });
  const selection = readJson(path.join(runDir, 'selection.json'), {});
  const { readAuditRounds, summarizeAuditRounds } = await import(
    '../lib/briefing/v2/auditSummary.js'
  );
  const auditSummary = summarizeAuditRounds(readAuditRounds(runDir));
  const config = readJson(path.join(stateDir, 'config.json'), {});
  const papersDir = path.join(runDir, 'papers');
  const byId = new Map(candidates.papers.map((p) => [p.id, p]));

  const meta = new Map();
  const figures = new Map();
  const licenses = new Map();
  const quoteChecked = new Set();
  const context = new Map();
  let budget = FIGURES_TOTAL_BYTES;
  let fetched = 0;

  for (const p of briefing.papers) {
    const cand = byId.get(p.id);
    const rec = readJson(path.join(papersDir, `${p.id}.json`), null);
    const report = readJson(path.join(runDir, 'reports', `${p.id}.json`), null);
    const links = { ...(cand?.links ?? {}) };
    if (report?.code?.url) links.code = report.code.url;
    meta.set(p.id, { links, categories: cand?.categories ?? [] });
    if (rec?.license) licenses.set(p.id, rec.license);

    const text = readText(path.join(papersDir, `${p.id}.md`));
    if (text && normalizeForQuote(text).includes(normalizeForQuote(p.result.quote))) {
      quoteChecked.add(p.id);
    }
    if (report) {
      context.set(p.id, {
        title: p.title,
        report: [
          report.summary,
          `Key result: ${report.keyResult?.claim ?? ''}`,
          `Method: ${report.method ?? ''}`,
          `Limitations: ${report.limitations ?? ''}`,
        ]
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 9000),
      });
    }

    if (!p.figure || p.tier !== 'read' || !rec) continue;
    const fig = (rec.figures ?? []).find((f) => f.id === p.figure.id);
    if (!fig || fig.images.length === 0) continue;
    if (!figureReuseAllowed(rec.license)) {
      figures.set(p.id, new Map([[fig.id, { label: fig.label, linkOnly: true }]]));
      continue;
    }
    // Reuse a file from enrich or from an earlier render before asking
    // arXiv again; renders are often repeated while a briefing is revised.
    const cached = path.join(
      papersDir,
      'figures',
      p.id,
      `${fig.id}${path.extname(new URL(fig.images[0]).pathname) || '.png'}`
    );
    let file = rec.figureFiles?.find((f) => f.id === fig.id)?.file;
    if (!file || !fs.existsSync(file)) file = fs.existsSync(cached) ? cached : null;
    if (!file) {
      if (fetched > 0) await arxivSleep(spacing());
      fetched += 1;
      try {
        const res = await fetch(fig.images[0], {
          headers: ARXIV_HEADERS(),
          signal: AbortSignal.timeout(60_000),
        });
        if (res.ok) {
          fs.mkdirSync(path.dirname(cached), { recursive: true });
          file = cached;
          fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        }
      } catch (err) {
        log(`${p.id}: could not fetch ${fig.id}: ${err.message}`);
      }
    }
    if (!file || !fs.existsSync(file)) continue;
    const bytes = fs.statSync(file).size;
    if (bytes > FIGURE_MAX_BYTES || bytes > budget) {
      log(`${p.id}: ${fig.id} skipped (${Math.round(bytes / 1024)} KB over the page budget)`);
      continue;
    }
    budget -= bytes;
    const mime = MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'image/png';
    const dataUri = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    figures.set(p.id, new Map([[fig.id, { label: fig.label, dataUri }]]));
  }

  const html = renderBriefingHtml(briefing, {
    meta,
    figures,
    licenses,
    quoteChecked,
    context,
    profileExcerpt: readText(path.join(stateDir, 'profile.md')).slice(0, 1500),
    standalone: flags.standalone === true,
    stats: {
      harvested: selection.stats?.harvested ?? candidates.counts?.kept,
      yes: selection.stats?.yes,
      maybe: selection.stats?.maybe,
      categories: config.categories ?? candidates.window?.selectedSubcategories ?? [],
      citationsChecked: validation?.stats?.citationsChecked,
      quotesChecked: quoteChecked.size,
      audit: auditSummary,
      model: flags.model ?? null,
    },
  });
  const out = flags.out ?? path.join(runDir, 'briefing.html');
  writeOut(out, html);
  const figureList = [...figures.values()].flatMap((m) => [...m.values()]);
  const linked = figureList.filter((f) => f.linkOnly).length;
  log(
    `${Math.round(Buffer.byteLength(html) / 1024)} KB, ${figureList.length - linked} figure(s) inlined, ${linked} linked`
  );
}

// --- record ----------------------------------------------------------------

const SEEN_WINDOW_DAYS = 90;

async function cmdRecord(flags) {
  const runDir = flags.run;
  if (!runDir) throw new Error('record: --run <run dir> is required');
  const stateDir = flags.state ?? path.resolve(runDir, '..', '..');
  const candidates = readJson(path.join(runDir, 'candidates.json'), null);
  const briefing = readJson(path.join(runDir, 'briefing.json'), null);
  const validation = readJson(path.join(runDir, 'validation.json'), null);
  if (!candidates) throw new Error('record: no candidates.json in the run directory');
  const runDate = briefing?.date ?? path.basename(runDir);

  // seen.json: earliest date wins; prune to the rolling window.
  const seenPath = path.join(stateDir, 'seen.json');
  const seen = readJson(seenPath, {});
  let added = 0;
  for (const p of candidates.papers) {
    if (!seen[p.id] || seen[p.id] > runDate) {
      if (!seen[p.id]) added += 1;
      seen[p.id] = runDate;
    }
  }
  const cutoff = new Date(`${runDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - SEEN_WINDOW_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  let pruned = 0;
  for (const [id, date] of Object.entries(seen)) {
    if (!id.startsWith('_') && date < cutoffDate) {
      delete seen[id];
      pruned += 1;
    }
  }
  fs.writeFileSync(seenPath, `${JSON.stringify(seen, null, 0)}\n`);

  let archived = null;
  if (briefing) {
    if (validation && !validation.ok) {
      throw new Error('record: refusing to archive a briefing that failed validation');
    }
    const dir = path.join(stateDir, 'briefings');
    fs.mkdirSync(dir, { recursive: true });
    archived = path.join(dir, `${runDate}.json`);
    fs.writeFileSync(archived, `${JSON.stringify(briefing, null, 2)}\n`);
  }

  // Heavy run files (harvest dump, chunks, PDFs, figures) are only needed
  // while the run is live; keep the small triage/selection/report records.
  if (flags['prune-run'] === true) {
    for (const rel of ['candidates.json', 'chunks', 'papers/figures']) {
      fs.rmSync(path.join(runDir, rel), { recursive: true, force: true });
    }
    for (const f of fs.existsSync(path.join(runDir, 'papers'))
      ? fs.readdirSync(path.join(runDir, 'papers'))
      : []) {
      if (f.endsWith('.pdf')) fs.rmSync(path.join(runDir, 'papers', f));
    }
  }

  const summary = {
    date: runDate,
    harvested: candidates.counts?.harvested ?? candidates.papers.length,
    duplicatesRemoved: candidates.counts?.duplicates ?? 0,
    seenAdded: added,
    seenPruned: pruned,
    seenSize: Object.keys(seen).length,
    archived,
  };
  writeOut(flags.out ?? path.join(runDir, 'record.json'), summary);
}

// --- ingest ----------------------------------------------------------------

async function cmdIngest(flags) {
  const { docsToEvents } = await import('../lib/briefing/v2/feedbackDocs.js');
  const stateDir = flags.state;
  if (!stateDir || !flags.docs)
    throw new Error('ingest: --docs <file> and --state <dir> are required');
  const raw = readJson(flags.docs, []);
  // Accept a bare array or an ArtifactData-style {documents|docs|items: [...]} page.
  const list = Array.isArray(raw) ? raw : (raw.documents ?? raw.docs ?? raw.items ?? []);
  const docs = list.map((d) => ({ id: d.id ?? d.doc_id ?? d.path, data: d.data ?? d.body ?? d }));
  const cursorPath = path.join(stateDir, 'feedback-cursor.json');
  const { events, cursor } = docsToEvents(docs, readJson(cursorPath, {}));
  if (events.length) {
    fs.appendFileSync(
      path.join(stateDir, 'feedback.jsonl'),
      events.map((e) => JSON.stringify(e)).join('\n') + '\n'
    );
  }
  fs.writeFileSync(cursorPath, `${JSON.stringify(cursor, null, 2)}\n`);
  const byType = {};
  for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;
  log(`${events.length} new event(s) from ${docs.length} document(s)`);
  writeOut(flags.out, { appended: events.length, byType });
}

// --- dispatch --------------------------------------------------------------

const HELP = `aparture <command> [flags]

Commands:
  fetch     Harvest arXiv for the configured categories, drop papers already
            seen, and write candidates JSON.
            --categories a,b,c | --config <config.json>
            --days N            days of content (default 1)
            --semantics submitted-only|submitted-or-updated
            --seen <seen.json>  arxivId -> first-seen date; matches are dropped
            --keep-duplicates   keep matches instead of dropping them
            --out <file>        output JSON (default stdout)
            --chunks N          also write N plain-text chunks for parallel triage
            --chunk-dir <dir>   where chunks go (default <out dir>/chunks)
  enrich    Fetch arXiv HTML for chosen papers: readable text (math as
            LaTeX, bibliography dropped), figures with captions, license.
            Falls back to saving the PDF when there is no HTML version.
            --in <candidates.json>  output of fetch
            --ids a,b,c | --ids-file <file>
            --out-dir <dir>     per-paper <id>.md + <id>.json (default enriched/)
            --figures N         also download the first N figure images per paper
                                (default 0; render fetches only chosen figures)
            --spacing-ms N      gap between arxiv.org requests (default 15 s,
                                per arxiv.org/robots.txt)
            --with-appendix     keep appendix text (dropped by default)
            --out <file>        summary JSON (default stdout)
  validate  Check a run's briefing.json: schema, every cited id resolves to
            today's harvest, quotes appear verbatim in the paper text,
            figures and proposal anchors exist. Exit code 1 on failure.
            --run <run dir>     (reads candidates, triage/, selection,
                                papers/, briefing.json)
            --state <dir>       state dir (default: two levels above --run)
            --out <file>        default <run>/validation.json
  render    Render briefing.json as a self-contained HTML page with the
            figures inlined and feedback controls.
            --run <run dir> [--state <dir>] [--out <file>]
            --model <name>      the writing model, named in the colophon
            --standalone        a full HTML document that opens directly
                                in a browser (default: the page body only)
  record    Add harvested ids to seen.json (90-day window), archive the
            briefing into <state>/briefings/. Refuses a failed validation.
            --run <run dir> [--state <dir>] [--prune-run]
  ingest    Turn the briefing page's feedback documents into events in
            <state>/feedback.jsonl (idempotent via feedback-cursor.json).
            --docs <file>       JSON array of {id, data} from the page's db
            --state <dir>
  help      Show this message.
`;

const COMMANDS = {
  fetch: cmdFetch,
  enrich: cmdEnrich,
  validate: cmdValidate,
  render: cmdRender,
  record: cmdRecord,
  ingest: cmdIngest,
};

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command || command === 'help' || flags.help) {
    process.stdout.write(HELP);
    return;
  }
  const fn = COMMANDS[command];
  if (!fn) {
    process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
    process.exit(2);
  }
  await fn(flags);
}

main().catch((err) => {
  log(`error: ${err.message}`);
  process.exit(1);
});
