// components/welcome/WelcomeView.jsx
// Persistent reference page explaining what Aparture is and how to get started.

import Card from '../ui/Card.jsx';

export default function WelcomeView() {
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
          ap<span style={{ color: 'var(--aparture-accent)' }}>ar</span>ture
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
            Open the <strong>Pipeline</strong> page and run each stage to see how papers flow
            through filtering, scoring, and analysis. Once you&#8217;re comfortable, use{' '}
            <strong>+ New Briefing</strong> to run everything end-to-end.
          </li>
        </ol>
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
