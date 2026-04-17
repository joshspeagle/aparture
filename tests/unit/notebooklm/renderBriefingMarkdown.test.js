import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderBriefingMarkdown } from '../../../lib/notebooklm/renderBriefingMarkdown.js';

const sample = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/briefing/sample-output.json'), 'utf8')
);

describe('renderBriefingMarkdown', () => {
  it('produces markdown with date header, executive summary, themes, and papers', () => {
    const md = renderBriefingMarkdown(sample, { date: '2026-04-16' });
    expect(md).toContain('# 2026-04-16 Briefing');
    expect(md).toContain('## Executive Summary');
    expect(md).toContain(sample.executiveSummary);
    expect(md).toContain('## Theme 1 — Interpretability converges on attention heads');
    expect(md).toContain('Papers: 2504.01234, 2504.02345');
    expect(md).toContain('## Papers');
    expect(md).toContain('### [P1] Circuit-level analysis of reasoning');
    expect(md).toContain('- arXiv: 2504.01234');
    expect(md).toContain('- Score: 9.2/10');
    expect(md).toContain('### [P2] Head pruning ablations');
  });

  it('handles briefing with no themes or papers gracefully', () => {
    const empty = { executiveSummary: 'Quiet day.', themes: [], papers: [] };
    const md = renderBriefingMarkdown(empty, { date: '2026-04-16' });
    expect(md).toContain('# 2026-04-16 Briefing');
    expect(md).toContain('Quiet day.');
    expect(md).not.toContain('## Theme 1');
    expect(md).not.toContain('## Papers');
  });
});
