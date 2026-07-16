// Stage 3: score abstracts 0-10 against the profile (also records
// filter-override feedback events captured at the filter-review gate).
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
// Reads all state from store()/store().reactContext at call time.

import { AnalysisWorkerPool, getLLMBarrier } from '../rateLimit.js';
import { RateLimitError, parseRouteError } from '../RateLimitError.js';
import { extractJsonFromLlmOutput } from '../../../utils/json.js';
import { providerKeyForModel, warnIfFreeTierLikelyToThrottle } from './support.js';
import { localDateStr } from '../../dates.js';

export function createScoreAbstracts(deps) {
  const {
    store,
    abortControllerRef,
    pauseRef,
    mockAPITesterRef,
    runBriefingDateRef,
    waitForResume,
    recordUsage,
    makeRobustAPICall,
    makeMockRobustAPICall,
  } = deps;

  const scoreAbstracts = async (papers, isDryRun = false) => {
    const { addError, addStatus, filterResults, password, setProcessing, setResults } = store();
    const { config, profile, feedback } = store().reactContext;
    // Phase 1.5.1 B3: record filter-override events for any papers whose
    // verdict was changed by the user before scoring started. Compare the
    // current filterResults buckets against each paper's originalVerdict
    // (captured at filter time). One filter-override event per changed
    // paper.
    try {
      const allBuckets = [
        { bucket: 'YES', papers: filterResults.yes },
        { bucket: 'MAYBE', papers: filterResults.maybe },
        { bucket: 'NO', papers: filterResults.no },
      ];
      // LOCAL calendar day, matching the app-wide briefing-date convention
      // (lib/dates.js) — a UTC fallback here would stamp filter-override
      // events with a different briefingDate than the same run's scoped
      // feedback whenever the local day ≠ UTC day.
      const today = runBriefingDateRef.current ?? localDateStr();
      for (const { bucket: currentVerdict, papers: bucketPapers } of allBuckets) {
        for (const paper of bucketPapers) {
          if (paper.originalVerdict && paper.originalVerdict !== currentVerdict) {
            feedback.addFilterOverride({
              arxivId: paper.arxivId ?? paper.id,
              paperTitle: paper.title,
              summary: paper.filterSummary ?? '',
              justification: paper.filterJustification ?? '',
              originalVerdict: paper.originalVerdict,
              newVerdict: currentVerdict,
              briefingDate: today,
            });
          }
        }
      }
    } catch (overrideErr) {
      console.warn('[Phase 1.5.1] Failed to record filter overrides:', overrideErr);
    }

    setProcessing((prev) => ({
      ...prev,
      stage: 'initial-scoring',
      progress: { current: 0, total: papers.length },
    }));

    const scoredPapers = [];
    const failedPapers = []; // Track failed papers separately
    const batchSize = config.scoringBatchSize || config.batchSize || 3; // Use scoringBatchSize, fallback to old batchSize

    // Build batches up front for the worker pool.
    const batches = [];
    for (let i = 0; i < papers.length; i += batchSize) {
      batches.push(papers.slice(i, Math.min(i + batchSize, papers.length)));
    }

    // Stage 3 parallelism. Dry-run stays single-threaded; live runs fan out.
    const concurrency = isDryRun ? 1 : Math.max(1, Math.min(20, config.scoringConcurrency ?? 3));

    const providerLower = providerKeyForModel(config.scoringModel);
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    if (!isDryRun) {
      warnIfFreeTierLikelyToThrottle({
        provider: providerLower,
        model: config.scoringModel,
        concurrency,
        totalBatches: batches.length,
        addStatus: store().addStatus,
        stageLabel: 'Stage 3 scoring',
      });
    }

    const scoringPool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
      barrierFor: !isDryRun ? () => getLLMBarrier(providerLower) : null,
    });

    let papersProcessed = 0;
    let rateLimitedBatches = 0;

    await scoringPool.run(batches, async (batch, batchIndex) => {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }
      if (pauseRef.current) {
        await waitForResume();
      }

      try {
        let scores;

        if (isDryRun) {
          // Use mock API for dry run
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockScoreAbstracts(batch, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = extractJsonFromLlmOutput(responseText);
            const scores = JSON.parse(cleanedText);

            if (!Array.isArray(scores)) {
              throw new Error('Response is not an array');
            }

            scores.forEach((score, idx) => {
              if (
                !score.hasOwnProperty('paperIndex') ||
                !score.hasOwnProperty('score') ||
                !score.hasOwnProperty('justification')
              ) {
                throw new Error(`Score object ${idx} missing required fields`);
              }
              if (
                typeof score.paperIndex !== 'number' ||
                typeof score.score !== 'number' ||
                typeof score.justification !== 'string'
              ) {
                throw new Error(`Score object ${idx} has invalid field types`);
              }
              // Validate score range (allow 0-10 inclusive)
              if (score.score < 0 || score.score > 10) {
                throw new Error(
                  `Score object ${idx} score must be between 0.0 and 10.0, got ${score.score}`
                );
              }
              // Round to one decimal place to handle floating point precision issues
              score.score = Math.round(score.score * 10) / 10;
            });

            return scores;
          };

          scores = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock scoring batch ${batchIndex + 1}`
          );
        } else {
          // Use real API for production
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              papers: batch,
              scoringCriteria: profile.content,
              password: password,
              model: config.scoringModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/score-abstracts', {
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
            recordUsage('scoring', config.scoringModel, data);
            // If scores are already parsed, return them directly; otherwise return rawResponse for parsing
            if (data.scores && Array.isArray(data.scores)) {
              return JSON.stringify(data.scores);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = extractJsonFromLlmOutput(responseText);
            const scores = JSON.parse(cleanedText);

            if (!Array.isArray(scores)) {
              throw new Error('Response is not an array');
            }

            scores.forEach((score, idx) => {
              if (
                !score.hasOwnProperty('paperIndex') ||
                !score.hasOwnProperty('score') ||
                !score.hasOwnProperty('justification')
              ) {
                throw new Error(`Score object ${idx} missing required fields`);
              }
              if (
                typeof score.paperIndex !== 'number' ||
                typeof score.score !== 'number' ||
                typeof score.justification !== 'string'
              ) {
                throw new Error(`Score object ${idx} has invalid field types`);
              }
              // Validate score range - allow decimals
              if (score.score < 0 || score.score > 10) {
                throw new Error(
                  `Score object ${idx} score must be between 0.0 and 10.0, got ${score.score}`
                );
              }
              // Round to one decimal place to handle floating point precision issues
              score.score = Math.round(score.score * 10) / 10;
            });

            return scores;
          };

          scores = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Scoring batch ${batchIndex + 1}`,
            `Score ${batch.length} paper abstracts for relevance using the provided criteria`
          );
        }

        // Process successful scores
        scores.forEach((scoreData) => {
          const paperIdx = scoreData.paperIndex - 1;
          if (paperIdx >= 0 && paperIdx < batch.length) {
            const scoredPaper = {
              ...batch[paperIdx],
              relevanceScore: scoreData.score,
              scoreJustification: scoreData.justification,
              // Store initial scores for post-processing
              initialScore: scoreData.score,
              initialJustification: scoreData.justification,
            };

            // Only add papers with valid scores (> 0) to the main results
            if (scoreData.score > 0) {
              scoredPapers.push(scoredPaper);
            } else {
              // Track papers with score 0 separately
              failedPapers.push({
                ...scoredPaper,
                failureReason: 'Scored as 0 relevance',
              });
            }
          }
        });
      } catch (error) {
        // Check if this is an abort error
        if (error.message === 'Operation aborted') {
          throw error;
        }

        if (error instanceof RateLimitError) rateLimitedBatches += 1;
        addError(`Failed to score batch ${batchIndex + 1} after all retries: ${error.message}`);

        // Add failed papers to the failed list, not the main results
        batch.forEach((p) => {
          failedPapers.push({
            ...p,
            relevanceScore: 0,
            scoreJustification: 'Failed to score after retries',
            failureReason: error.message,
          });
        });
      }

      // Update progress AND results after each batch
      papersProcessed += batch.length;
      setProcessing((prev) => ({
        ...prev,
        progress: { current: papersProcessed, total: papers.length },
      }));

      // Update results with current scored papers (sorted by score, only successful ones)
      const currentSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
      setResults((prev) => ({
        ...prev,
        scoredPapers: currentSorted,
        failedPapers: failedPapers, // Store failed papers separately
      }));

      // Dry-run only: small pause for visual pacing. Live runs don't need an
      // inter-batch delay — the pool handles spacing via its concurrency limit.
      if (isDryRun) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    // Log summary of results
    console.log(`\n=== SCORING SUMMARY ===`);
    console.log(`Successfully scored papers: ${scoredPapers.length}`);
    console.log(`Failed papers: ${failedPapers.length}`);
    if (failedPapers.length > 0) {
      addStatus(
        `Warning: ${failedPapers.length} papers failed to score and will be excluded from deep analysis`
      );
    }
    const rlSuffix = rateLimitedBatches > 0 ? `, ${rateLimitedBatches} rate-limited` : '';
    addStatus(
      `Scoring complete: ${scoredPapers.length} scored, ${failedPapers.length} failed${rlSuffix}`
    );

    const finalSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
    return finalSorted;
  };

  return scoreAbstracts;
}
