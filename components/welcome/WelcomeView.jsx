// components/welcome/WelcomeView.jsx
// Persistent reference page explaining what Aparture is and how to get started.

import Card from '../ui/Card.jsx';
import { isUneditedProfile } from '../../lib/profile/starterTemplates.js';

// Quiet checklist row: muted check when done, hairline circle when not.
function ChecklistItem({ done, label }) {
  return (
    <li
      style={{
        fontFamily: 'var(--aparture-font-sans)',
        fontSize: 'var(--aparture-text-sm)',
        lineHeight: 1.6,
        color: done ? 'var(--aparture-mute)' : 'var(--aparture-ink)',
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5em',
      }}
    >
      <span
        aria-hidden
        style={{
          color: done ? '#22c55e' : 'var(--aparture-mute)',
          fontSize: 'var(--aparture-text-xs)',
          opacity: done ? 0.8 : 0.6,
        }}
      >
        {done ? '✓' : '○'}
      </span>
      <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
    </li>
  );
}

export default function WelcomeView({ profile, config, testState }) {
  const checklist = [
    {
      label: 'Write your profile (or pick a starter template)',
      done: Boolean(profile?.content?.trim()) && !isUneditedProfile(profile),
    },
    {
      label: 'Choose your arXiv categories in Settings',
      done: (config?.selectedCategories?.length ?? 0) > 0,
    },
    {
      label: 'Run the Dry Run Test (free, mock data)',
      done: Boolean(testState?.dryRunCompleted),
    },
    {
      label: 'Run the Minimal API Test (5 papers, ~$1)',
      done: Boolean(testState?.lastMinimalTestTime),
    },
  ];

  return (
    <div>
      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--aparture-font-serif)',
          fontSize: 'var(--aparture-text-2xl)',
          fontWeight: 600,
          color: 'var(--aparture-ink)',
          margin: 0,
        }}
      >
        Welcome to{' '}
        <span>
          Ap
          <span
            style={{
              color: 'var(--aparture-accent)',
              fontWeight: 700,
              borderBottom: '3px solid var(--aparture-accent)',
              paddingBottom: '2px',
            }}
          >
            ar
          </span>
          ture
        </span>
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontFamily: 'var(--aparture-font-serif)',
          fontSize: 'var(--aparture-text-lg)',
          fontStyle: 'italic',
          color: 'var(--aparture-mute)',
          marginTop: 'var(--aparture-space-2)',
          marginBottom: 0,
        }}
      >
        Bringing the arXiv into focus.
      </p>

      {/* Intro paragraph */}
      <p
        style={{
          fontFamily: 'var(--aparture-font-serif)',
          fontSize: 'var(--aparture-text-base)',
          lineHeight: 1.65,
          color: 'var(--aparture-ink)',
          marginTop: 'var(--aparture-space-4)',
          marginBottom: 0,
        }}
      >
        Aparture screens the day&#8217;s arXiv papers against your research profile, scores them for
        relevance, and distills the top results into a briefing you can read over your morning
        coffee. Star or dismiss papers to teach it what matters to you.
      </p>

      {/* Getting started card */}
      <Card style={{ marginTop: 'var(--aparture-space-6)' }}>
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            margin: 0,
            marginBottom: 'var(--aparture-space-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          To get started
        </h2>
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--aparture-space-3)',
          }}
        >
          <li
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              lineHeight: 1.6,
              color: 'var(--aparture-ink)',
            }}
          >
            <span
              style={{ color: 'var(--aparture-accent)', fontWeight: 600, marginRight: '0.5em' }}
            >
              1.
            </span>
            Click <strong>Profile</strong> and write 1–2 paragraphs about what you study.
          </li>
          <li
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              lineHeight: 1.6,
              color: 'var(--aparture-ink)',
            }}
          >
            <span
              style={{ color: 'var(--aparture-accent)', fontWeight: 600, marginRight: '0.5em' }}
            >
              2.
            </span>
            Click <strong>Settings</strong> to choose your arXiv categories, models, and other
            options — the advanced section has additional knobs worth exploring.
          </li>
          <li
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              lineHeight: 1.6,
              color: 'var(--aparture-ink)',
            }}
          >
            <span
              style={{ color: 'var(--aparture-accent)', fontWeight: 600, marginRight: '0.5em' }}
            >
              3.
            </span>
            Open the <strong>Pipeline</strong> page. Run the <strong>Dry Run Test</strong> first
            (free, mock data), then the <strong>Minimal API Test</strong> (5 papers, around $1),
            then <strong>Start Analysis</strong> for a full run.
          </li>
        </ol>

        {/* First-run checklist — live state, quiet styling */}
        <div
          style={{
            marginTop: 'var(--aparture-space-4)',
            paddingTop: 'var(--aparture-space-4)',
            borderTop: '1px solid var(--aparture-hairline)',
          }}
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--aparture-space-1)',
            }}
          >
            {checklist.map((item) => (
              <ChecklistItem key={item.label} done={item.done} label={item.label} />
            ))}
          </ul>
        </div>

        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            margin: 0,
            marginTop: 'var(--aparture-space-3)',
          }}
        >
          Step-by-step walkthrough:{' '}
          <a
            href="https://joshspeagle.github.io/aparture/using/first-briefing"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--aparture-mute)', textDecoration: 'underline' }}
          >
            Your first briefing ↗
          </a>
        </p>
      </Card>

      {/* Tips section */}
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          lineHeight: 1.6,
          color: 'var(--aparture-mute)',
          fontStyle: 'italic',
          marginTop: 'var(--aparture-space-4)',
          marginBottom: 0,
        }}
      >
        Every past briefing is saved in the sidebar with the exact profile and settings that
        produced it.
      </p>
    </div>
  );
}
