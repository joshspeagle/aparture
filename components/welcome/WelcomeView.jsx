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
        A research-paper discovery tool for arXiv. Each morning, generate a briefing of the papers
        most relevant to your interests — and spend your reading time on the ones worth it.
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
            Click <strong>Settings</strong> to pick arXiv categories (defaults are already
            reasonable).
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
            Click <strong>+ New Briefing</strong> and wait a couple minutes.
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
        You can always adjust later. Each briefing records the exact profile + settings used, so you
        can iterate with confidence.
      </p>
    </div>
  );
}
