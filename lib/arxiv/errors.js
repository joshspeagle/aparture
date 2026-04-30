// Typed errors thrown by the arxiv ingestion drivers. The orchestrator
// (lib/arxiv/ingest.js) inspects error type to decide whether to trip the
// per-run circuit breaker. See spec §6.1.

export class ArxivThrottledError extends Error {
  constructor(message, { upstreamStatus, retryAfter } = {}) {
    super(message);
    this.name = 'ArxivThrottledError';
    this.upstreamStatus = upstreamStatus ?? null;
    this.retryAfter = retryAfter ?? null;
  }
}

export class ArxivNetworkError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'ArxivNetworkError';
    if (cause) this.cause = cause;
  }
}

export class ArxivParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArxivParseError';
  }
}

export class ArxivUnknownCategoryError extends Error {
  constructor(subcategory) {
    super(`Unknown arxiv category: ${subcategory} — add it to lib/arxiv/sets.js`);
    this.name = 'ArxivUnknownCategoryError';
    this.subcategory = subcategory;
  }
}
