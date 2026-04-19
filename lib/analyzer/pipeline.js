// Analysis pipeline for ArxivAnalyzer.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F4b).
//
// createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef })
// returns an object of stage handlers. Each handler reads current state from
// the Zustand store via useAnalyzerStore.getState(). React-hook-derived values
// (profile, currentBriefing, feedback) live in the store's reactContext slice,
// published by a useEffect in ArxivAnalyzer. The three React refs are passed
// as closure args because refs are mutable objects that don't belong in the store.

import { MockAPITester } from './mockApi.js';
import { TEST_PAPERS } from '../../utils/testUtils.js';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import { MODEL_REGISTRY } from '../../utils/models.js';
import { AnalysisWorkerPool } from './rateLimit.js';

export function createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef }) {
  const store = () => useAnalyzerStore.getState();

  const waitForResume = () => {
    return new Promise((resolve, reject) => {
      const checkPause = setInterval(() => {
        if (abortControllerRef.current?.signal.aborted) {
          clearInterval(checkPause);
          reject(new Error('Operation aborted'));
          return;
        }
        if (!pauseRef.current) {
          clearInterval(checkPause);
          resolve();
        }
      }, 100);
    });
  };

  const makeRobustAPICall = async (
    apiCallFunction,
    parseFunction,
    context = '',
    originalPromptInfo = ''
  ) => {
    const { addStatus } = store();
    const { config } = store().reactContext;
    let lastError = null;

    for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
      try {
        // Check for abort before each retry
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }
        if (pauseRef.current) {
          await waitForResume();
        }

        let responseText = await apiCallFunction();

        try {
          const result = parseFunction(responseText);
          return result;
        } catch (parseError) {
          lastError = parseError;
          addStatus(`${context} - Initial parse failed: ${parseError.message}`);
        }

        for (let correctionCount = 1; correctionCount <= config.maxCorrections; correctionCount++) {
          try {
            // Check for abort before each correction
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            if (pauseRef.current) {
              await waitForResume();
            }

            addStatus(
              `${context} - Frontend correction attempt ${correctionCount}/${config.maxCorrections} (backend already attempted validation)`
            );

            const correctionPrompt = `The response still has issues after backend validation. Please provide a properly formatted response.

  Previous response:
  ${responseText}

  Error: ${lastError.message}

  ${originalPromptInfo ? `Original task: ${originalPromptInfo}` : ''}

  Your entire response MUST ONLY be a single, valid JSON object/array. DO NOT respond with anything other than valid JSON.`;

            responseText = await apiCallFunction(correctionPrompt, true);

            const result = parseFunction(responseText);
            addStatus(`${context} - Correction ${correctionCount} succeeded`);
            return result;
          } catch (correctionError) {
            if (correctionError.message === 'Operation aborted') {
              throw correctionError;
            }
            lastError = correctionError;
            addStatus(
              `${context} - Correction ${correctionCount} failed: ${correctionError.message}`
            );
          }
        }

        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - All corrections failed, attempting full retry ${retryCount + 1}/${config.maxRetries}`
          );
        } else {
          throw new Error(
            `All retries and corrections exhausted. Last error: ${lastError?.message || 'Unknown error'}`
          );
        }
      } catch (apiError) {
        if (apiError.message === 'Operation aborted') {
          throw apiError;
        }
        // Playwright-unavailable is a deterministic infrastructure gap — the
        // next retry would hit the same 422. Short-circuit immediately so
        // the per-paper analyzePDFs catch can aggregate it without waiting
        // for retry backoff.
        if (apiError?.code === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA') {
          throw apiError;
        }
        lastError = apiError;
        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - API call failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`
          );

          // Sleep with abort checking
          const delay = 1000;
          for (let i = 0; i < delay; i += 50) {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } else {
          throw apiError;
        }
      }
    }

    throw lastError;
  };

  const makeMockRobustAPICall = async (mockApiFunction, parseFunction, context = '') => {
    const { addStatus } = store();
    const { config } = store().reactContext;
    let lastError = null;

    for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
      try {
        // Check for abort before each retry
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }
        if (pauseRef.current) {
          await waitForResume();
        }

        let responseText = await mockApiFunction();

        try {
          const result = parseFunction(responseText);
          return result;
        } catch (parseError) {
          lastError = parseError;
          addStatus(`${context} - Mock parse failed: ${parseError.message}`);
        }

        for (let correctionCount = 1; correctionCount <= config.maxCorrections; correctionCount++) {
          try {
            // Check for abort before each correction
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            if (pauseRef.current) {
              await waitForResume();
            }

            addStatus(`${context} - Mock correction ${correctionCount}/${config.maxCorrections}`);
            responseText = await mockApiFunction(true); // Pass isCorrection = true
            const result = parseFunction(responseText);
            addStatus(`${context} - Mock correction ${correctionCount} succeeded`);
            return result;
          } catch (correctionError) {
            if (correctionError.message === 'Operation aborted') {
              throw correctionError;
            }
            lastError = correctionError;
            addStatus(
              `${context} - Mock correction ${correctionCount} failed: ${correctionError.message}`
            );
          }
        }

        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - Mock corrections failed, retry ${retryCount + 1}/${config.maxRetries}`
          );
        } else {
          throw new Error(
            `Mock retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`
          );
        }
      } catch (apiError) {
        if (apiError.message === 'Operation aborted') {
          throw apiError;
        }
        // Playwright-unavailable is an infrastructure gap that won't fix
        // itself on retry; propagate immediately for the caller to aggregate.
        if (apiError?.code === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA') {
          throw apiError;
        }
        lastError = apiError;
        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - Mock API failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`
          );

          // Sleep with abort checking
          const delay = 500;
          for (let i = 0; i < delay; i += 50) {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } else {
          throw apiError;
        }
      }
    }

    throw lastError;
  };

  const calculateDateRange = (daysShifted = 0) => {
    const { config } = store().reactContext;
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - daysShifted);

    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - config.daysBack);

    // Format as YYYYMMDD for arXiv API
    const formatDate = (date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    };

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  };

  const buildArxivQuery = (category, startDate, endDate) => {
    // Use submittedDate with wildcards like the Python version
    const dateQuery = `submittedDate:[${startDate} TO ${endDate}]`;
    const categoryQuery = `cat:${category}`;

    // Combine with proper parentheses like Python version
    return `(${categoryQuery}) AND ${dateQuery}`;
  };

  const parseArxivEntry = (entry, fetchedCategory) => {
    const getId = (entry) => {
      const id = entry.getElementsByTagName('id')[0]?.textContent;
      let extractedId = id ? id.split('/abs/')[1] : '';
      // Strip any trailing .pdf or version numbers (e.g., v1, v2)
      extractedId = extractedId.replace(/\.pdf$/, '').replace(/v\d+$/, '');
      return extractedId;
    };

    const getAuthors = (entry) => {
      const authors = entry.getElementsByTagName('author');
      return Array.from(authors)
        .map((a) => a.getElementsByTagName('name')[0]?.textContent || '')
        .filter((name) => name.length > 0);
    };

    const getCategories = (entry) => {
      const categories = entry.getElementsByTagName('category');
      return Array.from(categories)
        .map((c) => c.getAttribute('term'))
        .filter((term) => term && term.length > 0);
    };

    const cleanText = (text) => {
      return text ? text.replace(/\s+/g, ' ').trim() : '';
    };

    return {
      id: getId(entry),
      title: cleanText(entry.getElementsByTagName('title')[0]?.textContent || ''),
      abstract: cleanText(entry.getElementsByTagName('summary')[0]?.textContent || ''),
      authors: getAuthors(entry),
      published: entry.getElementsByTagName('published')[0]?.textContent || '',
      updated: entry.getElementsByTagName('updated')[0]?.textContent || '',
      categories: getCategories(entry),
      pdfUrl: `https://export.arxiv.org/pdf/${getId(entry)}.pdf`,
      fetchedCategory: fetchedCategory,
    };
  };

  const executeArxivQuery = async (query, maxResults, category) => {
    const { password } = store();
    // Check for abort before making request
    if (abortControllerRef.current?.signal.aborted) {
      throw new Error('Operation aborted');
    }

    console.log(`  Query: ${query}`);

    // arXiv recommends >= 3s between requests. On 429, back off exponentially
    // (5s → 15s → 45s) rather than shifting the date range, since the rate
    // limit is endpoint-wide and date-shifting doesn't help.
    const maxRateLimitRetries = 3;
    const baseBackoffMs = 5000;
    let data;

    for (let attempt = 0; attempt <= maxRateLimitRetries; attempt++) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }

      // Use server-side proxy to avoid CORS issues
      const response = await fetch('/api/fetch-arxiv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxResults, password }),
        signal: abortControllerRef.current?.signal,
      });

      if (response.status === 429) {
        if (attempt === maxRateLimitRetries) {
          throw new Error(`arXiv rate limit: exhausted ${maxRateLimitRetries} retries`);
        }
        const errorData = await response.json().catch(() => ({}));
        const retryAfterSec = Number(errorData.retryAfter) || null;
        const backoffMs = retryAfterSec
          ? retryAfterSec * 1000
          : baseBackoffMs * Math.pow(3, attempt);
        console.warn(
          `  arXiv rate-limited (429), backing off ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${maxRateLimitRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `arXiv API HTTP error: ${response.status}`);
      }

      data = await response.json();
      break;
    }

    const text = data.xml;
    console.log(`  Response length: ${text.length} chars`);

    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    // Check for parsing errors
    const parseErrors = xml.getElementsByTagName('parsererror');
    if (parseErrors.length > 0) {
      throw new Error('XML parsing error in arXiv response');
    }

    // Check for arXiv API errors
    const errorElements = xml.getElementsByTagName('error');
    if (errorElements.length > 0) {
      const errorText = errorElements[0].textContent;
      throw new Error(`arXiv API error: ${errorText}`);
    }

    const entries = xml.getElementsByTagName('entry');
    const papers = [];

    for (const entry of entries) {
      // Check for abort during parsing
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }

      try {
        const paper = parseArxivEntry(entry, category);
        if (paper && paper.id) {
          papers.push(paper);
        }
      } catch (error) {
        console.warn(`Error parsing entry:`, error);
        // Continue with other entries
      }
    }

    return papers;
  };

  const fetchSingleCategory = async (category, statusCallback) => {
    // abortControllerRef and pauseRef come from the builder's closure args.
    const maxResults = 300; // Maximum papers to fetch per category
    const minPapersThreshold = 5; // Only stop shifting if we find at least this many papers
    // Day-shift schedule: today, then jump past a weekend (3), a full week (7),
    // and finally two weeks (14). Coarser steps because arXiv submissions
    // cluster on weekdays — fine-grained day-by-day retries waste rate budget.
    const dayShiftSchedule = [0, 3, 7, 14];

    for (let i = 0; i < dayShiftSchedule.length; i++) {
      const daysShifted = dayShiftSchedule[i];
      const isLastAttempt = i === dayShiftSchedule.length - 1;

      // Check for abort/pause before each attempt
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }
      if (pauseRef.current) {
        await waitForResume();
      }

      const { startDate, endDate } = calculateDateRange(daysShifted);
      const query = buildArxivQuery(category, startDate, endDate);

      console.log(
        `  Trying date range: ${startDate} to ${endDate}${daysShifted > 0 ? ` (shifted back ${daysShifted} days)` : ''}`
      );

      // Show date shift attempts in UI (only after first attempt)
      if (daysShifted > 0 && statusCallback) {
        statusCallback(`  ${category}: Trying -${daysShifted} days (${startDate}-${endDate})`);
      }

      try {
        const papers = await executeArxivQuery(query, maxResults, category);

        // Stop if we found enough papers
        if (papers.length >= minPapersThreshold) {
          if (daysShifted > 0) {
            console.log(
              `  ✓ Found ${papers.length} papers after shifting back ${daysShifted} days`
            );
            if (statusCallback) {
              statusCallback(
                `  ${category}: ✓ ${papers.length} papers (shifted back ${daysShifted} days)`
              );
            }
          }
          return papers;
        }
        // Last attempt - take whatever we have
        else if (papers.length > 0 && isLastAttempt) {
          console.log(
            `  ✓ Found ${papers.length} papers after ${daysShifted} days (below threshold of ${minPapersThreshold}, but final attempt)`
          );
          if (statusCallback) {
            statusCallback(
              `  ${category}: ✓ ${papers.length} papers (final attempt, below threshold)`
            );
          }
          return papers;
        }
        // First attempt with few papers - keep looking
        else if (papers.length > 0 && daysShifted === 0) {
          console.log(
            `  Found only ${papers.length} papers in original range (below threshold of ${minPapersThreshold}), trying shifted dates...`
          );
          if (statusCallback) {
            statusCallback(
              `  ${category}: Only ${papers.length} papers found, looking back further...`
            );
          }
        }
        // No papers at all on first attempt
        else if (papers.length === 0 && daysShifted === 0) {
          console.log(`  No papers found in original date range, trying with shifted dates...`);
          if (statusCallback) {
            statusCallback(`  ${category}: No papers in recent range, looking back...`);
          }
        }

        // Add delay before next attempt (if not the last attempt)
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, 3000)); // arXiv asks for >= 3s between requests
        }
      } catch (error) {
        // Check if this is an abort error
        if (error.message === 'Operation aborted') {
          throw error;
        }

        console.error(
          `  Error with query for ${category} (day shift ${daysShifted}):`,
          error.message
        );
        // Don't fail fast - continue trying with date shifts
        // Network errors might be transient

        // Add delay before retry even on error
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, 3000)); // arXiv asks for >= 3s between requests
        }
      }
    }

    const maxShift = dayShiftSchedule[dayShiftSchedule.length - 1];
    console.log(
      `  Warning: No papers found for ${category} even after shifting back ${maxShift} days`
    );
    return [];
  };

  const removeDuplicatePapers = (papers) => {
    const seen = new Set();
    return papers.filter((paper) => {
      if (seen.has(paper.id)) {
        return false;
      }
      seen.add(paper.id);
      return true;
    });
  };

  const fetchPapers = async () => {
    const { addError, addStatus, setProcessing, setResults } = store();
    const { config } = store().reactContext;
    setProcessing((prev) => ({ ...prev, stage: 'fetching', progress: { current: 0, total: 0 } }));

    try {
      const categories = config.selectedCategories.filter((cat) => cat.trim());
      if (categories.length === 0) {
        throw new Error('No categories selected');
      }

      console.log(`Fetching papers for ${categories.length} categories: ${categories.join(', ')}`);

      // Set initial progress with total categories
      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: 0, total: categories.length },
      }));

      const allPapers = [];
      const requestDelay = 3000; // arXiv asks for >= 3s between requests

      // Process each category individually (like the Python version)
      for (let i = 0; i < categories.length; i++) {
        // Check for abort signal
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }

        // Check for pause
        if (pauseRef.current) {
          await waitForResume();
        }

        const category = categories[i];

        try {
          console.log(`\nFetching category ${i + 1}/${categories.length}: ${category}`);

          // Add status message for category start
          addStatus(`Fetching ${category}...`);

          const categoryPapers = await fetchSingleCategory(category, addStatus);
          allPapers.push(...categoryPapers);

          console.log(`Found ${categoryPapers.length} papers for ${category}`);
          addStatus(`✓ ${category}: Found ${categoryPapers.length} papers`);

          // Update progress after each category
          setProcessing((prev) => ({
            ...prev,
            stage: 'fetching',
            progress: { current: i + 1, total: categories.length },
          }));
        } catch (error) {
          // Check if this is an abort error
          if (error.message === 'Operation aborted') {
            throw error;
          }

          console.error(`Error fetching category ${category}:`, error);
          addError(`Failed to fetch category ${category}: ${error.message}`);
          // Continue with other categories
        } finally {
          // Always delay between categories (except for the last one)
          if (i < categories.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, requestDelay));
          }
        }
      }

      // Remove duplicates based on paper ID
      const uniquePapers = removeDuplicatePapers(allPapers);

      // Sort by most recent submission date
      uniquePapers.sort((a, b) => new Date(b.published) - new Date(a.published));

      console.log(`\n=== FETCH SUMMARY ===`);
      console.log(`Total papers found: ${allPapers.length}`);
      console.log(`Unique papers: ${uniquePapers.length}`);
      console.log(`Duplicates removed: ${allPapers.length - uniquePapers.length}`);

      if (uniquePapers.length === 0) {
        addError(
          `No papers found for any category in the specified time range. Try increasing 'Days to Look Back' or check if categories are valid.`
        );
      }

      setResults((prev) => ({ ...prev, allPapers: uniquePapers }));

      // Final progress update
      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: categories.length, total: categories.length },
      }));

      return uniquePapers;
    } catch (error) {
      addError(`Failed to fetch papers: ${error.message}`);
      throw error;
    }
  };

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
    const providerLower = (MODEL_REGISTRY[config.filterModel]?.provider ?? '').toLowerCase();
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    const filterPool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
    });

    let completedBatches = 0;
    let papersProcessed = 0;

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
            const cleaned = text
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
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
              const errorText = await response.text();
              throw new Error(`Filter API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            if (data.error) {
              throw new Error(data.error);
            }

            return data.rawResponse || JSON.stringify(data.verdicts);
          };

          const parseResponse = (text) => {
            const cleaned = text
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
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

            // Update live results
            if (verdict.verdict === 'YES') {
              setFilterResults((prev) => ({ ...prev, yes: [...prev.yes, paper] }));
            } else if (verdict.verdict === 'MAYBE') {
              setFilterResults((prev) => ({ ...prev, maybe: [...prev.maybe, paper] }));
            } else {
              setFilterResults((prev) => ({ ...prev, no: [...prev.no, paper] }));
            }

            // Add to filtered list if in selected categories
            if (config.categoriesToScore.includes(verdict.verdict)) {
              filteredPapers.push(paper);
            }
          }
        });

        allVerdicts.push(...verdictsArray);
      } catch (error) {
        if (error.message === 'Operation aborted') {
          throw error;
        }
        addError(`Filter batch ${batchIndex + 1} failed: ${error.message}`);
        // On failure, include all papers in batch as MAYBE (safe default)
        batch.forEach((paper) => {
          paper.filterVerdict = 'MAYBE';
          if (config.categoriesToScore.includes('MAYBE')) {
            filteredPapers.push(paper);
          }
        });
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

    return filteredPapers;
  };

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
      const today = new Date().toISOString().slice(0, 10);
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

    const providerLower = (MODEL_REGISTRY[config.scoringModel]?.provider ?? '').toLowerCase();
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    const scoringPool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
    });

    let papersProcessed = 0;

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
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
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
              const errorData = await response.json();
              throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            // If scores are already parsed, return them directly; otherwise return rawResponse for parsing
            if (data.scores && Array.isArray(data.scores)) {
              return JSON.stringify(data.scores);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
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

    const finalSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
    return finalSorted;
  };

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

    const providerLower = (
      MODEL_REGISTRY[config.postProcessingModel ?? config.scoringModel]?.provider ?? ''
    ).toLowerCase();
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    const rescorePool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
    });

    let papersProcessed = 0;

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
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
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
              const errorData = await response.json();
              throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.rescores && Array.isArray(data.rescores)) {
              return JSON.stringify(data.rescores);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
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

    // Persist the final post-processed list back to scoredPapers so the
    // abstract-only view (computed as scoredPapers minus finalRanking)
    // reflects the rescored values rather than the original abstract scores.
    setResults((prev) => ({ ...prev, scoredPapers: allPapers }));

    return allPapers;
  };

  const analyzePDFs = async (papers, isDryRun = false) => {
    const { addError, password, setProcessing, setResults } = store();
    const { config, profile } = store().reactContext;
    setProcessing((prev) => ({
      ...prev,
      stage: 'deep-analysis',
      progress: { current: 0, total: papers.length },
    }));

    // Pre-allocate so worker completions can write by index and preserve the
    // input ordering (workers claim in order but may complete out of order).
    const analyzedPapers = new Array(papers.length);
    let completedCount = 0;

    // Stage 3 parallelism knob. Dry-run runs single-threaded (mock path is
    // instant and visual pacing matters). Live runs fan out to N workers.
    // See docs/superpowers/specs/2026-04-17-pdf-parallelism-design.md.
    const concurrency = isDryRun
      ? 1
      : Math.max(1, Math.min(20, config.pdfAnalysisConcurrency ?? 3));

    // Cache-warmup barrier — Anthropic-only. The first worker runs solo so
    // its response primes the ephemeral prompt-cache entry; sibling workers
    // then start and hit the cache instead of racing parallel creates.
    // Revisit if adding a new provider with single-flight prefix semantics
    // (OpenAI currently auto-caches with no warmup needed, Google has no
    // caching). See spec §3.2 "Revisit if" for triggers.
    const providerLower = (MODEL_REGISTRY[config.pdfModel]?.provider ?? '').toLowerCase();
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    const pool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: abortControllerRef.current?.signal,
    });

    const runSingle = async (paper, idx) => {
      if (abortControllerRef.current?.signal.aborted) return;
      if (pauseRef.current) await waitForResume();

      try {
        let analysis;

        if (isDryRun) {
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockAnalyzePDF(paper, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const parsed = JSON.parse(cleanedText);

            if (!parsed.summary || typeof parsed.updatedScore === 'undefined') {
              throw new Error(
                'Missing required fields (summary or updatedScore) in analysis response'
              );
            }
            if (typeof parsed.summary !== 'string') {
              throw new Error('Summary field must be a string');
            }
            if (typeof parsed.updatedScore !== 'number') {
              throw new Error('UpdatedScore field must be a number');
            }
            if (parsed.updatedScore < 0 || parsed.updatedScore > 10) {
              throw new Error(
                `UpdatedScore must be between 0.0 and 10.0, got ${parsed.updatedScore}`
              );
            }
            parsed.updatedScore = Math.round(parsed.updatedScore * 10) / 10;
            return parsed;
          };

          analysis = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock analyzing paper "${paper.title}"`
          );
        } else {
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              pdfUrl: paper.pdfUrl,
              arxivId: paper.arxivId ?? paper.id,
              title: paper.title,
              scoringCriteria: profile.content,
              originalScore: paper.relevanceScore,
              originalJustification: paper.scoreJustification,
              password: password,
              model: config.pdfModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/analyze-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              const errorData = await response.json();
              if (
                response.status === 422 &&
                errorData?.error === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA'
              ) {
                const skipErr = new Error('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
                skipErr.code = 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA';
                skipErr.arxivId = errorData.arxivId ?? paper.arxivId ?? paper.id;
                skipErr.title = errorData.title ?? paper.title;
                throw skipErr;
              }
              throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.analysis && typeof data.analysis === 'object') {
              return JSON.stringify(data.analysis);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const parsed = JSON.parse(cleanedText);

            if (!parsed.summary || typeof parsed.updatedScore === 'undefined') {
              throw new Error(
                'Missing required fields (summary or updatedScore) in analysis response'
              );
            }
            if (typeof parsed.summary !== 'string') {
              throw new Error('Summary field must be a string');
            }
            if (typeof parsed.updatedScore !== 'number') {
              throw new Error('UpdatedScore field must be a number');
            }
            if (parsed.updatedScore < 0 || parsed.updatedScore > 10) {
              throw new Error(
                `UpdatedScore must be between 0.0 and 10.0, got ${parsed.updatedScore}`
              );
            }
            parsed.updatedScore = Math.round(parsed.updatedScore * 10) / 10;
            return parsed;
          };

          analysis = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Analyzing paper "${paper.title}"`,
            `Analyze PDF content and provide updated relevance score with detailed summary`
          );
        }

        const preAnalysisScore = paper.relevanceScore ?? paper.initialScore ?? 0;
        const pdfScoreAdjustment = analysis.updatedScore - preAnalysisScore;
        const analyzedPaper = {
          ...paper,
          deepAnalysis: analysis,
          finalScore: analysis.updatedScore,
          preAnalysisScore,
          pdfScoreAdjustment,
        };
        analyzedPapers[idx] = analyzedPaper;

        completedCount += 1;
        setProcessing((prev) => ({
          ...prev,
          progress: { current: completedCount, total: papers.length },
        }));

        setResults((prev) => {
          const updatedRanking = [...prev.finalRanking];
          const paperIndex = updatedRanking.findIndex((p) => p.id === paper.id);
          if (paperIndex !== -1) {
            updatedRanking[paperIndex] = analyzedPaper;
          }
          updatedRanking.sort((a, b) => {
            const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
            const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
            return scoreB - scoreA;
          });
          return { ...prev, finalRanking: updatedRanking };
        });

        if (isDryRun) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        // Playwright-unavailable: aggregate into the dedicated skip slice,
        // keep the paper in results with a skip-reason marker, and continue.
        // `makeRobustAPICall` wraps the sentinel error after maxRetries, so
        // detect the code via the direct error or its message substring.
        const isPlaywrightSkip =
          error?.code === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA' ||
          (typeof error?.message === 'string' &&
            error.message.includes('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA'));

        if (isPlaywrightSkip) {
          const { addSkippedDueToRecaptcha, addStatus } = store();
          addStatus(
            `Skipping "${paper.title}" (${paper.arxivId ?? paper.id}): Playwright unavailable for reCAPTCHA bypass`
          );
          addSkippedDueToRecaptcha({
            id: paper.id,
            arxivId: paper.arxivId ?? paper.id,
            title: paper.title,
          });
          const skippedPaper = {
            ...paper,
            deepAnalysis: null,
            finalScore: paper.relevanceScore || 0,
            pdfAnalysisSkipReason: 'recaptcha-no-playwright',
          };
          analyzedPapers[idx] = skippedPaper;

          completedCount += 1;
          setProcessing((prev) => ({
            ...prev,
            progress: { current: completedCount, total: papers.length },
          }));
          setResults((prev) => {
            const updatedRanking = [...prev.finalRanking];
            const paperIndex = updatedRanking.findIndex((p) => p.id === paper.id);
            if (paperIndex !== -1) {
              updatedRanking[paperIndex] = skippedPaper;
            }
            updatedRanking.sort((a, b) => {
              const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
              const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
              return scoreB - scoreA;
            });
            return { ...prev, finalRanking: updatedRanking };
          });
          return;
        }

        addError(`Failed to analyze paper "${paper.title}" after all retries: ${error.message}`);
        analyzedPapers[idx] = {
          ...paper,
          deepAnalysis: null,
          finalScore: paper.relevanceScore || 0,
        };
        completedCount += 1;
        setProcessing((prev) => ({
          ...prev,
          progress: { current: completedCount, total: papers.length },
        }));
      }
    };

    await pool.run(papers, runSingle);

    // Filter holes in case abort left unclaimed papers undefined.
    return analyzedPapers.filter((p) => p !== undefined);
  };

  const startProcessing = async (isDryRun = false, useTestPapers = false) => {
    const {
      addError,
      clearSkippedDueToRecaptcha,
      setFilterResults,
      setProcessing,
      setProcessingTiming,
      setResults,
    } = store();
    const { config } = store().reactContext;
    const startTime = new Date();
    setProcessingTiming({ startTime, endTime: null, duration: null });
    setProcessing((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      errors: [],
      statusLog: [],
    }));

    // Reset Playwright-skip aggregation on every new run so the end-of-run
    // summary card reflects only the current run.
    clearSkippedDueToRecaptcha();

    // Reset filter results for new processing
    setFilterResults({
      total: 0,
      yes: [],
      maybe: [],
      no: [],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    });

    pauseRef.current = false;
    abortControllerRef.current = new AbortController();

    let finalPapers = []; // Track final papers locally

    try {
      let papers;

      if (useTestPapers) {
        // Use hardcoded test papers for minimal test
        setProcessing((prev) => ({ ...prev, stage: 'fetching' }));
        papers = TEST_PAPERS;
        setResults((prev) => ({ ...prev, allPapers: papers }));
      } else {
        // Stage 1: Fetch papers from arXiv
        papers = await fetchPapers();
        if (papers.length === 0) {
          addError('No papers found for specified categories');
          return;
        }
      }

      // Stage 2: Quick filter (if enabled)
      let papersToScore = papers;
      if (config.useQuickFilter) {
        papersToScore = await performQuickFilter(papers, isDryRun);

        if (papersToScore.length === 0) {
          addError(
            'No papers passed the initial filter. Consider adjusting filter criteria or categories.'
          );
          return;
        }

        console.log(`\n=== FILTER COMPLETE ===`);
        console.log(
          `Papers proceeding to scoring: ${papersToScore.length} of ${papers.length} (${Math.round((papersToScore.length / papers.length) * 100)}%)`
        );

        // Phase B: pauseAfterFilter gate. When enabled, the pipeline halts
        // here so the user can review filter results and apply overrides via
        // the ProgressTimeline's interactive UI. The UI sets pauseRef.current
        // = true when it detects the 'filter-review' stage, and the user
        // clicks "Continue to scoring →" which sets it back to false.
        if (config.pauseAfterFilter) {
          setProcessing((prev) => ({ ...prev, stage: 'filter-review' }));
          pauseRef.current = true;
          await waitForResume();
          // Re-read config in case user changed overrides during the pause
          const freshStore = store();
          papersToScore = freshStore.filterResults.yes.concat(
            freshStore.filterResults.maybe.filter(() =>
              (freshStore.reactContext.config?.categoriesToScore ?? ['YES', 'MAYBE']).includes(
                'MAYBE'
              )
            )
          );
        }
      }

      // Stage 3: Score abstracts (now returns only successfully scored papers)
      const scoredPapers = await scoreAbstracts(papersToScore, isDryRun);

      if (scoredPapers.length === 0) {
        addError(
          'No papers could be scored successfully. Check your API configuration and try again.'
        );
        return;
      }

      // Stage 3.5: Post-process scores for consistency (optional)
      let postProcessedPapers = scoredPapers;
      if (config.enableScorePostProcessing) {
        postProcessedPapers = await postProcessScores(scoredPapers, isDryRun);
      }

      // Stage 4: Select top papers for deep analysis (now working with filtered, sorted, and optionally post-processed papers)
      setProcessing((prev) => ({ ...prev, stage: 'selecting' }));

      // Use the sorted postProcessedPapers from results, and ensure minimum score threshold
      // Use the local postProcessedPapers variable (not results.scoredPapers which may not be updated yet)
      const availablePapers = postProcessedPapers.filter(
        (paper) =>
          paper.relevanceScore > 0 && paper.scoreJustification !== 'Failed to score after retries'
      );

      const topPapers = availablePapers.slice(0, config.maxDeepAnalysis);

      console.log(`\n=== SELECTION SUMMARY ===`);
      console.log(`Available papers for deep analysis: ${availablePapers.length}`);
      console.log(`Selected for deep analysis: ${topPapers.length}`);

      if (topPapers.length === 0) {
        addError(
          'No papers qualified for deep analysis. All papers either failed to score or had zero relevance.'
        );
        return;
      }

      // Pre-populate finalRanking to prevent empty state during PDF analysis
      setResults((prev) => ({ ...prev, finalRanking: topPapers }));

      // Stage 5: Deep analysis
      const analyzedPapers = await analyzePDFs(topPapers, isDryRun);

      // Stage 6: Final ranking and output
      setProcessing((prev) => ({ ...prev, stage: 'complete' }));

      // Sort by final score (or relevance score as fallback)
      analyzedPapers.sort((a, b) => {
        const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
        const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
        return scoreB - scoreA;
      });

      finalPapers = analyzedPapers.slice(0, config.finalOutputCount);

      setResults((prev) => ({ ...prev, finalRanking: finalPapers }));

      // Stage 7: Briefing generation (auto-runs at end of pipeline)
      if (finalPapers.length > 0) {
        const { config: latestConfig } = store().reactContext;

        if (latestConfig?.pauseBeforeBriefing) {
          // Pause so user can review results + add feedback before briefing
          setProcessing((prev) => ({ ...prev, stage: 'pre-briefing-review' }));
          pauseRef.current = true;
          await waitForResume();
        }

        // Generate the briefing
        setProcessing((prev) => ({ ...prev, stage: 'synthesizing' }));

        // Read the latest state for briefing generation
        const briefingStore = store();
        const briefingCtx = briefingStore.reactContext;

        // Build generation metadata
        const filterVerdictCounts = {
          yes: briefingStore.filterResults.yes?.length ?? 0,
          maybe: briefingStore.filterResults.maybe?.length ?? 0,
          no: briefingStore.filterResults.no?.length ?? 0,
        };
        const resolvedBriefingModel =
          latestConfig?.briefingModel ?? latestConfig?.pdfModel ?? 'gemini-3.1-pro';
        const generationMetadata = {
          profileSnapshot: briefingCtx.profile?.content ?? '',
          filterModel: latestConfig?.filterModel ?? '',
          scoringModel: latestConfig?.scoringModel ?? '',
          pdfModel: latestConfig?.pdfModel ?? '',
          briefingModel: resolvedBriefingModel,
          categories: [...(latestConfig?.selectedCategories ?? [])],
          filterVerdictCounts,
          feedbackCutoff: briefingCtx.profile?.lastFeedbackCutoff ?? null,
          briefingRetryOnYes: latestConfig?.briefingRetryOnYes ?? true,
          briefingRetryOnMaybe: latestConfig?.briefingRetryOnMaybe ?? false,
          pauseAfterFilter: latestConfig?.pauseAfterFilter ?? true,
          pauseBeforeBriefing: latestConfig?.pauseBeforeBriefing ?? true,
          timestamp: new Date().toISOString(),
        };

        try {
          const { runBriefingGeneration } = await import('./briefingClient.js');
          await runBriefingGeneration({
            results: { finalRanking: finalPapers },
            briefingModel: resolvedBriefingModel,
            pdfModel: latestConfig?.pdfModel,
            quickSummaryModel: latestConfig?.quickSummaryModel,
            quickSummaryConcurrency: latestConfig?.quickSummaryConcurrency,
            briefingRetryOnYes: latestConfig?.briefingRetryOnYes ?? true,
            briefingRetryOnMaybe: latestConfig?.briefingRetryOnMaybe ?? false,
            profile: briefingCtx.profile,
            password: briefingStore.password,
            feedbackEvents: briefingCtx.feedback?.events ?? [],
            filterResults: briefingStore.filterResults,
            saveBriefing: briefingCtx.saveBriefing,
            generationMetadata,
            setSynthesizing: briefingStore.setSynthesizing,
            setSynthesisError: briefingStore.setSynthesisError,
            setBriefingCheckResult: briefingStore.setBriefingCheckResult,
            setBriefingStage: briefingStore.setBriefingStage,
            setQuickSummariesById: briefingStore.setQuickSummariesById,
            setFullReportsById: briefingStore.setFullReportsById,
          });
        } catch (briefingErr) {
          addError(`Briefing generation failed: ${briefingErr.message}`);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError' && error.message !== 'Operation aborted') {
        addError(`Processing failed: ${error.message}`);
      }
    } finally {
      const endTime = new Date();
      const duration = startTime ? endTime - startTime : 0;
      setProcessingTiming((prev) => ({
        ...prev,
        startTime: prev.startTime || startTime,
        endTime,
        duration,
      }));

      setProcessing((prev) => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        // Use local finalPapers array instead of results.finalRanking
        stage: finalPapers.length > 0 ? 'complete' : 'idle',
      }));
    }
  };

  const runDryRunTest = async () => {
    const { addError, addStatus, setTestState } = store();
    setTestState((prev) => ({ ...prev, dryRunInProgress: true }));

    try {
      // Create new abort controller for this test
      const oldAbortController = abortControllerRef.current;
      abortControllerRef.current = new AbortController();

      // Reset mock API tester to enhanced version
      mockAPITesterRef.current = new MockAPITester({ abortControllerRef, pauseRef, waitForResume });
      addStatus('Starting dry run test - no API costs incurred');

      await startProcessing(true, false); // isDryRun = true, useTestPapers = false

      setTestState((prev) => ({
        ...prev,
        dryRunCompleted: true,
        lastDryRunTime: new Date(),
        dryRunInProgress: false,
      }));

      addStatus('Dry run test completed successfully — click Download Report to save.');

      // Restore previous abort controller
      abortControllerRef.current = oldAbortController;
    } catch (error) {
      if (error.message === 'Operation aborted') {
        addStatus('Dry run test was cancelled');
      } else {
        addError(`Dry run test failed: ${error.message}`);
      }
      setTestState((prev) => ({ ...prev, dryRunInProgress: false }));
    }
  };

  const runMinimalTest = async () => {
    const { addError, addStatus, setTestState } = store();
    setTestState((prev) => ({ ...prev, minimalTestInProgress: true }));

    try {
      // Create new abort controller for this test
      const oldAbortController = abortControllerRef.current;
      abortControllerRef.current = new AbortController();

      addStatus('Starting minimal test with real API calls');

      await startProcessing(false, true); // isDryRun = false, useTestPapers = true

      setTestState((prev) => ({
        ...prev,
        lastMinimalTestTime: new Date(),
        minimalTestInProgress: false,
      }));

      addStatus('Minimal test completed successfully — click Download Report to save.');

      // Restore previous abort controller
      abortControllerRef.current = oldAbortController;
    } catch (error) {
      if (error.message === 'Operation aborted') {
        addStatus('Minimal test was cancelled');
      } else {
        addError(`Minimal test failed: ${error.message}`);
      }
      setTestState((prev) => ({ ...prev, minimalTestInProgress: false }));
    }
  };

  const generateNotebookLM = async () => {
    const {
      results,
      testState,
      password,
      setNotebookLMContent,
      setNotebookLMGenerating,
      setNotebookLMStatus,
    } = store();
    const { podcastDuration, notebookLMModel } = store().notebookLM;
    const { currentBriefing } = store().reactContext;
    try {
      setNotebookLMGenerating(true);
      setNotebookLMStatus('Generating NotebookLM bundle...');
      setNotebookLMContent(null);

      // Combine scored papers and final ranking
      const allPapers =
        results.finalRanking && results.finalRanking.length > 0
          ? results.finalRanking
          : results.scoredPapers.filter((p) => p.score > 0 || p.relevanceScore > 0);

      if (allPapers.length === 0) {
        setNotebookLMStatus('No papers available for NotebookLM generation');
        setNotebookLMGenerating(false);
        return;
      }

      // Use mock API if in test mode
      if (testState.dryRunInProgress && mockAPITesterRef.current) {
        console.log('Using mock NotebookLM generation API...');
        const markdown = await mockAPITesterRef.current.mockGenerateNotebookLM(
          allPapers,
          podcastDuration,
          notebookLMModel
        );
        setNotebookLMContent(markdown);
        setNotebookLMStatus('NotebookLM bundle generated (mock)');
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const response = await fetch('/api/generate-notebooklm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing: currentBriefing?.briefing ?? null,
          papers: results.finalRanking,
          podcastDuration,
          notebookLMModel,
          provider: (MODEL_REGISTRY[notebookLMModel]?.provider ?? 'Google').toLowerCase(),
          password,
          date,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error ?? 'bundle generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aparture-notebooklm-${date}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNotebookLMContent('NotebookLM bundle downloaded.');
      setNotebookLMStatus('Bundle ready — see download.');
    } catch (error) {
      console.error('NotebookLM generation error:', error);
      setNotebookLMStatus(`Error: ${error.message}`);
    } finally {
      setNotebookLMGenerating(false);
    }
  };

  return {
    startProcessing,
    runDryRunTest,
    runMinimalTest,
    generateNotebookLM,
  };
}
