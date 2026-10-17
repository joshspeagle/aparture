import { describe, it, expect } from 'vitest';
import { renderCheckCorpus } from '../../../lib/synthesis/checkCorpus.js';

// The hallucination check used to see full reports cut at 4000 characters
// and no scoring justification or user comments, while the writer saw all of
// them — so grounded claims read as unsupported (audit P2-6 / L4, L12).
describe('renderCheckCorpus — the auditor sees what the writer saw', () => {
  const report =
    '## Summary\n\n' +
    'x'.repeat(5000) +
    '\n\n## Limitations\n\nThe speedup vanishes beyond 512 dimensions.';
  const paper = {
    arxivId: '2610.00001',
    title: 'Conditional Mean Flows',
    score: 8.4,
    abstract: 'We propose conditional mean flows.',
    scoringJustification: 'Matches the profile’s simulation-based inference focus.',
    fullReport: report,
    quickSummary: 'A 5000-fold speedup on every benchmark.',
    engagement: { starred: true, dismissed: false, comments: ['skeptical of the evaluation'] },
  };

  it('includes the full report untruncated, so late sections stay checkable', () => {
    const out = renderCheckCorpus([paper]);
    expect(out).toContain('The speedup vanishes beyond 512 dimensions.');
    expect(out).not.toContain('[...truncated]');
  });

  it('includes the scoring justification, score and the user’s engagement', () => {
    const out = renderCheckCorpus([paper]);
    expect(out).toContain(
      'Scoring justification: Matches the profile’s simulation-based inference focus.'
    );
    expect(out).toContain('Relevance score: 8.4');
    expect(out).toContain('User engagement: starred');
    expect(out).toContain('User comments:\n    - skeptical of the evaluation');
  });

  it('leaves out quick summaries, which the writer never saw', () => {
    expect(renderCheckCorpus([paper])).not.toContain('5000-fold');
  });

  it('renders an empty corpus explicitly', () => {
    expect(renderCheckCorpus([])).toBe('(no papers)');
  });
});
