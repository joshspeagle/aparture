import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aparture',
  description: 'Multi-stage research paper discovery and analysis using LLMs',

  // GitHub Pages deployment base path (set to '/' for custom domain)
  base: '/aparture/',

  ignoreDeadLinks: [
    // Ignore localhost URLs (examples in documentation)
    /^https?:\/\/localhost/
  ],

  // Vite configuration to prevent loading parent PostCSS config
  vite: {
    css: {
      postcss: null
    }
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/installation' },
      { text: 'Guide', link: '/user-guide/web-interface' },
      { text: 'API', link: '/api-reference/commands' }
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Setup', link: '/getting-started/setup' },
            { text: 'Quick Start', link: '/getting-started/quick-start' }
          ]
        }
      ],
      '/user-guide/': [
        {
          text: 'User Guide',
          items: [
            { text: 'Web Interface', link: '/user-guide/web-interface' },
            { text: 'CLI Automation', link: '/user-guide/cli-automation' },
            { text: 'Testing', link: '/user-guide/testing' },
            { text: 'Reports & Outputs', link: '/user-guide/reports' }
          ]
        }
      ],
      '/concepts/': [
        {
          text: 'Concepts',
          items: [
            { text: 'Multi-Stage Analysis', link: '/concepts/multi-stage-analysis' },
            { text: 'arXiv Categories', link: '/concepts/arxiv-categories' },
            { text: 'Model Selection', link: '/concepts/model-selection' },
            { text: 'NotebookLM Integration', link: '/concepts/notebooklm' }
          ]
        }
      ],
      '/api-reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'CLI Commands', link: '/api-reference/commands' },
            { text: 'Configuration', link: '/api-reference/configuration' },
            { text: 'Environment Variables', link: '/api-reference/environment' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/joshspeagle/aparture' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Josh Speagle. Created in collaboration with Claude.'
    },

    search: {
      provider: 'local'
    }
  }
})
