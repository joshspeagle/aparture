// Module-level pure helpers shared by the pipeline stage modules.
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.

import { MODEL_REGISTRY } from '../../../utils/models.js';

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

// Barrier/provider key for a configured model id. A model missing from
// MODEL_REGISTRY used to resolve to '' — workers then acquired the ''
// rate-limit barrier while the 429 handler in makeRobustAPICall signaled the
// REAL provider's barrier (parseRouteError reads `body.provider` from the
// route), so no sibling ever paused. Fall back to inferring the provider
// from the model-id prefix, then to 'llm' — the same terminal fallback
// parseRouteError uses — so acquire and signal always land on the same key.
export function providerKeyForModel(modelId) {
  const registered = (MODEL_REGISTRY[modelId]?.provider ?? '').toLowerCase();
  if (registered) return registered;
  const id = (modelId ?? '').toLowerCase();
  if (id.startsWith('claude')) return 'anthropic';
  if (id.startsWith('gemini')) return 'google';
  if (id.startsWith('gpt') || /^o\d/.test(id)) return 'openai';
  return 'llm';
}
