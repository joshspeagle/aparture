// The full read names a key figure; the route crops it from the PDF it
// already holds and stores it under the reports dir. A miss costs the
// figure, never the analysis.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import handler from '../../pages/api/analyze-pdf.js';

const fixturesDir = path.resolve(__dirname, '../fixtures/llm');
const FIGURE_PDF_B64 = fs
  .readFileSync(path.resolve(__dirname, '../fixtures/pdf/figure.pdf'))
  .toString('base64');

let reportsDir;

beforeEach(() => {
  reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aparture-figures-'));
  process.env.APARTURE_REPORTS_DIR = reportsDir;
  process.env.ACCESS_PASSWORD = 'test-pw';
  process.env.APARTURE_TEST_PDF_OVERRIDE = 'ANALYZE_PDF_TEST_PDF_FIXTURE';
});

afterEach(() => {
  delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;
  delete process.env.APARTURE_TEST_PDF_OVERRIDE;
  fs.rmSync(reportsDir, { recursive: true, force: true });
});

async function analyze(promptOverride, arxivId = '2504.00001') {
  process.env.APARTURE_TEST_PROMPT_OVERRIDE = promptOverride;
  const state = {};
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(data) {
      state.body = data;
      return this;
    },
  };
  await handler(
    {
      method: 'POST',
      body: {
        password: 'test-pw',
        apiKey: 'test-key',
        pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
        arxivId,
        scoringCriteria: 'I study population inference.',
        originalScore: 7,
        model: 'claude-haiku-4.5',
        _testPdfBase64: FIGURE_PDF_B64,
        callModelMode: { mode: 'fixture', fixturesDir },
      },
    },
    res
  );
  return state;
}

describe('analyze-pdf key figure', () => {
  it('crops the named figure and stores it with the caption from the PDF', async () => {
    const { statusCode, body } = await analyze('ANALYZE_PDF_FIGURE_FIXTURE');
    expect(statusCode).toBe(200);
    expect(body.analysis.keyFigure).toBe('Figure 1');
    expect(body.analysis.figure).toEqual({
      label: 'Figure 1',
      caption:
        'Figure 1. Recovered population versus the injected one, for every bin of the survey.',
      page: 1,
    });
    const png = fs.readFileSync(path.join(reportsDir, 'figures', '2504.00001.png'));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    const meta = JSON.parse(
      fs.readFileSync(path.join(reportsDir, 'figures', '2504.00001.json'), 'utf8')
    );
    expect(meta).toMatchObject({ arxivId: '2504.00001', label: 'Figure 1', page: 1 });
  });

  it('a figure the PDF does not have leaves the analysis intact', async () => {
    const { statusCode, body } = await analyze('ANALYZE_PDF_FIGURE_MISSING_FIXTURE');
    expect(statusCode).toBe(200);
    expect(body.analysis.summary).toEqual(expect.any(String));
    expect(body.analysis.figure).toBeNull();
    expect(fs.existsSync(path.join(reportsDir, 'figures'))).toBe(false);
  });

  it('an answer without a key figure crops nothing', async () => {
    const { statusCode, body } = await analyze('ANALYZE_PDF_TEST_FIXTURE');
    expect(statusCode).toBe(200);
    expect(body.analysis.keyFigure).toBeNull();
    expect(body.analysis.figure).toBeNull();
  });

  it('an id that cannot name a file stores nothing', async () => {
    const { statusCode, body } = await analyze('ANALYZE_PDF_FIGURE_FIXTURE', '../../etc');
    expect(statusCode).toBe(200);
    expect(body.analysis.figure).toBeNull();
    expect(fs.existsSync(path.join(reportsDir, 'figures'))).toBe(false);
  });
});
