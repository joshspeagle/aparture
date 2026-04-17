import { describe, it, expect } from 'vitest';
import { composeFullReport } from '../../../lib/analyzer/composeFullReport.js';

describe('composeFullReport', () => {
  it('concatenates all five deepAnalysis fields with H2 headings', () => {
    const paper = {
      deepAnalysis: {
        summary: 'A multi-paragraph summary.\n\nSecond paragraph.',
        keyFindings: 'The findings.',
        methodology: 'The method.',
        limitations: 'The limits.',
        relevanceAssessment: 'Why it matters.',
      },
    };
    const out = composeFullReport(paper);
    expect(out).toContain('## Summary\n\nA multi-paragraph summary.');
    expect(out).toContain('## Key findings\n\nThe findings.');
    expect(out).toContain('## Methodology\n\nThe method.');
    expect(out).toContain('## Limitations\n\nThe limits.');
    expect(out).toContain('## Relevance\n\nWhy it matters.');
  });

  it('preserves section order: Summary → Key findings → Methodology → Limitations → Relevance', () => {
    const paper = {
      deepAnalysis: {
        summary: 'S',
        keyFindings: 'KF',
        methodology: 'M',
        limitations: 'L',
        relevanceAssessment: 'R',
      },
    };
    const out = composeFullReport(paper);
    const idx = (heading) => out.indexOf(heading);
    expect(idx('## Summary')).toBeLessThan(idx('## Key findings'));
    expect(idx('## Key findings')).toBeLessThan(idx('## Methodology'));
    expect(idx('## Methodology')).toBeLessThan(idx('## Limitations'));
    expect(idx('## Limitations')).toBeLessThan(idx('## Relevance'));
  });

  it('skips missing fields without producing empty headings', () => {
    const paper = {
      deepAnalysis: {
        summary: 'Only summary.',
        // other fields absent
      },
    };
    const out = composeFullReport(paper);
    expect(out).toBe('## Summary\n\nOnly summary.');
    expect(out).not.toContain('## Key findings');
    expect(out).not.toContain('## Methodology');
  });

  it('falls back to detailedSummary when deepAnalysis is absent', () => {
    const out = composeFullReport({ detailedSummary: 'Legacy cached summary text.' });
    expect(out).toBe('Legacy cached summary text.');
  });

  it('falls back to pdfAnalysis.summary when deepAnalysis is absent', () => {
    const out = composeFullReport({ pdfAnalysis: { summary: 'Older field.' } });
    expect(out).toBe('Older field.');
  });

  it('falls back to analysis when other legacy fields are absent', () => {
    const out = composeFullReport({ analysis: 'Oldest field.' });
    expect(out).toBe('Oldest field.');
  });

  it('returns empty string when nothing is available', () => {
    expect(composeFullReport({})).toBe('');
    expect(composeFullReport({ deepAnalysis: {} })).toBe('');
  });

  it('handles null or undefined paper without throwing', () => {
    expect(composeFullReport(null)).toBe('');
    expect(composeFullReport(undefined)).toBe('');
  });

  it('prefers deepAnalysis over legacy fields when both present', () => {
    const paper = {
      deepAnalysis: { summary: 'New.' },
      detailedSummary: 'Legacy.',
      pdfAnalysis: { summary: 'Legacy.' },
      analysis: 'Legacy.',
    };
    const out = composeFullReport(paper);
    expect(out).toContain('New.');
    expect(out).not.toContain('Legacy.');
  });
});
