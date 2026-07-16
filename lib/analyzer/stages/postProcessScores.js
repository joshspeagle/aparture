// Stage 3.5: optional score post-processing (batched consistency rescoring).
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
// Reads all state from store()/store().reactContext at call time.

import { AnalysisWorkerPool, getLLMBarrier } from '../rateLimit.js';
import { RateLimitError, parseRouteError } from '../RateLimitError.js';
import { extractJsonFromLlmOutput } from '../../../utils/json.js';
import { providerKeyForModel } from './support.js';

export function createPostProcessScores(deps) {
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

  const postProcessScores = async (papers, isDryRun = false) => {
    const { addError, password, setProcessing, setResults } = store();
    const { config, profile } = store().reactContext;
    // Skip if disabled or no papers to process
    if (!config.enableScorePostProcessing || papers.length === 0) {
      return papers;
    }

    setProcessing((prev) => ({
      ...prev,
      stage: 'Post-Processing',
      progress: { current: 0, total: Math.min(config.postProcessingCount, papers.length) },
    }));

    // Select papers for post-processing (simply take the top N papers)
    const selectedPapers = papers.slice(0, config.postProcessingCount);

    if (selectedPapers.length === 0) {
      console.log('No papers to post-process');
      return papers;
    }

    // Randomize the selected papers to prevent bias in batch comparisons
    // Fisher-Yates shuffle to ensure uniform distribution
    const papersToProcess = [...selectedPapers];
    for (let i = papersToProcess.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [papersToProcess[i], papersToProcess[j]] = [papersToProcess[j], papersToProcess[i]];
    }

    console.log(`\n=== POST-PROCESSING ${papersToProcess.length} PAPERS ===`);
    console.log(`Papers shuffled for unbiased batch comparisons`);

    const processedPapers = [];
    const batchSize = config.postProcessingBatchSize || 5;

    // Build batches up front for the worker pool.
    const batches = [];
    for (let i = 0; i < papersToProcess.length; i += batchSize) {
      batches.push(papersToProcess.slice(i, Math.min(i + batchSize, papersToProcess.length)));
    }

    // Stage 3.5 parallelism. Dry-run stays single-threaded; live runs fan out.
    const concurrency = isDryRun
      ? 1
      : Math.max(1, Math.min(20, config.postProcessingConcurrency ?? 3));

    // The rescore route dispatches `config.scoringModel` (not
    // postProcessingModel), so provider lookup must match that to keep
    // cache warmup aligned with the model actually being called.
    const providerLower = providerKeyForModel(config.scoringModel);
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    const rescorePool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
      barrierFor: !isDryRun ? () => getLLMBarrier(providerLower) : null,
    });

    let papersProcessed = 0;
    let rateLimitedBatches = 0;

    await rescorePool.run(batches, async (batch, batchIndex) => {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }
      if (pauseRef.current) {
        await waitForResume();
      }

      try {
        let rescores;

        if (isDryRun) {
          // Use mock API for dry run
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockRescoreAbstracts(batch, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = extractJsonFromLlmOutput(responseText);
            const rescores = JSON.parse(cleanedText);

            if (!Array.isArray(rescores)) {
              throw new Error('Response is not an array');
            }

            rescores.forEach((rescore, idx) => {
              if (
                !rescore.hasOwnProperty('paperIndex') ||
                !rescore.hasOwnProperty('adjustedScore') ||
                !rescore.hasOwnProperty('adjustmentReason') ||
                !rescore.hasOwnProperty('confidence')
              ) {
                throw new Error(`Rescore object ${idx} missing required fields`);
              }
              if (
                typeof rescore.paperIndex !== 'number' ||
                typeof rescore.adjustedScore !== 'number' ||
                typeof rescore.adjustmentReason !== 'string' ||
                typeof rescore.confidence !== 'string'
              ) {
                throw new Error(`Rescore object ${idx} has invalid field types`);
              }
              if (rescore.adjustedScore < 0 || rescore.adjustedScore > 10) {
                throw new Error(`Rescore object ${idx} adjustedScore must be between 0.0 and 10.0`);
              }
              if (!['HIGH', 'MEDIUM', 'LOW'].includes(rescore.confidence)) {
                throw new Error(`Rescore object ${idx} confidence must be HIGH, MEDIUM, or LOW`);
              }
              // Round to one decimal place
              rescore.adjustedScore = Math.round(rescore.adjustedScore * 10) / 10;
            });

            return rescores;
          };

          rescores = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock rescoring batch ${batchIndex + 1}`
          );
        } else {
          // Use real API for production
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              papers: batch.map((p) => ({
                title: p.title,
                abstract: p.abstract,
                initialScore: p.initialScore,
                initialJustification: p.initialJustification,
              })),
              scoringCriteria: profile.content,
              password: password,
              model: config.scoringModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/rescore-abstracts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              await parseRouteError(response, providerLower);
            }

            const data = await response.json();
            // The rescore route dispatches config.scoringModel (see the
            // provider lookup above), so usage is recorded against it too.
            recordUsage('postProcessing', config.scoringModel, data);
            if (data.rescores && Array.isArray(data.rescores)) {
              return JSON.stringify(data.rescores);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = extractJsonFromLlmOutput(responseText);
            const rescores = JSON.parse(cleanedText);

            if (!Array.isArray(rescores)) {
              throw new Error('Response is not an array');
            }

            // Validate each rescore
            rescores.forEach((rescore) => {
              if (rescore.adjustedScore < 0 || rescore.adjustedScore > 10) {
                throw new Error(`Adjusted score must be between 0.0 and 10.0`);
              }
              // Round to one decimal place
              rescore.adjustedScore = Math.round(rescore.adjustedScore * 10) / 10;
            });

            return rescores;
          };

          rescores = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Rescoring batch ${batchIndex + 1}`,
            `Rescore ${batch.length} paper abstracts for consistency`
          );
        }

        // Apply rescores to papers
        rescores.forEach((rescoreData) => {
          const paperIdx = rescoreData.paperIndex - 1;
          if (paperIdx >= 0 && paperIdx < batch.length) {
            const processedPaper = {
              ...batch[paperIdx],
              relevanceScore: rescoreData.adjustedScore, // Update current score
              adjustedScore: rescoreData.adjustedScore, // Store adjusted score
              adjustmentReason: rescoreData.adjustmentReason,
              adjustmentConfidence: rescoreData.confidence,
              scoreAdjustment: rescoreData.adjustedScore - batch[paperIdx].initialScore,
            };
            processedPapers.push(processedPaper);
          }
        });
      } catch (error) {
        // Check if this is an abort error
        if (error.message === 'Operation aborted') {
          throw error;
        }

        if (error instanceof RateLimitError) rateLimitedBatches += 1;
        addError(`Failed to rescore batch ${batchIndex + 1}: ${error.message}`);

        // Keep original scores for failed batch
        batch.forEach((p) => {
          processedPapers.push(p);
        });
      }

      // Update progress
      papersProcessed += batch.length;
      setProcessing((prev) => ({
        ...prev,
        progress: {
          current: papersProcessed,
          total: papersToProcess.length,
        },
      }));

      // Push live snapshot of scoredPapers so the UI updates as each
      // batch finishes — same pattern as scoreAbstracts. Merge what's
      // been rescored so far with the still-unrescored tail and re-sort.
      const processedIdsSoFar = new Set(processedPapers.map((p) => p.id));
      const liveSnapshot = [
        ...processedPapers,
        ...papers.filter((p) => !processedIdsSoFar.has(p.id)),
      ].sort((a, b) => b.relevanceScore - a.relevanceScore);
      setResults((prev) => ({ ...prev, scoredPapers: liveSnapshot }));
    });

    // Merge processed papers back with unprocessed ones
    const processedIds = new Set(processedPapers.map((p) => p.id));
    const unchangedPapers = papers.filter((p) => !processedIds.has(p.id));
    const allPapers = [...processedPapers, ...unchangedPapers].sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );

    console.log(`\n=== POST-PROCESSING SUMMARY ===`);
    console.log(`Papers post-processed: ${processedPapers.length}`);
    const adjustedCount = processedPapers.filter(
      (p) => p.scoreAdjustment && Math.abs(p.scoreAdjustment) > 0.1
    ).length;
    console.log(`Papers with adjusted scores: ${adjustedCount}`);
    {
      const rlSuffix = rateLimitedBatches > 0 ? `, ${rateLimitedBatches} rate-limited` : '';
      store().addStatus(
        `Post-processing complete: ${processedPapers.length} processed, ${adjustedCount} adjusted${rlSuffix}`
      );
    }

    // Persist the final post-processed list back to scoredPapers so the
    // abstract-only view (computed as scoredPapers minus finalRanking)
    // reflects the rescored values rather than the original abstract scores.
    setResults((prev) => ({ ...prev, scoredPapers: allPapers }));

    return allPapers;
  };

  return postProcessScores;
}
