# arXiv ingestion

Aparture harvests metadata from arXiv through a two-tier architecture that pairs arXiv's bulk OAI-PMH endpoint with an automatic fallback to the legacy Atom query API. In standard operation, Auto mode selects the optimal path automatically, while understanding how date windows, subcategory fill-ups, and caching work helps when tuning category coverage or diagnosing network errors.

## OAI-PMH and Atom harvesting paths {#two-paths}

- **OAI-PMH (`arXivRaw`)**: Serves as arXiv's officially recommended bulk-harvest protocol. A single OAI-PMH request accepts a date range and a top-level archive set (such as `cs`, `stat`, or `physics`) and returns all records in that archive updated within the window, covering every selected subcategory under that prefix in one query.
- **Atom (`export.arxiv.org/api/query`)**: Serves as the legacy search endpoint. Because the Atom API queries one subcategory at a time and shares arXiv's rate-limit bucket for interactive search queries, harvesting eight `cs.*` subcategories requires eight separate serial requests under Atom compared to a single bulk harvest under OAI-PMH.

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 720 430" style="width: 100%; height: auto; max-width: 720px; display: block; margin: 0 auto;" role="img" aria-label="arXiv ingestion architecture showing the localStorage TTL cache, OAI-PMH arXivRaw v1 anchor harvest, subcategory fill-up hydration slices, and circuit-breaker fallback to the Atom API">
    <defs>
      <marker id="ai-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-text-3)" />
      </marker>
      <marker id="ai-arrow-brand" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-brand-1)" />
      </marker>
    </defs>
    <rect x="40" y="14" width="640" height="52" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="37" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">1. Local Cache Lookup (aparture-arxiv-cache)</text>
    <text x="60" y="55" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Keyed by archive set/category, date range, mode, and window semantics (default 60 min TTL)</text>
    <line x1="230" y1="66" x2="230" y2="92" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#ai-arrow)" />
    <text x="242" y="83" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-2)">cache miss</text>
    <rect x="40" y="94" width="380" height="82" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="58" y="118" font-family="var(--vp-font-family-mono)" font-size="12" font-weight="700" fill="var(--vp-c-text-1)">2a. Primary: OAI-PMH Bulk Harvest (arXivRaw)</text>
    <text x="58" y="138" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">One request per top-level set (cs, stat, physics, astro-ph)</text>
    <text x="58" y="156" font-family="var(--vp-font-family-base)" font-size="11" fill="var(--vp-c-text-2)">Widens query by 7 days, finds latest v1 anchor, keeps daysBack</text>
    <path d="M 420 135 L 458 135" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#ai-arrow-brand)" />
    <rect x="460" y="94" width="220" height="82" rx="8" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.6" />
    <text x="472" y="118" font-family="var(--vp-font-family-mono)" font-size="11" font-weight="700" fill="var(--vp-c-brand-1)">2b. Circuit-Breaker Fallback</text>
    <text x="472" y="138" font-family="var(--vp-font-family-base)" font-size="11" fill="var(--vp-c-text-1)">On hard OAI error, switches prefix</text>
    <text x="472" y="154" font-family="var(--vp-font-family-base)" font-size="11" fill="var(--vp-c-text-1)">and remaining sets to Atom API</text>
    <text x="472" y="169" font-family="var(--vp-font-family-mono)" font-size="10.5" fill="var(--vp-c-text-2)">(export.arxiv.org/api/query)</text>
    <line x1="230" y1="176" x2="230" y2="206" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#ai-arrow)" />
    <path d="M 570 176 L 570 192 L 360 192 L 360 206" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5" marker-end="url(#ai-arrow-brand)" />
    <rect x="40" y="208" width="640" height="92" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="60" y="232" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="700" fill="var(--vp-c-text-1)">3. Subcategory Fill-Up Hydration (when count &lt; minPapersPerSubcategory, default 5)</text>
    <text x="60" y="252" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Fetches incremental non-overlapping outer slices back from the anchored window until threshold is met:</text>
    <rect x="60" y="262" width="175" height="26" rx="5" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" stroke-width="1" />
    <text x="147" y="279" font-family="var(--vp-font-family-mono)" font-size="11.5" fill="var(--vp-c-text-1)" text-anchor="middle">Slice 1: days -3 to -1</text>
    <rect x="255" y="262" width="175" height="26" rx="5" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" stroke-width="1" />
    <text x="342" y="279" font-family="var(--vp-font-family-mono)" font-size="11.5" fill="var(--vp-c-text-1)" text-anchor="middle">Slice 2: days -7 to -4</text>
    <rect x="450" y="262" width="190" height="26" rx="5" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" stroke-width="1" />
    <text x="545" y="279" font-family="var(--vp-font-family-mono)" font-size="11.5" fill="var(--vp-c-text-1)" text-anchor="middle">Slice 3: days -14 to -8</text>
    <line x1="360" y1="300" x2="360" y2="328" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#ai-arrow)" />
    <rect x="40" y="330" width="640" height="82" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="60" y="354" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">4. Cross-Category Deduplication &amp; 90-Day Seen-Papers Filter</text>
    <text x="60" y="374" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Merges cross-listings, caches raw harvest in localStorage, and applies 90-day seen-papers index</text>
    <text x="60" y="394" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="600" fill="var(--vp-c-brand-1)">Status reported as: arXiv: auto-oai | auto-mixed | auto-atom</text>
  </svg>
</div>

## Ingestion mode

Under **Settings → Advanced → Ingestion mode**, you can select how Aparture routes arXiv metadata requests:

- **Auto (recommended)**: Serves as the default mode. Aparture queries OAI-PMH first for each top-level archive prefix. If any prefix encounters an unrecoverable OAI-PMH failure (rate limiting, network failure, or XML parse error after retries), a per-run circuit breaker trips so that the failed prefix and any remaining prefixes in that run fall back automatically to the Atom API. The circuit breaker resets at the start of the next run.
- **OAI-PMH only**: Forces all harvesting through the OAI-PMH endpoint and halts the run if OAI-PMH is unreachable, which is useful when testing OAI-PMH connectivity or avoiding `/api/query` traffic entirely.
- **Atom only**: Forces all requests through the legacy `/api/query` endpoint, serving as a manual override if OAI-PMH experiences an extended upstream outage.

## Window semantics

Because OAI-PMH filters records by their most recent metadata or version update date (`datestamp`), whereas the Atom API's `submittedDate:[…]` query filters by the initial `v1` submission date, a paper originally submitted in 2019 that posts a `v2` revision today appears in a raw OAI-PMH harvest.

The **Window semantics** setting under Advanced Options controls how Aparture handles revised versions:

- **Submitted only (default)**: Retains only OAI-PMH records whose original `v1` submission timestamp (`arXivRaw` version history) falls within the target submission window, matching Atom's submission-date semantics and producing reproducible daily briefings.
- **Include updates**: Retains both newly submitted `v1` preprints and revised versions (`v2`, `v3`, and higher) of older papers updated within the window.

If you notice older preprints appearing in your briefing after changing settings, verify that **Window semantics** is set to **Submitted only**.

## How many days a run covers

The `daysBack` parameter (default 1) counts active arXiv announcement days rather than calendar days. Because arXiv batches announcements on weekday evenings and pauses over weekends and holidays, the most recent calendar date often has zero announcements when you start a run:

- **Under Submitted only**: Aparture requests an OAI-PMH window starting 7 calendar days prior to your target range to absorb weekend and holiday gaps, identifies the most recent `v1` submission date across your selected categories as the **anchor date**, and keeps all papers whose `v1` date falls within the `daysBack` submission days ending on that anchor. This anchoring guarantees that weekend and Monday-morning runs return the most recent announcement batch rather than an empty list.
- **Under Include updates**: Aparture queries the trailing `daysBack` calendar days directly without 7-day widening or `v1` anchoring, passing through all new submissions and version updates in that interval.

When the Atom fallback path executes, arXiv filters `submittedDate` server-side, so Aparture queries the target window directly.

## Fill-ups

When a lower-volume subcategory returns fewer than `minPapersPerSubcategory` papers from the initial anchored window, Aparture issues targeted follow-up queries across progressively wider lookback slices for that subcategory alone:

- **Min papers per subcategory**: Sets the minimum paper count below which fill-up queries trigger (default 5; set to `0` to disable fill-ups).
- **Fill-up lookback (days)**: Defines cumulative extra lookback horizons (default `3, 7, 14`). If a subcategory has fewer than 5 papers after the initial fetch, Aparture fetches the outer slice covering days `-3` through `-1` prior to the anchored window; if the count still remains below 5, it fetches days `-7` through `-4`, and finally days `-14` through `-8`, stopping as soon as the threshold is reached. Leaving this field empty disables fill-ups.

Because each fill-up step requests only the non-overlapping outer date slice counted backward from the anchored window, Aparture never re-downloads records already retrieved in earlier slices.

## Cache

Successful arXiv harvests are cached in browser `localStorage` under `aparture-arxiv-cache` so that repeating a run within the cache time-to-live (default TTL: 60 minutes; set to `0` to disable) skips network requests to arXiv altogether.

Cache entries are keyed by archive set (or subcategory), date range, and ingestion mode (`OAI-PMH` vs. `Atom`), and fill-up cache entries additionally key on window semantics (`Submitted only` vs. `Include updates`). To clear the harvest cache manually from the browser console, run:

```js
localStorage.removeItem('aparture-arxiv-cache');
```

## Troubleshooting

At the end of Stage 1, the run status line reports which harvesting path executed: `arXiv: auto-oai` (all sets succeeded via OAI-PMH), `auto-mixed` (initial sets succeeded via OAI-PMH before a later set tripped the fallback), or `auto-atom` (all sets used the Atom fallback). If a run reports `auto-atom` and Stage 1 takes noticeably longer than usual, inspect the browser console and terminal output for the underlying OAI-PMH error:

- **Rate-limited**: The `/api/query` Atom fallback enforces stricter rate limits than OAI-PMH; if Atom also rate-limits your IP, wait 30 to 60 minutes before starting a new run.
- **Network error**: Seeing `harvest-arxiv proxy unreachable` in the browser console indicates that the client could not reach the local `/api/harvest-arxiv` Next.js API route, whereas seeing `OAI proxy network error` in the `npm run dev` terminal indicates that the local server could not reach `oaipmh.arxiv.org`.
- **Parse error**: Indicates a truncated or malformed upstream XML response from arXiv; re-running the fetch after a brief pause typically resolves it.

You can switch **Ingestion mode** temporarily to **OAI-PMH only** to test OAI-PMH health directly or to **Atom only** during an upstream OAI-PMH maintenance window.
