import { callModel } from '../../lib/llm/callModel.js';
import { loadRubricPrompt } from '../../lib/llm/loadRubricPrompt.js';
import { resolveApiKey } from '../../lib/llm/resolveApiKey.js';
import { ArxivDownloadThrottle } from '../../lib/analyzer/rateLimit.js';
import { MODEL_REGISTRY } from '../../utils/models.js';
import path from 'path';
import fs from 'fs';

// Module-level throttle for arXiv PDF downloads. Serializes fetches across
// all concurrent /api/analyze-pdf requests served by this Node process so a
// client-side parallel fan-out (introduced with `pdfAnalysisConcurrency`)
// doesn't blow past arXiv's 1-req/3s cap. Spacing defaults to 5s per
// docs/superpowers/specs/2026-04-17-pdf-parallelism-design.md §2.2.
//
// Single-process assumption: Aparture is a local dev-server (npm run dev),
// so module state is shared across all requests. If this ever moves to a
// serverless/edge deployment, replace with a shared-store implementation.
const downloadThrottle = new ArxivDownloadThrottle();

// Parse a Retry-After header (either delta-seconds or HTTP-date format) into ms.
function parseRetryAfterMs(header) {
  if (!header) return null;
  const asSeconds = parseInt(header, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;
  const asDate = new Date(header);
  if (!Number.isNaN(asDate.getTime())) {
    return Math.max(0, asDate.getTime() - Date.now());
  }
  return null;
}

// Playwright is an optional dependency. It's only needed when arXiv serves a
// reCAPTCHA page instead of the PDF bytes. If it's not installed, we return a
// dedicated error code so the pipeline can skip the paper gracefully rather
// than failing the whole run.
async function tryImportPlaywright() {
  try {
    const mod = await import('playwright');
    return mod;
  } catch {
    return null;
  }
}

// Sentinel error thrown inside the download path when reCAPTCHA is detected
// but Playwright isn't available. Caught by the handler's top-level try/catch
// so we can return a structured 422 response instead of a generic 500.
const PLAYWRIGHT_UNAVAILABLE_ERR = 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA';

// Helper function to detect if response is HTML (reCAPTCHA) instead of PDF
function isPDFResponse(buffer) {
  if (buffer.byteLength < 5) return false;

  // Check for PDF magic bytes: %PDF-
  const header = Buffer.from(buffer.slice(0, 5)).toString('ascii');
  return header === '%PDF-';
}

// Helper function to download PDF using Playwright (bypasses reCAPTCHA)
//
// IMPORTANT: This function works correctly even when called from within npm run analyze automation:
// - Main automation uses temp/browser-profile (non-headless, user-visible)
// - PDF fallback uses temp/playwright-profile (headless, background)
// - Separate profiles prevent locking conflicts
// - Each Playwright instance establishes its own arXiv session by visiting abstract page first
// - No cookie sharing needed - each instance independently bypasses reCAPTCHA
async function downloadPDFWithPlaywright(chromium, pdfUrl) {
  console.log('Attempting PDF download via Playwright (reCAPTCHA bypass)...');

  // Use separate profile for PDF downloads to avoid conflicts with main automation
  // This profile is independent and works whether or not npm run analyze is running
  const userDataDir = path.join(process.cwd(), 'temp', 'playwright-profile');

  // Ensure temp directory exists
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  let context;
  try {
    // Launch headless persistent context for PDF download
    // Uses separate profile from main automation (temp/browser-profile) to avoid locks
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      acceptDownloads: true,
    });

    const page = context.pages()[0] || (await context.newPage());

    // Extract arXiv ID from URL
    const arxivIdMatch = pdfUrl.match(/\/pdf\/([^/]+)(?:\.pdf)?/);
    if (!arxivIdMatch) {
      throw new Error(`Could not extract arXiv ID from URL: ${pdfUrl}`);
    }
    const arxivId = arxivIdMatch[1];

    // Navigate to abstract page first
    const absUrl = `https://arxiv.org/abs/${arxivId}`;
    console.log(`Navigating to abstract page: ${absUrl}`);
    await page.goto(absUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Get the PDF URL and fetch it with browser context (includes cookies/session)
    const fullPdfUrl = `https://export.arxiv.org/pdf/${arxivId}.pdf`;
    console.log(`Fetching PDF via browser context: ${fullPdfUrl}`);

    const response = await context.request.get(fullPdfUrl);

    if (response.status() !== 200) {
      throw new Error(`Playwright PDF download failed: HTTP ${response.status()}`);
    }

    const pdfBuffer = await response.body();
    console.log(`PDF downloaded via Playwright: ${pdfBuffer.length} bytes`);

    // Verify it's a valid PDF
    if (!isPDFResponse(pdfBuffer)) {
      throw new Error('Playwright downloaded invalid PDF (HTML/reCAPTCHA page)');
    }

    return pdfBuffer;
  } finally {
    if (context) {
      await context.close();
    }
  }
}

