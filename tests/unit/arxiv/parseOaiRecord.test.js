import { describe, it, expect } from 'vitest';
import { parseOaiRecord } from '../../../lib/arxiv/parseOaiRecord.js';
import { ArxivParseError } from '../../../lib/arxiv/errors.js';

const buildRecordXml = (overrides = {}) => {
  const id = overrides.id ?? '2604.10001';
  const versions = overrides.versions ?? [
    { seq: 'v1', date: 'Mon, 28 Apr 2026 12:00:00 GMT' },
    { seq: 'v2', date: 'Tue, 29 Apr 2026 12:00:00 GMT' },
  ];
  const title = overrides.title ?? 'Sample Paper';
  const abstract = overrides.abstract ?? 'Abstract text.';
  const categories = overrides.categories ?? 'cs.AI cs.LG';
  const authors = overrides.authors ?? 'Alice Author, Bob Builder';
  const versionXml = versions
    .map((v) => `<version version="${v.seq}"><date>${v.date}</date><size>1000kb</size></version>`)
    .join('');
  return `<record>
  <header>
    <identifier>oai:arXiv.org:${id}</identifier>
    <datestamp>2026-04-29</datestamp>
    <setSpec>cs:cs:AI</setSpec>
  </header>
  <metadata>
    <arXivRaw xmlns="http://arxiv.org/OAI/arXivRaw/">
      <id>${id}</id>
      <submitter>Alice Author</submitter>
      ${versionXml}
      <title>${title}</title>
      <authors>${authors}</authors>
      <categories>${categories}</categories>
      <abstract>${abstract}</abstract>
    </arXivRaw>
  </metadata>
</record>`;
};

function parseFirstRecord(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${xml}</root>`, 'text/xml');
  return doc.getElementsByTagName('record')[0];
}

describe('parseOaiRecord', () => {
  it('parses a well-formed record and uses v1 as published', () => {
    const record = parseFirstRecord(buildRecordXml());
    const paper = parseOaiRecord(record);

    expect(paper.id).toBe('2604.10001');
    expect(paper.title).toBe('Sample Paper');
    expect(paper.abstract).toBe('Abstract text.');
    expect(paper.authors).toEqual(['Alice Author', 'Bob Builder']);
    expect(paper.published).toBe('2026-04-28');
    expect(paper.updated).toBe('2026-04-29');
    expect(paper.categories).toEqual(['cs.AI', 'cs.LG']);
    expect(paper.pdfUrl).toBe('https://arxiv.org/pdf/2604.10001');
    expect(paper.fetchedCategory).toBe('');
  });

  it('regression: re-announced old paper exposes the v1 date, not the latest version', () => {
    // 2309.09550 was originally submitted 2023-09-18; v4 announced 2026-05-05.
    // Under the prior `arXiv` metadata format, <created> read 2026-05-05 and
    // silently passed `submitted-only` filtering for any 2026-05 window. With
    // arXivRaw we anchor `published` on v1, so the filter can correctly drop it.
    const xml = buildRecordXml({
      id: '2309.09550',
      versions: [
        { seq: 'v1', date: 'Mon, 18 Sep 2023 07:56:40 GMT' },
        { seq: 'v2', date: 'Sun, 08 Oct 2023 07:36:41 GMT' },
        { seq: 'v3', date: 'Mon, 28 Oct 2024 13:10:41 GMT' },
        { seq: 'v4', date: 'Tue, 05 May 2026 03:04:16 GMT' },
      ],
    });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.published).toBe('2023-09-18');
    expect(paper.updated).toBe('2026-05-05');
  });

  it('handles single author and no commas', () => {
    const xml = buildRecordXml({ authors: 'Solo Author' });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.authors).toEqual(['Solo Author']);
  });

  it('handles "and" in author list', () => {
    const xml = buildRecordXml({ authors: 'A First, B Second and C Third' });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.authors).toEqual(['A First', 'B Second', 'C Third']);
  });

  it('handles multiple categories separated by spaces', () => {
    const xml = buildRecordXml({ categories: 'cs.AI cs.LG stat.ML' });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper.categories).toEqual(['cs.AI', 'cs.LG', 'stat.ML']);
  });

  it('returns null when v1 version is missing', () => {
    const xml = buildRecordXml({
      versions: [{ seq: 'v2', date: 'Mon, 28 Apr 2026 12:00:00 GMT' }],
    });
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper).toBeNull();
  });

  it('returns null when <id> is missing', () => {
    const xml = buildRecordXml().replace(/<id>[^<]+<\/id>/, '');
    const paper = parseOaiRecord(parseFirstRecord(xml));
    expect(paper).toBeNull();
  });

  it('throws ArxivParseError when no <version> elements present at all', () => {
    const xml = buildRecordXml({ versions: [] });
    expect(() => parseOaiRecord(parseFirstRecord(xml))).toThrow(ArxivParseError);
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

  it('parses real arXivRaw fixture records', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const xml = fs.readFileSync(
      path.resolve('tests/fixtures/arxiv/oai-raw-listrecords-trimmed.xml'),
      'utf8'
    );
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const records = doc.getElementsByTagName('record');
    expect(records.length).toBe(2);

    const reAnnounced = parseOaiRecord(records[0]);
    expect(reAnnounced.id).toBe('2309.09550');
    expect(reAnnounced.published).toBe('2023-09-18');
    expect(reAnnounced.updated).toBe('2026-05-05');

    const old = parseOaiRecord(records[1]);
    expect(old.id).toBe('1810.06450');
    expect(old.published).toBe('2018-10-12');
    expect(old.updated).toBe('2019-05-26');
  });
});
