import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Base recommended config
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'build/**',
      'dist/**',
      'reports/**',
      'temp/**',
      'coverage/**',
      // VitePress generated files
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/.temp/**',
      'docs/node_modules/**',
    ],
  },

  // Main configuration for all JS/JSX files
  {
    files: ['**/*.js', '**/*.jsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        DOMParser: 'readonly',
        XPathResult: 'readonly',
        AbortController: 'readonly',
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-prototype-builtins': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Overrides for CLI scripts (non-React files)
  {
    files: ['cli/**/*.js', 'cli/tests/**/*.js'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react/display-name': 'off',
      'no-unused-vars': 'warn',
    },
  },

  // Overrides for config files
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },

  // Apply Prettier config to disable conflicting rules (must be last)
  prettierConfig,
];
