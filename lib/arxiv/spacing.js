// Inter-request spacing for arXiv HTTP traffic.
//
// arXiv's stated floor is 1 req / 3 s. Deterministic 3000 ms back-to-back
// trips their sliding-window abuse heuristics more often than jittered
// spacing, so we jitter 3000–5000 ms between consecutive requests. This was
// originally inlined in pipeline.js; it was lost when fetching moved into
// lib/arxiv/ingest.js and is restored here as a shared, injectable helper.
//
// Injectable so unit tests can stub it (and not actually sleep 3–5 s):
// `ingest.harvest` accepts `spacingMsImpl` / `sleepImpl` deps that default
// to these.

export function arxivSpacingMs() {
  return 3000 + Math.floor(Math.random() * 2000);
}

export function arxivSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Page-style fetches (/pdf, /abs, /html) are crawler traffic, not API calls:
// arxiv.org/robots.txt sets `Crawl-delay: 15` for them. Used for the
// server-side PDF download throttle (lib/analyzer/rateLimit.js).
export const ARXIV_PAGE_DELAY_MS = 15_000;
