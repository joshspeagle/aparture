// Per-request token-usage accumulator shared by the batch LLM routes
// (analyze-pdf, quick-filter, rescore-abstracts, score-abstracts). Sums
// usage across every provider call a single request makes (initial +
// backend auto-correction); the route returns `usage` on the 200 body so
// the client can accumulate per-stage cost.

export function createUsageAccumulator() {
  const usage = { tokensIn: 0, tokensOut: 0, cacheReadTok: 0 };
  const addUsage = (r) => {
    usage.tokensIn += r?.tokensIn ?? 0;
    usage.tokensOut += r?.tokensOut ?? 0;
    usage.cacheReadTok += r?.cacheReadTok ?? 0;
  };
  return { usage, addUsage };
}
