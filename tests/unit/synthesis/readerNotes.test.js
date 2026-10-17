import { describe, it, expect } from 'vitest';
import {
  MAX_READER_NOTES,
  normalizeReaderNotes,
  renderReaderNotesSection,
} from '../../../lib/synthesis/readerNotes.js';

describe('renderReaderNotesSection', () => {
  it('renders nothing when there are no usable notes', () => {
    expect(renderReaderNotesSection(undefined)).toBe('');
    expect(renderReaderNotesSection([])).toBe('');
    expect(renderReaderNotesSection(['   ', 42, null])).toBe('');
  });

  it('renders a labelled instruction block with each note quoted', () => {
    const out = renderReaderNotesSection([
      'Lead with the diffusion-models cluster.',
      ' More methodology depth please. ',
    ]);
    expect(out.startsWith("\n\n# The reader's notes for this briefing\n")).toBe(true);
    expect(out).toMatch(/Treat them as editorial instructions/);
    expect(out).toMatch(/do not override the hard constraints or the sourcing discipline/);
    expect(out).toContain('- "Lead with the diffusion-models cluster."');
    expect(out).toContain('- "More methodology depth please."');
  });

  it('keeps the most recent notes and clips very long ones', () => {
    const many = Array.from({ length: MAX_READER_NOTES + 3 }, (_, i) => `note ${i}`);
    const kept = normalizeReaderNotes(many);
    expect(kept).toHaveLength(MAX_READER_NOTES);
    expect(kept[kept.length - 1]).toBe(`note ${MAX_READER_NOTES + 2}`);
    expect(normalizeReaderNotes(['x'.repeat(5000)])[0].length).toBeLessThan(1100);
    expect(normalizeReaderNotes('a single string note')).toEqual(['a single string note']);
  });
});
