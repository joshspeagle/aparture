// Module-level pure helpers shared by the pipeline stage modules.
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.

import { providerForModel } from '../../../utils/models.js';

// Pre-flight free-tier RPM warning. Aparture's default Google Flash-Lite
// slot is on the free 60 RPM cap; with concurrency × estimated batches/sec
// > 60, users see cascading 429s. The barrier auto-recovers but the run
// is much slower, so warn proactively.
export function warnIfFreeTierLikelyToThrottle({
  provider,
  model,
  concurrency,
  totalBatches,
  addStatus,
  stageLabel,
}) {
  if (provider !== 'google') return;
  if (typeof model !== 'string' || !model.includes('flash-lite')) return;
  // Conservative: assume ~2s per Flash-Lite call. concurrency=3 → 90 RPM.
  const estimatedRPM = concurrency * 30;
  if (estimatedRPM <= 60) return;
  if (totalBatches < 20) return; // small runs won't sustain the rate long enough
  addStatus(
    `Warning: ${stageLabel} may exceed Gemini free-tier 60 RPM (concurrency=${concurrency}, ` +
      `~${estimatedRPM} req/min estimated). The pipeline auto-pauses on 429s but expect retries to slow the run.`
  );
}

// Barrier/provider key for a configured model id. Must land on the SAME key
// the 429 handler signals: makeRobustAPICall's parseRouteError reads
// `body.provider` from the route, and the routes resolve an unregistered
// model id with `MODEL_REGISTRY[id]?.provider ?? 'Google'`. Mirror that
// exact fallback here — a prefix-inference (claude→anthropic etc.) would
// acquire a barrier the routes never signal, so no sibling would ever pause.
export function providerKeyForModel(modelId) {
  return (providerForModel(modelId) ?? 'google').toLowerCase();
}
