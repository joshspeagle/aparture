// Selection notes reach the scoring and PDF calls, after the research
// profile; writing and podcast notes don't.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';
import { NOTES_HEADING } from '../../../lib/profile/editorialNotes.js';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const notes = [
  { id: 'a', scope: 'selection', text: 'Benchmark-only papers count as adjacent.' },
  { id: 'b', scope: 'writing', text: 'Open each theme with its result.' },
  { id: 'c', scope: 'podcast', text: 'Keep the pace brisk.' },
];

test(
  'each scoring and PDF request carries the profile plus its selection notes',
  { timeout: 30000 },
  async () => {
    useAnalyzerStore.setState(initialState());
    useAnalyzerStore.setState({
      reactContext: {
        profile: { content: 'I study flows.', notes },
        config: {
          pdfModel: 'gemini-3.1-pro',
          scoringModel: 'gemini-3.1-pro',
          filterModel: 'gemini-3.1-pro',
          briefingModel: 'gemini-3.1-pro',
          selectedCategories: ['cs.AI'],
          useQuickFilter: false,
          pauseAfterFilter: false,
          pauseBeforeBriefing: false,
          enableScorePostProcessing: false,
          maxDeepAnalysis: 1,
          finalOutputCount: 1,
          daysBack: 1,
          scoringBatchSize: 5,
          maxCorrections: 0,
          maxRetries: 0,
          categoriesToScore: ['YES', 'MAYBE'],
          scoringConcurrency: 1,
          pdfAnalysisConcurrency: 1,
        },
        feedback: { events: [] },
        saveBriefing: null,
        briefingHistory: [],
      },
      password: 'pw',
    });
    const sent = [];
    global.fetch = vi.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      sent.push({ url, criteria: body.scoringCriteria });
      if (url.includes('/api/score-abstracts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            rawResponse: JSON.stringify(
              body.papers.map((_, i) => ({ paperIndex: i + 1, score: 7, justification: 'Fits.' }))
            ),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          analysis: {
            summary: 'A summary long enough to pass the validation checks.',
            keyFindings: 'Findings long enough to pass the validation checks.',
            methodology: 'Methods long enough to pass the validation checks.',
            limitations: 'Limits long enough to pass the validation checks.',
            relevanceAssessment: 'Relevance long enough to pass the validation checks.',
            updatedScore: 7,
          },
        }),
      };
    });
    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });
    await pipeline.startProcessing(false, true);

    const expected = `I study flows.\n\n${NOTES_HEADING}\n- Benchmark-only papers count as adjacent.`;
    expect(sent.some((s) => s.url.includes('/api/score-abstracts'))).toBe(true);
    expect(sent.some((s) => s.url.includes('/api/analyze-pdf'))).toBe(true);
    const stageCalls = sent.filter((s) => /\/api\/(score-abstracts|analyze-pdf)$/.test(s.url));
    expect(stageCalls.length).toBeGreaterThanOrEqual(2);
    for (const s of stageCalls) expect(s.criteria).toBe(expected);
  }
);

describe('podcast notes', () => {
  test('go into the focus prompt the reader pastes, and nowhere when there are none', async () => {
    const { buildFocusPrompt } = await import('../../../lib/notebooklm/buildFocusPrompt.js');
    const withNotes = buildFocusPrompt({}, 15, { notes: ['Keep the pace brisk.'] });
    expect(withNotes).toContain("## The listener's notes");
    expect(withNotes).toContain('- Keep the pace brisk.');
    expect(buildFocusPrompt({}, 15)).toBe(buildFocusPrompt({}, 15, { notes: [] }));
    expect(buildFocusPrompt({}, 15)).not.toContain("listener's notes");
  });
});