// Function to validate PDF analysis response structure
function validatePDFAnalysisResponse(responseText) {
  try {
    const parsed = JSON.parse(responseText);

    const errors = [];

    // Check required fields
    const requiredFields = [
      'summary',
      'keyFindings',
      'methodology',
      'limitations',
      'relevanceAssessment',
      'updatedScore',
    ];

    requiredFields.forEach((field) => {
      if (!(field in parsed)) {
        errors.push(`Missing required field: ${field}`);
      } else if (field === 'updatedScore') {
        if (typeof parsed[field] !== 'number' || parsed[field] < 0 || parsed[field] > 10) {
          errors.push(`updatedScore must be a number between 0 and 10`);
        }
      } else {
        if (typeof parsed[field] !== 'string' || parsed[field].length < 20) {
          errors.push(`${field} must be a string with meaningful content`);
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  } catch (e) {
    return { isValid: false, errors: ['Invalid JSON: ' + e.message] };
  }
}

/**
 * Static cacheable prefix: scoring rubric + user profile.
 * Identical for every PDF call in a run with the same scoringCriteria.
 * Marked for Anthropic prompt caching.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    pdfUrl,
    scoringCriteria,
    originalScore,
    _originalJustification,
    password,
    model,
    correctionPrompt,
    callModelMode,
    _testPdfBase64, // test escape hatch: skip download in NODE_ENV=test
  } = req.body;

  // Resolve auth + API key
  const modelConfig = MODEL_REGISTRY[model];
  if (!modelConfig) {
    return res.status(400).json({ error: `Unsupported model: ${model}` });
  }
  const provider = modelConfig.provider.toLowerCase();
  const modelApiId = modelConfig.apiId ?? model;

  const {
    apiKey,
    error: authError,
    status: authStatus,
  } = resolveApiKey({
    clientApiKey: req.body.apiKey,
    password,
    provider,
  });
  if (authError) {
    return res.status(authStatus).json({ error: authError });
  }

  if (!apiKey && (callModelMode?.mode ?? 'live') !== 'fixture') {
    return res.status(401).json({ error: 'missing credentials' });
  }

  const callMode = callModelMode ?? { mode: 'live' };

  try {
    let responseText;

    if (correctionPrompt) {
      // Correction path: text-only, no PDF
      const result = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? correctionPrompt,
          cachePrefix: '',
          cacheable: false,
          apiKey,
        },
        callMode
      );
      responseText = result.text;
    } else {
      // Main PDF path
      let base64Data;

      // Test escape hatch: skip real download in test environment
      if (_testPdfBase64 && process.env.NODE_ENV === 'test') {
        base64Data = _testPdfBase64;
      } else {
        // Download PDF for normal analysis - try direct fetch first, fallback to Playwright if blocked
        console.log('Downloading PDF from:', pdfUrl);
        let pdfBuffer;
        let usedPlaywright = false;

        try {
          // Throttle arXiv direct-fetch: serialized across concurrent
          // requests, min 5s spacing, honors Retry-After. See spec §2.2.
          await downloadThrottle.acquire();
          let pdfResponse = await fetch(pdfUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          // On 429/503 with a Retry-After, honor the header and retry once
          // before giving up. Avoids cascading failures when arXiv briefly
          // tightens enforcement.
          if (pdfResponse.status === 429 || pdfResponse.status === 503) {
            const retryHeader = pdfResponse.headers.get('retry-after');
            const retryAfterMs = parseRetryAfterMs(retryHeader) ?? 10000;
            console.warn(
              `arXiv ${pdfResponse.status} on direct fetch (retry-after ${retryAfterMs}ms); waiting and retrying once...`
            );
            downloadThrottle.rateLimited({ retryAfterMs });
            await downloadThrottle.acquire();
            pdfResponse = await fetch(pdfUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            });
          }

          if (!pdfResponse.ok) {
            throw new Error(`Failed to download PDF: HTTP ${pdfResponse.status}`);
          }

          pdfBuffer = await pdfResponse.arrayBuffer();

          // Check if we got HTML/reCAPTCHA instead of PDF
          if (!isPDFResponse(pdfBuffer)) {
            console.warn(
              'Direct fetch returned HTML/reCAPTCHA page, attempting Playwright fallback...'
            );
            throw new Error('reCAPTCHA detected');
          }

          console.log('PDF downloaded via direct fetch:', {
            sizeBytes: pdfBuffer.byteLength,
            sizeKB: (pdfBuffer.byteLength / 1024).toFixed(2),
          });
        } catch (fetchError) {
          // If direct fetch failed or got reCAPTCHA, try Playwright fallback.
          // Playwright is an optional dependency — if it's not installed we
          // raise a sentinel error so the handler's catch block can return a
          // structured 422 response rather than a generic 500.
          console.warn(`Direct fetch failed (${fetchError.message}), using Playwright fallback...`);
          const playwrightMod = await tryImportPlaywright();
          if (!playwrightMod?.chromium) {
            console.warn(
              'Playwright unavailable — skipping paper. Install with: npx playwright install chromium'
            );
            throw new Error(PLAYWRIGHT_UNAVAILABLE_ERR);
          }
          // Playwright fallback also hits arXiv — take the throttle again
          // before navigating so the browser fetch respects the same pacing.
          await downloadThrottle.acquire();
          pdfBuffer = await downloadPDFWithPlaywright(playwrightMod.chromium, pdfUrl);
          usedPlaywright = true;
        }

        const bufferSize = pdfBuffer.byteLength;

        if (bufferSize === 0) {
          throw new Error('Downloaded PDF is empty (0 bytes)');
        }

        base64Data = Buffer.from(pdfBuffer).toString('base64');
        console.log(
          `PDF ready for analysis: { sizeBytes: ${bufferSize}, sizeKB: ${(bufferSize / 1024).toFixed(2)}, usedPlaywright: ${usedPlaywright}, base64Length: ${base64Data.length} }`
        );
      }

      const { cachePrefix, variableTail } = await loadRubricPrompt(
        'rubric-pdf.md',
        { profile: scoringCriteria ?? '' },
        { originalScore: String(originalScore) }
      );
      const cacheable = provider === 'anthropic';
      // APARTURE_TEST_PROMPT_OVERRIDE replaces the variable tail for fixture-based
      // tests. When the override is active (or when running in fixture mode),
      // disable caching so the fixture hash keys only on
      // {provider, model, prompt, apiKey} — a predictable value.
      const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
      const isFixture = callMode.mode === 'fixture';
      const finalPrompt = promptOverride ?? variableTail;
      const useCaching = cacheable && !isFixture && !promptOverride;

      const result = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: finalPrompt,
          pdfBase64: base64Data,
          cachePrefix: useCaching ? cachePrefix : '',
          cacheable: useCaching,
          apiKey,
        },
        callMode
      );
      responseText = result.text;
    }

    // Clean up response text (remove markdown formatting if present)
    let cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Always validate response structure (not just on parse failure)
    const validation = validatePDFAnalysisResponse(cleanedText);

    // If validation fails and this isn't already a correction attempt, try to correct
    if (!validation.isValid && !correctionPrompt) {
      console.log('Initial PDF analysis response validation failed:', validation.errors);

      // Build correction prompt with specific errors
      const correctionRequest = `The previous response had formatting/structure errors:
${validation.errors.join('\n')}

Original response:
${cleanedText}

Please provide a corrected response with all required fields.
Required fields: summary, keyFindings, methodology, limitations, relevanceAssessment, updatedScore

Your entire response MUST ONLY be a valid JSON object in this exact format:
{
  "summary": "Multi-paragraph summary with \\n\\n between paragraphs",
  "keyFindings": "Key findings paragraph",
  "methodology": "Methodology paragraph",
  "limitations": "Limitations paragraph",
  "relevanceAssessment": "Relevance assessment paragraph",
  "updatedScore": 5.5
}`;

      // Correction goes through text-only path (no PDF)
      const finalCorrectionPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? correctionRequest;
      const correctedResult = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: finalCorrectionPrompt,
          cachePrefix: '',
          cacheable: false,
          apiKey,
        },
        callMode
      );
      responseText = correctedResult.text;
      cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    }

    let analysis;
    try {
      analysis = JSON.parse(cleanedText);

      // Final validation even after correction
      const finalValidation = validatePDFAnalysisResponse(cleanedText);
      if (!finalValidation.isValid) {
        console.warn(
          'PDF analysis response still invalid after correction:',
          finalValidation.errors
        );
      }
    } catch (parseError) {
      // If this is a correction attempt that still failed, return the raw response for debugging
      if (correctionPrompt) {
        return res.status(200).json({
          analysis: null,
          rawResponse: responseText,
          error: `Correction parsing failed: ${parseError.message}`,
        });
      }
      throw parseError;
    }

    // Return both the parsed analysis and the raw response
    res.status(200).json({
      analysis,
      rawResponse: responseText,
    });
  } catch (error) {
    // Graceful degradation: PDF requires reCAPTCHA bypass but Playwright is
    // not installed. Return a structured 422 so the pipeline can skip this
    // paper and aggregate the skip in the run summary, rather than logging
    // it as a hard error.
    if (error?.message === PLAYWRIGHT_UNAVAILABLE_ERR) {
      return res.status(422).json({
        error: PLAYWRIGHT_UNAVAILABLE_ERR,
        arxivId: req.body?.arxivId,
        title: req.body?.title,
      });
    }
    console.error('Error analyzing PDF:', error);
    res.status(500).json({
      error: 'Failed to analyze PDF',
      details: error.message,
    });
  }
}
