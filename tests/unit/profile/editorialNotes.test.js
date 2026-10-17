import { describe, it, expect } from 'vitest';
import {
  MAX_NOTES_PER_SCOPE,
  NOTES_HEADING,
  applyNoteChanges,
  normalizeNotes,
  parseLearnedMarkdown,
  profileWithNotes,
  renderLearnedMarkdown,
  renderNotesForSuggest,
} from '../../../lib/profile/editorialNotes.js';

const note = (id, scope, text) => ({ id, scope, text, source: 'manual', createdAt: 1 });
const NOTES = [
  note('a', 'selection', 'Benchmark-only papers count as adjacent.'),
  note('b', 'writing', 'Open each theme with its result.'),
  note('c', 'podcast', 'Keep the pace brisk.'),
];

describe('profileWithNotes', () => {
  it('is byte-identical to the profile when the scope has no notes', () => {
    expect(profileWithNotes('My profile.\n', [], 'selection')).toBe('My profile.\n');
    expect(profileWithNotes('My profile.', [NOTES[1]], 'selection')).toBe('My profile.');
  });

  it("appends only that scope's notes, under the heading that says the profile wins", () => {
    const out = profileWithNotes('My profile.\n\n', NOTES, 'selection');
    expect(out).toBe(`My profile.\n\n${NOTES_HEADING}\n- Benchmark-only papers count as adjacent.`);
    expect(out).not.toContain('Open each theme');
    expect(profileWithNotes('P', NOTES, 'writing')).toContain('- Open each theme with its result.');
  });
});

describe('normalizeNotes', () => {
  it('drops malformed notes, unknown scopes and duplicate ids, and trims text', () => {
    const out = normalizeNotes([
      { id: 'x', scope: 'selection', text: '  Keep   this.  ' },
      { id: 'x', scope: 'writing', text: 'Same id.' },
      { id: 'y', scope: 'mood', text: 'Unknown scope.' },
      { id: 'z', scope: 'writing', text: '   ' },
      null,
    ]);
    expect(out.map((n) => n.text)).toEqual(['Keep this.', 'Same id.']);
    expect(out[1].id).not.toBe('x');
    expect(normalizeNotes('nope')).toEqual([]);
  });
});

describe('applyNoteChanges', () => {
  it('adds, revises and retires', () => {
    const out = applyNoteChanges(
      NOTES,
      [
        {
          action: 'add',
          scope: 'writing',
          text: 'Name the method in plain words.',
          rationale: 'r',
        },
        { action: 'revise', noteId: 'a', text: 'Benchmark-only papers are adjacent at best.' },
        { action: 'retire', noteId: 'c' },
      ],
      5
    );
    expect(out.map((n) => n.text)).toEqual([
      'Benchmark-only papers are adjacent at best.',
      'Open each theme with its result.',
      'Name the method in plain words.',
    ]);
    expect(out[0].editedAt).toBe(5);
    expect(out[2]).toMatchObject({ source: 'suggested', createdAt: 5, rationale: 'r' });
  });

  it('refuses an add past the scope limit and ignores unknown ids', () => {
    const full = Array.from({ length: MAX_NOTES_PER_SCOPE }, (_, i) =>
      note(`s${i}`, 'selection', `Note ${i}`)
    );
    const out = applyNoteChanges(full, [
      { action: 'add', scope: 'selection', text: 'One too many.' },
      { action: 'revise', noteId: 'nope', text: 'x' },
    ]);
    expect(out).toEqual(full);
  });
});

describe('renderNotesForSuggest', () => {
  it('lists every scope with ids and counts', () => {
    const out = renderNotesForSuggest(NOTES);
    expect(out).toContain(`Selection (1/${MAX_NOTES_PER_SCOPE}):\n- [a] Benchmark-only papers`);
    expect(out).toContain('Podcast (1/');
    expect(renderNotesForSuggest([])).toBe('(none yet)');
  });
});

describe('learned.md', () => {
  it('round-trips through the sectioned format', () => {
    const md = renderLearnedMarkdown(NOTES);
    expect(md).toContain('## Selection\n\n- Benchmark-only papers count as adjacent.');
    expect(parseLearnedMarkdown(md).map(({ scope, text }) => ({ scope, text }))).toEqual(
      NOTES.map(({ scope, text }) => ({ scope, text }))
    );
  });

  it('reads an older, unsectioned learned.md as selection notes', () => {
    const out = parseLearnedMarkdown('- prefers released code\n* skips benchmarks\n');
    expect(out.map((n) => [n.scope, n.text])).toEqual([
      ['selection', 'prefers released code'],
      ['selection', 'skips benchmarks'],
    ]);
  });
});
