// Per-stage LLM cost estimation.
//
// Two jobs, one pricing source:
//   1. Projected spend BEFORE a stage runs (the review gates) — computed from
//      the average token constants below × paper count × registry pricing.
//   2. Actual spend AFTER a run — computed from the per-stage token usage the
//      API routes return (accumulated in the store's costTracking slice) ×
//      registry pricing.
//
// Pricing comes from MODEL_REGISTRY in utils/models.js (USD per million
// tokens, list price, snapshot-dated). A model with missing or null pricing
// makes the affected stage's cost null — callers hide the estimate rather
// than showing a guess.

import { MODEL_REGISTRY } from '../../utils/models.js';

// ---------------------------------------------------------------------------
// Average token constants (per paper unless noted).
//
// These are rough planning numbers, NOT measurements. They exist so a gate
// can say "about $0.40" instead of nothing; real usage varies with profile
// length, abstract length, batch size, and how verbose the model is. Each
// constant is derived by reading the actual prompt templates (prompts/
// rubric-*.md, synthesis.md, check-briefing.md, analyze-pdf-quick.md) and
// assuming typical arXiv content sizes (~1.5 kB abstracts, 10–25 page PDFs).
// Rule of thumb used throughout: 1 token ≈ 4 characters of English prose.
// ---------------------------------------------------------------------------

// Stage 2 filter: rubric-filter.md (~2.1 kB ≈ 520 tok) + profile (~500 tok)
// amortized over the default batch of 10 → ~100 tok/paper, plus title +
// abstract (~400 tok). Output is a verdict + one-sentence summary + short
// justification per paper.
export const FILTER_TOKENS_PER_PAPER = { input: 500, output: 100 };

// Stage 3 scoring: rubric-scoring.md (~3 kB ≈ 760 tok) + profile amortized
// over the default batch of 3 → ~400 tok/paper, plus abstract (~400 tok).
// Output is a 0–10 score + a paragraph of justification.
export const SCORING_TOKENS_PER_PAPER = { input: 800, output: 200 };

// Stage 3.5 rescoring: rubric-rescoring.md (~2.5 kB ≈ 620 tok) + profile
// amortized over the default batch of 5 → ~250 tok/paper, plus abstract +
// the initial score and justification being re-judged (~450 tok). Output is
// an adjusted score + reason + confidence.
export const POST_PROCESSING_TOKENS_PER_PAPER = { input: 700, output: 120 };

// Quick summaries (briefing grounding corpus): analyze-pdf-quick.md template
// (~350 tok) + the composed full report from deep analysis (summary, key
// findings, methodology, limitations ≈ 1,200–1,500 tok) + abstract. Output
// is a one-paragraph compression.
export const QUICK_SUMMARY_TOKENS_PER_PAPER = { input: 2000, output: 300 };

// Stage 4 PDF analysis: rubric-pdf.md (~900 tok) + profile, dwarfed by the
// PDF itself — providers bill PDF pages as text + page images, so a typical
// 10–25 page arXiv paper lands around 15k–45k input tokens. Output is the
// six-field structured analysis.
export const PDF_TOKENS_PER_PAPER = { input: 30000, output: 1500 };

// Stage 5 briefing (per run, scales with paper count). Covers the synthesis
// call AND the hallucination-audit call on the same model: each paper's
// corpus entry (abstract + full report + quick summary ≈ 2,500 tok) is read
// twice — once by synthesis.md, once by check-briefing.md — hence 5,000
// input tok/paper. The base covers both templates + profile + the finished
// briefing being re-read by the audit. Output is the briefing itself
// (~5–6k tok) + the audit verdict, with paper cards adding a little per paper.
export const BRIEFING_TOKENS = {
  inputBase: 8000,
  inputPerPaper: 5000,
  outputBase: 7000,
  outputPerPaper: 150,
};

// Uniform {inputBase, inputPerPaper, outputBase, outputPerPaper} view of the
// constants above, keyed by stage id. Stage ids match the costTracking slice.
export const STAGE_TOKENS = {
  filter: {
    inputBase: 0,
    inputPerPaper: FILTER_TOKENS_PER_PAPER.input,
    outputBase: 0,
    outputPerPaper: FILTER_TOKENS_PER_PAPER.output,
  },
  scoring: {
    inputBase: 0,
    inputPerPaper: SCORING_TOKENS_PER_PAPER.input,
    outputBase: 0,
    outputPerPaper: SCORING_TOKENS_PER_PAPER.output,
  },
  postProcessing: {
    inputBase: 0,
    inputPerPaper: POST_PROCESSING_TOKENS_PER_PAPER.input,
    outputBase: 0,
    outputPerPaper: POST_PROCESSING_TOKENS_PER_PAPER.output,
  },
  pdf: {
    inputBase: 0,
    inputPerPaper: PDF_TOKENS_PER_PAPER.input,
    outputBase: 0,
    outputPerPaper: PDF_TOKENS_PER_PAPER.output,
  },
  quickSummary: {
    inputBase: 0,
    inputPerPaper: QUICK_SUMMARY_TOKENS_PER_PAPER.input,
    outputBase: 0,
    outputPerPaper: QUICK_SUMMARY_TOKENS_PER_PAPER.output,
  },
  briefing: BRIEFING_TOKENS,
};

// Display labels for the per-stage breakdown. Pipeline order.
export const STAGE_LABELS = {
  filter: 'Filter',
  scoring: 'Scoring',
  postProcessing: 'Post-processing',
  pdf: 'PDF analysis',
  quickSummary: 'Quick summaries',
  briefing: 'Briefing',
};

const STAGE_ORDER = ['filter', 'scoring', 'postProcessing', 'pdf', 'quickSummary', 'briefing'];

