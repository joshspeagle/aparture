import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aparture',
  description: 'Multi-stage research paper discovery and analysis using LLMs',

  // GitHub Pages deployment base path (set to '/' for custom domain)
  base: '/aparture/',

  // Enable dark mode toggle
  appearance: 'dark',

  // Exclude gitignored local-only working directories from the build
  srcExclude: ['superpowers/**', 'node_modules/**'],

  ignoreDeadLinks: [
    // Ignore localhost URLs (examples in documentation)
    /^https?:\/\/localhost/
  ],

  themeConfig: {
    // Styled "Aparture" (with red "ar") is rendered by theme/Layout.vue via the
    // nav-bar-title-before slot. Default plain-text siteTitle is hidden.
    siteTitle: false,

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Setup', link: '/getting-started/install' },
      { text: 'Guide', link: '/using/first-briefing' },
      { text: 'Under the Hood', link: '/concepts/pipeline' },
      { text: 'Reference', link: '/reference/environment' }
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Setup',
          items: [
            { text: 'Install', link: '/getting-started/install' },
            { text: 'API keys', link: '/getting-started/api-keys', collapsed: false, items: [
              { text: 'Anthropic', link: '/getting-started/api-keys-anthropic' },
              { text: 'Google AI', link: '/getting-started/api-keys-google' },
              { text: 'OpenAI',    link: '/getting-started/api-keys-openai' },
            ] },
            { text: 'Verify your setup', link: '/getting-started/verify-setup' },
          ]
        }
      ],
      '/using/': [
        {
          text: 'Using Aparture',
          items: [
            { text: 'Your first briefing',    link: '/using/first-briefing' },
            { text: 'Reading a briefing',     link: '/using/reading-a-briefing' },
            { text: 'Giving feedback',        link: '/using/giving-feedback' },
            { text: 'Writing a good profile', link: '/using/writing-a-profile' },
            { text: 'Refining over time',     link: '/using/refining-over-time' },
            { text: 'Review gates',           link: '/using/review-gates' },
            { text: 'Tuning the pipeline',    link: '/using/tuning-the-pipeline' },
          ]
        },
        {
          text: 'Add-ons',
          items: [
            { text: 'Generating a podcast', link: '/add-ons/podcast' },
          ]
        }
      ],
      '/add-ons/': [
        // Mirror /using/ sidebar so add-ons URL keeps context
        {
          text: 'Using Aparture',
          items: [
            { text: 'Your first briefing',    link: '/using/first-briefing' },
            { text: 'Reading a briefing',     link: '/using/reading-a-briefing' },
            { text: 'Giving feedback',        link: '/using/giving-feedback' },
            { text: 'Writing a good profile', link: '/using/writing-a-profile' },
            { text: 'Refining over time',     link: '/using/refining-over-time' },
            { text: 'Review gates',           link: '/using/review-gates' },
            { text: 'Tuning the pipeline',    link: '/using/tuning-the-pipeline' },
          ]
        },
        {
          text: 'Add-ons',
          items: [
            { text: 'Generating a podcast', link: '/add-ons/podcast' },
          ]
        }
      ],
      '/concepts/': [
        {
          text: 'Under the Hood',
          items: [
            { text: 'The pipeline',     link: '/concepts/pipeline' },
            { text: 'Briefing anatomy', link: '/concepts/briefing-anatomy' },
            { text: 'Model selection',  link: '/concepts/model-selection' },
            { text: 'arXiv categories', link: '/concepts/arxiv-categories' },
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Environment variables', link: '/reference/environment' },
            { text: 'Prompt files',          link: '/reference/prompts' },
            { text: 'Troubleshooting',       link: '/reference/troubleshooting' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/joshspeagle/aparture' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025–2026 Josh Speagle. Created in collaboration with Claude.'
    },

    search: {
      provider: 'local'
    }
  }
})
