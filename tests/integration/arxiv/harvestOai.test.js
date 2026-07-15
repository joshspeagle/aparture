import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { harvestOai } from '../../../lib/arxiv/harvestOai.js';
import { ArxivThrottledError, ArxivParseError } from '../../../lib/arxiv/errors.js';

const TRIMMED_XML = fs.readFileSync(
  path.resolve('tests/fixtures/arxiv/oai-raw-listrecords-trimmed.xml'),
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
  <metadata><arXivRaw xmlns="http://arxiv.org/OAI/arXivRaw/">
    <id>${id}</id><submitter>A</submitter>
    <version version="v1"><date>Tue, 28 Apr 2026 12:00:00 GMT</date><size>100kb</size></version>
    <title>Title ${id}</title><authors>Alice Author</authors><abstract>Abs ${id}</abstract><categories>cs.AI</categories>
  </arXivRaw></metadata>
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

  it('spaces resumption pages with the injectable jittered helper (not a hardcoded 3000)', async () => {
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
        json: async () => ({ xml: buildPageXml(sampleRecord('B'), ''), resumptionToken: '' }),
      });
    const spacingMsImpl = vi.fn(() => 4321);
    const sleepImpl = vi.fn().mockResolvedValue();

    await harvestOai({ ...baseArgs, fetchImpl, sleepImpl, spacingMsImpl });

    // One spacing sleep between the two pages, using the jittered value.
    expect(spacingMsImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(4321);
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

  it('throws ArxivNetworkError on OAI <error code="badArgument"> envelope', async () => {
    // OAI embeds protocol errors inside HTTP-200 responses. Silently swallowing
    // them masks bugs (e.g. asking for a future `until` date returns 0 records
    // with a hidden `badArgument` and the caller can't tell it from "no data").
    const errorXml = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <error code="badArgument">until date too late</error>
</OAI-PMH>`;
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ xml: errorXml, resumptionToken: '' }),
    });

    await expect(harvestOai({ ...baseArgs, fetchImpl })).rejects.toThrow(/badArgument/);
  });

  it('treats <error code="noRecordsMatch"> as legitimate empty result', async () => {
    const noMatchXml = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListRecords>
    <error code="noRecordsMatch">no records</error>
  </ListRecords>
</OAI-PMH>`;
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ xml: noMatchXml, resumptionToken: '' }),
    });

    const records = await harvestOai({ ...baseArgs, fetchImpl });
    expect(records).toEqual([]);
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

  it('restarts the harvest once when an OAI error indicates the resumption token expired', async () => {
    // Page 1 returns 1 record + a resumption token; page 2 returns badResumptionToken;
    // the driver discards page 1's accumulated state and restarts from scratch (no token).
    // The restart returns 1 different record + no token, completing the harvest.
    const tokenExpiredXml = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <error code="badResumptionToken">expired</error>
</OAI-PMH>`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('PRE-EXPIRY'), 'expired-tok'),
          resumptionToken: 'expired-tok',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ xml: tokenExpiredXml, resumptionToken: '' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('AFTER-RESTART'), ''),
          resumptionToken: '',
        }),
      });

    const sleepImpl = vi.fn().mockResolvedValue();
    const records = await harvestOai({
      ...baseArgs,
      fetchImpl,
      sleepImpl,
      spacingMsImpl: () => 3333,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Pre-expiry record is discarded; restart's records are what we keep.
    expect(records.map((r) => r.id)).toEqual(['AFTER-RESTART']);
    // ToU spacing applies before the restart request too: one sleep between
    // page 1 and page 2 (resumption spacing), one before the restart.
    expect(sleepImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenLastCalledWith(3333);
    // The third call should be the restart (no resumptionToken, full set/from/until).
    const restartBody = JSON.parse(fetchImpl.mock.calls[2][1].body);
    expect(restartBody.resumptionToken).toBeUndefined();
    expect(restartBody.set).toBe('cs');
  });

  it('throws when the resumption token expires twice in a row', async () => {
    const tokenExpiredXml = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <error code="badResumptionToken">expired</error>
</OAI-PMH>`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('A'), 'tok'),
          resumptionToken: 'tok',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ xml: tokenExpiredXml, resumptionToken: '' }),
      })
      // After restart, page 1 hands out another token that page 2 says expired.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          xml: buildPageXml(sampleRecord('B'), 'tok2'),
          resumptionToken: 'tok2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ xml: tokenExpiredXml, resumptionToken: '' }),
      });

    await expect(
      harvestOai({ ...baseArgs, fetchImpl, sleepImpl: () => Promise.resolve() })
    ).rejects.toThrow(/expired/i);
  });

  it('skips a malformed record (no <version>) instead of aborting the harvest', async () => {
    // A record whose arXivRaw metadata has no <version> elements makes
    // parseOaiRecord throw ArxivParseError. One such record must not abort
    // the whole prefix harvest (which in auto mode would trip the circuit
    // breaker and degrade the run to Atom) — mirror the Atom path's
    // skip-and-warn per-entry guard.
    const malformedRecord = `<record>
  <header><identifier>oai:arXiv.org:2604.BROKEN</identifier><datestamp>2026-04-28</datestamp><setSpec>cs:cs:AI</setSpec></header>
  <metadata><arXivRaw xmlns="http://arxiv.org/OAI/arXivRaw/">
    <id>2604.BROKEN</id><submitter>B</submitter>
    <title>Broken record</title><authors>Bob Author</authors><abstract>Abs</abstract><categories>cs.AI</categories>
  </arXivRaw></metadata>
</record>`;
    const xml = buildPageXml(
      `${sampleRecord('2604.0001')}${malformedRecord}${sampleRecord('2604.0002')}`
    );
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ xml, resumptionToken: '' }),
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const statusCallback = vi.fn();

    const records = await harvestOai({ ...baseArgs, fetchImpl, statusCallback });

    // Good records on either side of the malformed one survive.
    expect(records.map((r) => r.id)).toEqual(['2604.0001', '2604.0002']);
    // The skip surfaces to the caller as a status warning.
    expect(statusCallback).toHaveBeenCalledWith(expect.stringMatching(/skipped 1 malformed/i));
    warnSpy.mockRestore();
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
