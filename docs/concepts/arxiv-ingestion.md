# arXiv ingestion

Aparture talks to arXiv via two paths. Most of the time you don't need to think about which one is active — Auto mode chooses the best available — but understanding the difference helps when you're tuning the pipeline or debugging a fetch issue.

## Two paths

- **OAI-PMH** is arXiv's officially-recommended bulk-harvest endpoint. It accepts a date range and a top-level "set" (e.g. `cs`, `stat`, `physics`) and returns every paper in that set tagged within the date range — one request covers all subcategories of a top-level group.
- **Atom** is the older `export.arxiv.org/api/query` endpoint. It only takes one subcategory at a time and lives in the rate-limit bucket arXiv applies to "expensive" queries.

When you select 8 cs.\* subcategories with OAI-PMH, that's a single request. With Atom, 8 separate requests. The advantage is most visible when you're harvesting many subcategories of the same domain.

## Ingestion mode

Settings → Advanced → "Ingestion mode":

- **Auto (recommended).** Default. Tries OAI-PMH first per top-level prefix. On any hard OAI failure (rate-limited, network, parse error after retries), trips a per-run circuit breaker — that prefix and every prefix after it falls back to Atom for the rest of the run. Resets at the start of each run.
- **OAI-PMH only.** Forces the new path. If OAI fails, the run fails. Useful for testing or for users who specifically want to avoid `/api/query` traffic.
- **Atom only.** Forces the legacy path. Useful as a kill-switch if OAI ever has an extended outage.

## Window semantics

OAI-PMH's date range filters on the _last-update_ date of an arXiv record, while Atom's `submittedDate:[…]` filters on the _original submission_ date. So a paper submitted in 2019 that gets a v2 today appears in OAI but not Atom.

The "Window semantics" toggle controls how we treat that difference:

- **Submitted only (default).** Filters OAI results to papers whose original submission date falls in the window. Matches Atom's behavior; reproducible briefings.
- **Include updates.** Keeps updated-but-not-newly-submitted papers. v2's of older papers show up as research news.

If you upgrade Aparture and notice you're suddenly seeing old papers in your briefings, the toggle is set to "Include updates" — flip it back.

## Fill-ups

If a niche subcategory returns very few papers from the broad fetch, the pipeline can issue narrow follow-up requests with extended date windows.

- **Min papers per subcategory.** Threshold below which fill-ups trigger. Default 5. Set to 0 to disable.
- **Fill-up lookback (days).** Cumulative extra-day extensions, e.g. `3, 7, 14` means: if the threshold isn't met from the initial fetch, fetch the slice covering days `-3` through original-from; if still not met, fetch days `-7` through `-4`; if still not met, days `-14` through `-8`. Stops as soon as the threshold is met. Empty disables fill-ups entirely.

Each step fetches only the _new outer slice_, so we don't re-download data we already have.

## Cache

Successful fetches are cached in your browser's localStorage so re-runs within the TTL skip arXiv entirely. Default TTL is 60 minutes. Setting it to 0 disables caching.

The cache key includes the ingestion mode, so OAI-only and Atom-only runs maintain separate cache namespaces. To clear the cache manually:

```js
localStorage.removeItem('aparture-arxiv-cache');
```

## Troubleshooting

If the pipeline reports `arXiv: auto-atom` and the run is much slower than usual, OAI-PMH likely failed for your run. Check the dev console for the specific error. Common causes:

- **Rate-limited.** arXiv's enforcement on `/api/query` (the Atom path that's now your fallback) is more aggressive than OAI-PMH's. Wait 30-60 minutes before re-running.
- **Network error.** Check `npm run dev` terminal logs for `harvest-arxiv proxy unreachable`.
- **Parse error.** Rare; usually a transient OAI response issue. Re-run.

You can force OAI-only mode to confirm OAI is healthy, or Atom-only mode to skip the new path entirely.
