import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { harvestOai } from '../../../lib/arxiv/harvestOai.js';
import {
  ArxivThrottledError,
  ArxivNetworkError,
  ArxivParseError,
} from '../../../lib/arxiv/errors.js';

const TRIMMED_XML = fs.readFileSync(
  path.resolve('tests/fixtures/arxiv/oai-cs-2026-04-29-trimmed.xml'),
  'utf8'
);

const buildPageXml = (records, resumptionToken = '') => `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListRecords>
    ${records}
    <resumptionToken>${resumptionToken}</resumptionToken>
  </ListRecords>
</OAI-PMH>`;

const sampleRecord = (id) => `<record>
  <header><identifier>oai:arXiv.org:${id}</identifier><datestamp>2026-04-28</datestamp><setSpec>cs:cs:AI</setSpec></header>
  <metadata><arXiv xmlns="http://arxiv.org/OAI/arXiv/">
    <id>${id}</id><created>2026-04-28</created><updated>2026-04-28</updated>
    <authors><author><keyname>Author</keyname><forenames>A</forenames></author></authors>
    <title>Title ${id}</title><abstract>Abs ${id}</abstract><categories>cs.AI</categories>
  </arXiv></metadata>
</record>`;

const baseArgs = {
  set: 'cs',
  from: '2026-04-28',
  until: '2026-04-29',
  password: 'pw',
  abortSignal: { aborted: false },
};

describe('harvestOai', () => {
  it('returns parsed records on a single-page response', async () => {
    const xml = buildPageXml(sampleRecord('2604.0001'));
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ xml, resumptionToken: '' }),
    });

    const records = await harvestOai({ ...baseArgs, fetchImpl });
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('2604.0001');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows resumption tokens across pages', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('A'), 'token-1'),
          resumptionToken: 'token-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('B'), ''),
          resumptionToken: '',
        }),
      });

    const records = await harvestOai({
      ...baseArgs,
      fetchImpl,
      sleepImpl: () => Promise.resolve(),
    });

    expect(records.map((r) => r.id)).toEqual(['A', 'B']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(secondBody.resumptionToken).toBe('token-1');
  });

  it('retries on 429 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate limit', upstreamStatus: 429, retryAfter: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ xml: buildPageXml(sampleRecord('A')), resumptionToken: '' }),
      });

    const records = await harvestOai({
      ...baseArgs,
      fetchImpl,
      sleepImpl: () => Promise.resolve(),
    });
    expect(records).toHaveLength(1);
  });

  it('throws ArxivThrottledError after retries are exhausted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate limit', upstreamStatus: 429 }),
    });

    await expect(
      harvestOai({ ...baseArgs, fetchImpl, sleepImpl: () => Promise.resolve() })
    ).rejects.toBeInstanceOf(ArxivThrottledError);
  });

  it('throws ArxivParseError on malformed XML', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ xml: '<not valid OAI', resumptionToken: '' }),
    });

    await expect(harvestOai({ ...baseArgs, fetchImpl })).rejects.toBeInstanceOf(ArxivParseError);
  });

  it('aborts mid-pagination and returns no records', async () => {
    const signal = { aborted: false };
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      signal.aborted = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('A'), 'tok'),
          resumptionToken: 'tok',
        }),
      };
    });

    await expect(
      harvestOai({
        ...baseArgs,
        abortSignal: signal,
        fetchImpl,
        sleepImpl: () => Promise.resolve(),
      })
    ).rejects.toThrow(/aborted/i);
  });

  it('parses the trimmed fixture without errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ xml: TRIMMED_XML, resumptionToken: '' }),
    });

    const records = await harvestOai({ ...baseArgs, fetchImpl });
    expect(records.length).toBeGreaterThan(0);
  });
});
