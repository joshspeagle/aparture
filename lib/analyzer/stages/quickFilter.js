// Stage 2: quick LLM filter (YES/MAYBE/NO triage).
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
// Reads all state from store()/store().reactContext at call time.

import { MockAPITester } from '../mockApi.js';
import { AnalysisWorkerPool, getLLMBarrier } from '../rateLimit.js';
import { RateLimitError, parseRouteError } from '../RateLimitError.js';
import { extractJsonFromLlmOutput } from '../../../utils/json.js';
import { providerKeyForModel, warnIfFreeTierLikelyToThrottle } from './support.js';

export function createPerformQuickFilter(deps) {
  const {
    store,
    abortControllerRef,
    pauseRef,
    mockAPITesterRef,
    waitForResume,
    recordUsage,
    makeRobustAPICall,
    makeMockRobustAPICall,
  } = deps;

  const performQuickFilter = async (papers, isDryRun = false) => {
    const { addError, password, setFilterResults, setProcessing } = store();
    const { config, profile } = store().reactContext;
    if (!config.useQuickFilter) {
      return papers; // Skip filtering if disabled
    }

    setProcessing((prev) => ({
      ...prev,
      stage: 'Filtering',
      progress: { current: 0, total: papers.length },
    }));

    const batchSize = config.filterBatchSize || 10;
    const totalBatches = Math.ceil(papers.length / batchSize);

    // Initialize filter results
    setFilterResults({
      total: papers.length,
      yes: [],
      maybe: [],
      no: [],
      inProgress: true,
      currentBatch: 0,
      totalBatches,
    });

    const filteredPapers = [];
    const allVerdicts = [];

    // Build batches up front so the worker pool can dispatch them in parallel.
    const batches = [];
    for (let i = 0; i < papers.length; i += batchSize) {
      batches.push(papers.slice(i, Math.min(i + batchSize, papers.length)));
    }

    // Stage 2 parallelism. Dry-run stays single-threaded for deterministic
    // pacing in the UI; live runs fan out. Clamped 1–20.
    const concurrency = isDryRun ? 1 : Math.max(1, Math.min(20, config.filterConcurrency ?? 3));

    // Anthropic prompt-cache warmup: the first worker's first call runs solo
    // so siblings read the cache instead of racing parallel creates. Google
    // and OpenAI skip this (OpenAI auto-caches, Google doesn't cache).
    const providerLower = providerKeyForModel(config.filterModel);
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    // Pre-flight warning when free-tier Gemini Flash-Lite × concurrency is
    // likely to trigger 429 cascades. Cheap UX win.
    if (!isDryRun) {
      warnIfFreeTierLikelyToThrottle({
        provider: providerLower,
        model: config.filterModel,
        concurrency,
        totalBatches,
        addStatus: store().addStatus,
        stageLabel: 'Stage 2 filter',
      });
    }

    const filterPool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
      // Per-provider rate-limit barrier: when one batch hits 429, all
      // siblings pause for the Retry-After window. Live runs only — dry-run
      // doesn't hit a real provider.
      barrierFor: !isDryRun ? () => getLLMBarrier(providerLower) : null,
    });

    let completedBatches = 0;
    let papersProcessed = 0;
    let rateLimitedBatches = 0;

    await filterPool.run(batches, async (batch, batchIndex) => {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }
      if (pauseRef.current) {
        await waitForResume();
      }

      try {
        let verdicts;

        if (isDryRun) {
          // Mock filter for dry run using the mock API tester
          const mockApiCall = async (isCorrection = false) => {
            if (!mockAPITesterRef.current) {
              mockAPITesterRef.current = new MockAPITester({
                abortControllerRef,
                pauseRef,
                waitForResume,
              });
            }
            return await mockAPITesterRef.current.mockQuickFilter(batch, isCorrection);
          };

          const parseResponse = (text) => {
            const cleaned = extractJsonFromLlmOutput(text);
            const parsed = JSON.parse(cleaned);
            // Ensure we return an array format
            return Array.isArray(parsed) ? parsed : parsed.verdicts || [];
          };

          verdicts = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock filter batch ${batchIndex + 1}/${totalBatches}`
          );
        } else {
          // Real API call
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              papers: batch.map((p) => ({ title: p.title, id: p.id, abstract: p.abstract })),
              scoringCriteria: profile.content,
              password: password,
              model: config.filterModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/quick-filter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              // 429/503 → RateLimitError (with retryAfterMs from the route).
              // Other non-OK → Error with the route's actual `details`
              // string ("google: invalid argument") instead of a generic blob.
              await parseRouteError(response, providerLower);
            }

            const data = await response.json();
            if (data.error) {
              throw new Error(data.error);
            }

            recordUsage('filter', config.filterModel, data);

            // Prefer the server-validated verdicts over raw model text —
            // same contract as the score/rescore/analyze-pdf stages. With
            // thinking-enabled models, rawResponse can carry a prose
            // preamble that fails the JSON parse and triggers a billed
            // frontend correction call despite valid verdicts in hand.
            if (Array.isArray(data.verdicts)) {
              return JSON.stringify(data.verdicts);
            }
            return data.rawResponse;
          };

          const parseResponse = (text) => {
            const cleaned = extractJsonFromLlmOutput(text);
            const parsed = JSON.parse(cleaned);
            if (!parsed.verdicts && Array.isArray(parsed)) {
              return { verdicts: parsed };
            }
            return parsed;
          };

          const result = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Filter batch ${batchIndex + 1}/${totalBatches}`
          );

          verdicts = result.verdicts || result;
        }

        // Apply verdicts to papers
        // Handle both array format (real API) and paperIndex format (mock API)
        const verdictsArray = Array.isArray(verdicts) ? verdicts : [];

        // Accumulate bucket additions locally and commit ONE store update per
        // batch (mirroring the failure path below). The old per-paper
        // setFilterResults cloned the growing bucket arrays O(n²) across a
        // run AND triggered a React render per paper.
        const bucketAdds = { yes: [], maybe: [], no: [] };

        verdictsArray.forEach((verdict) => {
          // Get the paper based on paperIndex (1-indexed) or by order
          const paperIdx = verdict.paperIndex
            ? verdict.paperIndex - 1
            : verdictsArray.indexOf(verdict);

          if (paperIdx >= 0 && paperIdx < batch.length) {
            const paper = batch[paperIdx];
            paper.filterVerdict = verdict.verdict;
            // Phase 1.5.1: capture the original verdict + the model's summary
            // and justification so the UI can show them and track user overrides.
            paper.originalVerdict = verdict.verdict;
            paper.filterSummary = verdict.summary ?? '';
            paper.filterJustification = verdict.justification ?? '';

            if (verdict.verdict === 'YES') {
              bucketAdds.yes.push(paper);
            } else if (verdict.verdict === 'MAYBE') {
              bucketAdds.maybe.push(paper);
            } else {
              bucketAdds.no.push(paper);
            }

            // Add to filtered list if in selected categories
            if (config.categoriesToScore.includes(verdict.verdict)) {
              filteredPapers.push(paper);
            }
          }
        });

        if (bucketAdds.yes.length || bucketAdds.maybe.length || bucketAdds.no.length) {
          setFilterResults((prev) => ({
            ...prev,
            yes: bucketAdds.yes.length ? [...prev.yes, ...bucketAdds.yes] : prev.yes,
            maybe: bucketAdds.maybe.length ? [...prev.maybe, ...bucketAdds.maybe] : prev.maybe,
            no: bucketAdds.no.length ? [...prev.no, ...bucketAdds.no] : prev.no,
          }));
        }

        allVerdicts.push(...verdictsArray);
      } catch (error) {
        if (error.message === 'Operation aborted') {
          throw error;
        }
        if (error instanceof RateLimitError) rateLimitedBatches += 1;
        addError(`Filter batch ${batchIndex + 1} failed: ${error.message}`);
        // On failure, include all papers in batch as MAYBE (safe default)
        batch.forEach((paper) => {
          paper.filterVerdict = 'MAYBE';
          paper.originalVerdict = 'MAYBE';
          if (config.categoriesToScore.includes('MAYBE')) {
            filteredPapers.push(paper);
          }
          // Mirror the success path into the local accumulator — the
          // end-of-stage YES/MAYBE/NO summary counts are computed from
          // allVerdicts, so failed batches must be represented too.
          allVerdicts.push({ verdict: 'MAYBE', title: paper.title });
        });
        // Push the whole batch into the MAYBE bucket like the success path
        // does — the filter-review gate rebuilds papersToScore exclusively
        // from the buckets, so papers absent here would vanish from the run
        // (and from the FilterResultsList UI). Single store update per batch.
        setFilterResults((prev) => ({ ...prev, maybe: [...prev.maybe, ...batch] }));
      }

      completedBatches += 1;
      papersProcessed += batch.length;
      setFilterResults((prev) => ({ ...prev, currentBatch: completedBatches }));
      setProcessing((prev) => ({
        ...prev,
        progress: { current: papersProcessed, total: papers.length },
      }));
    });

    setFilterResults((prev) => ({ ...prev, inProgress: false }));

    // Compute final counts from allVerdicts (the local accumulator) rather
    // than reading store().filterResults, which may lag behind during the loop.
    const yesCount = allVerdicts.filter((v) => v.verdict === 'YES').length;
    const maybeCount = allVerdicts.filter((v) => v.verdict === 'MAYBE').length;
    const noCount = allVerdicts.filter((v) => v.verdict === 'NO').length;
    console.log(`\n=== FILTER SUMMARY ===`);
    console.log(`Total papers: ${papers.length}`);
    console.log(`YES: ${yesCount} (${Math.round((yesCount / papers.length) * 100)}%)`);
    console.log(`MAYBE: ${maybeCount} (${Math.round((maybeCount / papers.length) * 100)}%)`);
    console.log(`NO: ${noCount} (${Math.round((noCount / papers.length) * 100)}%)`);
    console.log(`Papers proceeding to scoring: ${filteredPapers.length}`);

    // End-of-stage summary in the activity log. Surfaces rate-limit count
    // separately so users can distinguish "free-tier RPM cap" from harder
    // failures (validation, auth, etc.).
    const rlSuffix = rateLimitedBatches > 0 ? `, ${rateLimitedBatches} rate-limited` : '';
    store().addStatus(
      `Filter complete: ${completedBatches}/${totalBatches} batches succeeded${rlSuffix}`
    );

    return filteredPapers;
  };

  return performQuickFilter;
}
