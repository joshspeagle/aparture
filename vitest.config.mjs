import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Two projects, split by environment. jsdom setup dominates suite wall time
// (~1s of environment bootstrap per file), and the majority of the suite is
// pure-Node unit/integration code that never touches the DOM or
// localStorage — those run under the (near-free) node environment.
//
// Membership rules:
//   - node: pure-Node dirs (lib/route/unit/integration tests), MINUS the
//     explicit DOM/localStorage exceptions listed below.
//   - jsdom: React component tests, hook tests, store tests, plus the
//     exceptions.
// A new test file must match exactly one project or it will NOT run —
// tests/all-tests-covered is asserted by the file counts in CI reviews, so
// when adding a new top-level test dir, add its glob to one project.

// Files inside node-glob dirs that DO need a DOM or localStorage:
// (test file or module under test uses document/DOMParser/localStorage).
const NODE_PROJECT_EXCEPTIONS = [
  'tests/unit/analyzer/exportReport.test.js', // document.createElement anchor download
  'tests/unit/arxiv/cache.test.js', // localStorage-backed cache
  'tests/unit/arxiv/parseOaiRecord.test.js', // global DOMParser
  'tests/unit/persistence/safeStorage.test.js', // window.localStorage
  'tests/integration/briefings-end-to-end.test.js', // renderHook + localStorage
  'tests/integration/arxiv/fetchAtom.test.js', // fetchAtom uses global DOMParser
  'tests/integration/arxiv/harvestOai.test.js', // harvestOai uses global DOMParser
  'tests/integration/arxiv/ingest.test.js', // localStorage cache + DOMParser drivers
];

const NODE_PROJECT_INCLUDE = [
  'tests/unit/analyzer/**/*.test.{js,jsx}',
  'tests/unit/arxiv/**/*.test.{js,jsx}',
  'tests/unit/auth/**/*.test.{js,jsx}',
  'tests/unit/briefing/**/*.test.{js,jsx}',
  'tests/unit/llm/**/*.test.{js,jsx}',
  'tests/unit/notebooklm/**/*.test.{js,jsx}',
  'tests/unit/persistence/**/*.test.{js,jsx}',
  'tests/unit/profile/**/*.test.{js,jsx}',
  'tests/unit/seenPapers/**/*.test.{js,jsx}',
  'tests/unit/session/**/*.test.{js,jsx}',
  'tests/unit/synthesis/**/*.test.{js,jsx}',
  'tests/unit/utils/**/*.test.{js,jsx}',
  'tests/unit/*.test.{js,jsx}',
  'tests/integration/**/*.test.{js,jsx}',
];

const JSDOM_PROJECT_INCLUDE = [
  'tests/component/**/*.test.{js,jsx}',
  'tests/unit/hooks/**/*.test.{js,jsx}',
  'tests/unit/stores/**/*.test.{js,jsx}',
  ...NODE_PROJECT_EXCEPTIONS,
];

const shared = {
  setupFiles: ['./tests/setup.js'],
  globals: true,
};

export default defineConfig({
  plugins: [react()],
  test: {
    ...shared,
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '.'),
          },
        },
        test: {
          ...shared,
          name: 'node',
          environment: 'node',
          include: NODE_PROJECT_INCLUDE,
          exclude: ['**/node_modules/**', ...NODE_PROJECT_EXCEPTIONS],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '.'),
          },
        },
        test: {
          ...shared,
          name: 'jsdom',
          environment: 'jsdom',
          include: JSDOM_PROJECT_INCLUDE,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
