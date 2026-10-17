// Node runtime shims for running browser-shaped lib/ code headlessly.
//
// lib/arxiv parses OAI/Atom XML with the browser's DOMParser and reaches
// arXiv through the app's /api proxy routes. Under Node there is no
// DOMParser and no server, so this module installs jsdom's DOMParser and
// routes the proxy paths to the handlers in-process. Nothing here changes
// behavior inside the web app.

import { randomBytes } from 'node:crypto';
import { createRouteFetch } from './inProcessRoute.js';

let domReady = null;

export async function ensureDomParser() {
  if (typeof globalThis.DOMParser === 'function') return;
  domReady ??= import('jsdom').then(({ JSDOM }) => {
    const { window } = new JSDOM('');
    globalThis.DOMParser = window.DOMParser;
  });
  await domReady;
}

// The proxy routes require ACCESS_PASSWORD. In-process calls never leave
// this process, so a per-process random token satisfies the gate without
// asking the user to configure one for headless use.
export function headlessPassword() {
  if (!process.env.ACCESS_PASSWORD) {
    process.env.ACCESS_PASSWORD = randomBytes(24).toString('hex');
  }
  return process.env.ACCESS_PASSWORD;
}

export async function createArxivFetch() {
  const [{ default: harvestArxiv }, { default: fetchArxiv }] = await Promise.all([
    import('../../pages/api/harvest-arxiv.js'),
    import('../../pages/api/fetch-arxiv.js'),
  ]);
  return createRouteFetch({
    '/api/harvest-arxiv': harvestArxiv,
    '/api/fetch-arxiv': fetchArxiv,
  });
}
