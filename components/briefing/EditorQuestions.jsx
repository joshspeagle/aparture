// "Notes from the editor": up to two questions asked after the briefing
// (pages/api/editor-questions.js), each answered with one tap. An answer is
// an `answer` feedback event, which reaches the next profile suggestion.
// Tapping the chosen answer again takes it back.

const pillStyle = (selected) => ({
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-sm)',
  padding: '6px 12px',
  borderRadius: '999px',
  cursor: 'pointer',
  border: selected ? '1px solid var(--aparture-accent)' : '1px solid var(--aparture-border)',
  background: selected ? 'var(--aparture-surface-2)' : 'transparent',
  color: 'var(--aparture-ink)',
  fontWeight: selected ? 600 : 400,
});

function chosenAnswer(feedbackEvents, question, briefingDate) {
  return feedbackEvents?.findLast?.(
    (e) => e.type === 'answer' && e.questionId === question.id && e.briefingDate === briefingDate
  )?.answer;
}

export default function EditorQuestions({
  questions,
  feedbackEvents,
  briefingDate,
  testMode = false,
  onAnswer,
}) {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  return (
    <section className="theme-section" aria-label="Notes from the editor">
      <div className="meta-line">── NOTES FROM THE EDITOR ──</div>
      {questions.map((q) => {
        const chosen = chosenAnswer(feedbackEvents, q, briefingDate);
        return (
          <div key={q.id} style={{ marginTop: 'var(--aparture-space-4)' }}>
            <p style={{ marginBottom: 'var(--aparture-space-2)' }}>{q.text}</p>
            <div
              role="group"
              aria-label={q.text}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--aparture-space-2)' }}
            >
              {q.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="touch-target"
                  aria-pressed={chosen === option}
                  onClick={() =>
                    onAnswer?.({
                      questionId: q.id,
                      question: q.text,
                      answer: option,
                      evidence: q.evidence ?? [],
                      briefingDate,
                      ...(testMode ? { testMode: true } : {}),
                    })
                  }
                  style={pillStyle(chosen === option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p
        style={{
          marginTop: 'var(--aparture-space-4)',
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          color: 'var(--aparture-mute)',
        }}
      >
        Your answers go into the next profile suggestion, as proposed edits you accept or reject.
      </p>
    </section>
  );
}
