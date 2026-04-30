import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseAtomEntry } from '../../../lib/arxiv/parseAtomEntry.js';

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2604.01234v1</id>
    <title>Sample Paper Title</title>
    <summary>Abstract body.</summary>
    <author><name>Alice Author</name></author>
    <author><name>Bob Builder</name></author>
    <published>2026-04-01T00:00:00Z</published>
    <updated>2026-04-02T00:00:00Z</updated>
    <category term="cs.AI"/>
    <category term="cs.LG"/>
  </entry>
</feed>`;

function parseFirstEntry(xml) {
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  return dom.window.document.getElementsByTagName('entry')[0];
}

describe('parseAtomEntry', () => {
  it('parses a well-formed entry', () => {
    const entry = parseFirstEntry(SAMPLE_FEED);
    const paper = parseAtomEntry(entry, 'cs.AI');
    expect(paper.id).toBe('2604.01234');
    expect(paper.title).toBe('Sample Paper Title');
    expect(paper.abstract).toBe('Abstract body.');
    expect(paper.authors).toEqual(['Alice Author', 'Bob Builder']);
    expect(paper.published).toBe('2026-04-01T00:00:00Z');
    expect(paper.updated).toBe('2026-04-02T00:00:00Z');
    expect(paper.categories).toEqual(['cs.AI', 'cs.LG']);
    expect(paper.pdfUrl).toBe('https://export.arxiv.org/pdf/2604.01234.pdf');
    expect(paper.fetchedCategory).toBe('cs.AI');
  });

  it('strips version suffix from id', () => {
    const entry = parseFirstEntry(SAMPLE_FEED.replace('2604.01234v1', '2604.01234v3'));
    expect(parseAtomEntry(entry, 'cs.AI').id).toBe('2604.01234');
  });

  it('returns null for entry without an id', () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>x</title></entry></feed>`;
    const entry = parseFirstEntry(xml);
    expect(parseAtomEntry(entry, 'cs.AI')).toBeNull();
  });

  it('handles missing optional fields gracefully', () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2604.99999v1</id>
  </entry>
</feed>`;
    const entry = parseFirstEntry(xml);
    const paper = parseAtomEntry(entry, 'cs.AI');
    expect(paper.id).toBe('2604.99999');
    expect(paper.title).toBe('');
    expect(paper.abstract).toBe('');
    expect(paper.authors).toEqual([]);
    expect(paper.categories).toEqual([]);
  });
});
