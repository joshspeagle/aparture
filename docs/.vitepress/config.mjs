import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aparture',
  description: 'Multi-stage research paper discovery and analysis using LLMs',

  // GitHub Pages deployment base path (set to '/' for custom domain)
  base: '/aparture/',

  // Enable dark mode toggle
  appearance: 'dark',

  ignoreDeadLinks: [
    // Ignore localhost URLs (examples in documentation)
    /^https?:\/\/localhost/
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Get Started', link: '/getting-started/install' },
      { text: 'Guide', link: '/using/reading-a-briefing' },
      { text: 'Concepts', link: '/concepts/pipeline' },
      { text: 'Reference', link: '/reference/environment' }
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Get Started',
          items: [
            { text: 'Install', link: '/getting-started/install' },
            { text: 'API keys', link: '/getting-started/api-keys', collapsed: false, items: [
              { text: 'Anthropic', link: '/getting-started/api-keys-anthropic' },
              { text: 'OpenAI',    link: '/getting-started/api-keys-openai' },
              { text: 'Google AI', link: '/getting-started/api-keys-google' },
            ] },
            { text: 'Verify your setup', link: '/getting-started/verify-setup' },
            { text: 'Your first briefing', link: '/getting-started/first-briefing' },
          ]
        }
      ],
      '/using/': [
        {
          text: 'Using Aparture',
          items: [
            { text: 'Reading a briefing',     link: '/using/reading-a-briefing' },
            { text: 'Giving feedback',        link: '/using/giving-feedback' },
            { text: 'Review gates',           link: '/using/review-gates' },
            { text: 'Writing a good profile', link: '/using/writing-a-profile' },
            { text: 'Refining over time',     link: '/using/refining-over-time' },
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
            { text: 'Reading a briefing',     link: '/using/reading-a-briefing' },
            { text: 'Giving feedback',        link: '/using/giving-feedback' },
            { text: 'Review gates',           link: '/using/review-gates' },
            { text: 'Writing a good profile', link: '/using/writing-a-profile' },
            { text: 'Refining over time',     link: '/using/refining-over-time' },
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
      copyright: 'Copyright © 2025 Josh Speagle. Created in collaboration with Claude.'
    },

    search: {
      provider: 'local'
    }
  }
})