// Registry pricing for a model id, or null when the model is unknown or its
// price was not verifiable at snapshot time (never guess).
function pricesFor(modelId) {
  const entry = MODEL_REGISTRY[modelId];
  if (!entry) return null;
  if (typeof entry.inputPerMTok !== 'number' || typeof entry.outputPerMTok !== 'number') {
    return null;
  }
  return {
    inputPerMTok: entry.inputPerMTok,
    outputPerMTok: entry.outputPerMTok,
    provider: entry.provider,
  };
}

/**
 * Projected cost of one stage over `paperCount` papers on `modelId`.
 *
 * @returns {{stage: string, model: string, papers: number, cost: number|null}}
 *   `cost` is null when the stage is unknown or the model has no registry
 *   pricing — callers should hide the estimate, never render "$null".
 */
export function estimateStageCost({ stage, paperCount, modelId }) {
  const rates = STAGE_TOKENS[stage];
  const prices = pricesFor(modelId);
  const papers = Number.isFinite(paperCount) && paperCount > 0 ? paperCount : 0;
  if (!rates || !prices || papers === 0) {
    return { stage, model: modelId, papers, cost: null };
  }
  const tokensIn = rates.inputBase + rates.inputPerPaper * papers;
  const tokensOut = rates.outputBase + rates.outputPerPaper * papers;
  const cost = (tokensIn / 1e6) * prices.inputPerMTok + (tokensOut / 1e6) * prices.outputPerMTok;
  return { stage, model: modelId, papers, cost };
}

// Stage id → the config model slot that actually drives it. Post-processing
// dispatches config.scoringModel (see /api/rescore-abstracts); quick summaries
// and the briefing fall back the same way briefingClient.js resolves them.
function modelForStage(stage, config = {}) {
  const briefingModel = config.briefingModel ?? config.pdfModel;
  switch (stage) {
    case 'filter':
      return config.filterModel;
    case 'scoring':
    case 'postProcessing':
      return config.scoringModel;
    case 'pdf':
      return config.pdfModel;
    case 'quickSummary':
      return config.quickSummaryModel ?? briefingModel;
    case 'briefing':
      return briefingModel;
    default:
      return undefined;
  }
}

/**
 * Projected cost of a set of stages, each over its own paper count, using
 * the config's per-stage model slots.
 *
 * @param {{counts: Object<string, number>, config: Object}} args
 *   `counts` maps stage ids to paper counts; stages absent or ≤ 0 are skipped.
 * @returns {{total: number|null, byStage: Array, hasUnknownPricing: boolean}}
 *   `total` sums the stages with known pricing; it is null when no included
 *   stage could be priced. A null-priced stage sets `hasUnknownPricing`.
 */
export function estimateRunCost({ counts = {}, config = {} }) {
  const byStage = [];
  let total = null;
  let hasUnknownPricing = false;
  for (const stage of STAGE_ORDER) {
    const papers = counts[stage];
    if (!Number.isFinite(papers) || papers <= 0) continue;
    const entry = estimateStageCost({
      stage,
      paperCount: papers,
      modelId: modelForStage(stage, config),
    });
    byStage.push(entry);
    if (entry.cost === null) {
      hasUnknownPricing = true;
    } else {
      total = (total ?? 0) + entry.cost;
    }
  }
  return { total, byStage, hasUnknownPricing };
}

/**
 * Actual cost from accumulated per-stage token usage (the store's
 * costTracking.byStage), priced at render time from the registry.
 *
 * Cache-read tokens: Anthropic reports them separately from input_tokens and
 * bills them at one-tenth the input rate, so they're added at 0.1×. OpenAI
 * already includes cached tokens inside prompt_tokens (billed at a discount
 * we don't model), so no add-on there — a mild over-estimate, which the
 * "estimated from token counts" label covers.
 *
 * @param {Object<string, {model: string, tokensIn: number, tokensOut: number,
 *                          cacheReadTok?: number}>} byStage
 * @returns {{total: number|null,
 *            byStage: Array<{stage, model, tokensIn, tokensOut, cost}>,
 *            hasUnknownPricing: boolean, hasUsage: boolean}}
 */
export function computeActualCost(byStage = {}) {
  const rows = [];
  let total = null;
  let hasUnknownPricing = false;
  let hasUsage = false;
  for (const stage of STAGE_ORDER) {
    const entry = byStage[stage];
    if (!entry) continue;
    const tokensIn = entry.tokensIn ?? 0;
    const tokensOut = entry.tokensOut ?? 0;
    const cacheReadTok = entry.cacheReadTok ?? 0;
    if (tokensIn + tokensOut + cacheReadTok === 0) continue;
    hasUsage = true;
    const prices = pricesFor(entry.model);
    let cost = null;
    if (prices) {
      cost = (tokensIn / 1e6) * prices.inputPerMTok + (tokensOut / 1e6) * prices.outputPerMTok;
      if (prices.provider === 'Anthropic' && cacheReadTok > 0) {
        cost += (cacheReadTok / 1e6) * prices.inputPerMTok * 0.1;
      }
      total = (total ?? 0) + cost;
    } else {
      hasUnknownPricing = true;
    }
    rows.push({ stage, model: entry.model, tokensIn, tokensOut, cost });
  }
  return { total, byStage: rows, hasUnknownPricing, hasUsage };
}

/**
 * Format a USD amount at cents precision ("$0.03", "$1.87"). Positive
 * amounts that would round to $0.00 render as "< $0.01" so a real (tiny)
 * cost never reads as free. Non-finite input returns ''.
 */
export function formatUsd(x) {
  if (!Number.isFinite(x)) return '';
  if (x > 0 && x < 0.005) return '< $0.01';
  return `$${x.toFixed(2)}`;
}
