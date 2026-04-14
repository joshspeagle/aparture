import { useState } from 'react';

export default function ProactiveQuestionPanel({ question, onSkip, onPreview }) {
  const [answer, setAnswer] = useState('');
  return (
    <section className="paper-card block-question">
      <div className="meta-line">── A QUESTION FROM APARTURE ──</div>
      <p className="italic-pitch">{question}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
        }}
      />
      <div className="action-row">
        <button type="button" onClick={() => onPreview?.(answer)}>
          Preview changes to profile.md
        </button>
        <button type="button" onClick={() => onSkip?.()}>
          Skip
        </button>
      </div>
    </section>
  );
}
