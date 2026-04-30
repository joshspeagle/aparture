import { describe, it, expect } from 'vitest';
import { parseOaiRecord } from '../../../lib/arxiv/parseOaiRecord.js';

const buildRecordXml = (overrides = {}) => {
  const id = overrides.id ?? '2604.10001';
  const created = overrides.created ?? '2026-04-28';
  const updated = overrides.updated ?? '2026-04-29';
  const title = overrides.title ?? 'Sample Paper';
  const abstract = overrides.abstract ?? 'Abstract text.';
  const categories = overrides.categories ?? 'cs.AI cs.LG';
  const authors =
    overrides.authors ?? `<author><keyname>Author</keyname><forenames>Alice</forenames></author>`;
  return `<record>
  <header>
    <identifier>oai:arXiv.org:${id}</identifier>
    <datestamp>${updated}</datestamp>
    <setSpec>cs:cs:AI</setSpec>
  </header>
  <metadata>
    <arXiv xmlns="http://arxiv.org/OAI/arXiv/">
      <id>${id}</id>
      <created>${created}</created>
      <updated>${updated}</updated>
      <authors>${authors}</authors>
      <title>${title}</title>
      <abstract>${abstract}</abstract>
      <categories>${categories}</categories>
    </arXiv>
  </metadata>
</record>`;
};

function parseFirstRecord(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${xml}</root>`, 'text/xml');
  return doc.getElementsByTagName('record')[0];
}

describe('parseOaiRecord', () => {
  it('parses a well-formed record', () => {
    const record = parseFirstRecord(buildRecordXml());
    const paper = parseOaiRecord(record);

    expect(paper.id).toBe('2604.10001');
    expect(paper.title).toBe('Sample Paper');
    expect(paper.abstract).toBe('Abstract text.');
    expect(paper.authors).toEqual(['Alice Author']);
    expect(paper.published).toBe('2026-04-28');
    expect(paper.updated).toBe('2026-04-29');
    expect(paper.categories).toEqual(['cs.AI', 'cs.LG']);
    expect(paper.pdfUrl).toBe('https://arxiv.org/pdf/2604.10001');
    expect(paper.fetchedCategory).toBe('');
  });

  it('handles single author with only keyname', () => {
    const xml = buildRecordXml({
      authors: `<author><keyname>Solo</keyname></author>`,
    });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.authors).toEqual(['Solo']);
  });

  it('handles multiple categories separated by spaces', () => {
    const xml = buildRecordXml({ categories: 'cs.AI cs.LG stat.ML' });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.categories).toEqual(['cs.AI', 'cs.LG', 'stat.ML']);
  });

  it('returns null when <created> is missing', () => {
    const xml = buildRecordXml().replace(/<created>[^<]+<\/created>/, '');
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper).toBeNull();
  });

  it('returns null when <id> is missing', () => {
    const xml = buildRecordXml().replace(/<id>[^<]+<\/id>/, '');
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper).toBeNull();
  });

  it('normalizes whitespace in title and abstract', () => {
    const xml = buildRecordXml({
      title: '  Sample\n  Paper  ',
      abstract: '  Abstract  text.  ',
    });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.title).toBe('Sample Paper');
    expect(paper.abstract).toBe('Abstract text.');
  });

  it('parses a real fixture record', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const xml = fs.readFileSync(
      path.resolve('tests/fixtures/arxiv/oai-cs-2026-04-29-trimmed.xml'),
      'utf8'
    );
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const records = doc.getElementsByTagName('record');
    expect(records.length).toBeGreaterThan(0);
    const paper = parseOaiRecord(records[0]);
    expect(paper).not.toBeNull();
    expect(paper.id).toMatch(/^[0-9]+\.[0-9]+/);
    expect(paper.categories.length).toBeGreaterThan(0);
  });
});
