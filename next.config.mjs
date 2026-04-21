import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Local-runtime directories that live in the working tree but should NEVER
// be watched (dev) or traced (build). They contain generated state, browser
// profiles, the VitePress site, and test fixtures — none of which the Next
// app needs to compile or serve. Without these excludes Turbopack/webpack's
// file watcher holds metadata for ~1 GB of irrelevant files (notebooklm-profile
// alone is 240+ MB) which blows dev memory past 3 GB.
const EXCLUDED_DIRS = [
  'reports',
  'temp',
  'docs',
  'cli',
  'tests',
  '.next',
  '.vercel',
  '.husky',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Anchor Turbopack to the repo root explicitly. Without this Next walks
  // up looking for a workspace lockfile and may pick the wrong ancestor
  // (the warning we saw when /mnt/c/Users/joshs/package.json was present).
  turbopack: {
    root: __dirname,
  },

  // Production build: tell the file tracer that serverless functions don't
  // need anything from these directories. Cuts both build time and the size
  // of the Vercel deployment.
  outputFileTracingExcludes: {
    '*': EXCLUDED_DIRS.map((d) => `${d}/**/*`),
  },

  // API routes load prompt templates via fs.readFile at request time. The
  // tracer usually catches these but we force-include the directory to be
  // safe across all routes that touch it (synthesize, check-briefing,
  // suggest-profile, analyze-pdf-quick, generate-notebooklm, loadRubricPrompt).
  outputFileTracingIncludes: {
    '/api/**': ['./prompts/**/*'],
  },

  // Webpack dev mode (`next dev --webpack`): exclude these directories from
  // the file watcher entirely. Without this webpack tracks every file in
  // reports/legacy/ (713 MB) and temp/notebooklm-profile/ (244 MB).
  //
  // Next.js's default `watchOptions.ignored` is a RegExp that already covers
  // `node_modules` and `.next`. We replace it wholesale with a string-array
  // glob list (webpack rejects mixed types) that includes the same defaults
  // plus our heavy local-runtime directories.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.next/**',
        '**/.git/**',
        ...EXCLUDED_DIRS.map((d) => `**/${d}/**`),
      ],
    };
    return config;
  },
};

export default nextConfig;
