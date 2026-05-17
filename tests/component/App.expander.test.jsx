import { describe, it } from 'vitest';

// Full pipeline test is too entangled for a focused unit test; smoke verify via Phase 10 manual checks.
describe('Pre-briefing analyzed-but-cut expander', () => {
  it.todo('renders + Show N more when allAnalyzedPapers > finalRanking');
  it.todo('clicking expander reveals muted PaperCards for cut papers');
  it.todo('★ on cut paper promotes it into finalRanking');
});
