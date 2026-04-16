import { useMemo } from 'react';
import { diffWords } from '../../lib/profile/diff.js';

function getRationaleFor(token, changes) {
  if (!changes || changes.length === 0) return null;
  const match = changes.find((c) => token.text.includes(c.excerpt));
  return match ? match.rationale : null;
}

export default function DiffPreview({ before, after, changes }) {
  const tokens = useMemo(() => diffWords(before ?? '', after ?? ''), [before, after]);

  return (
    <div
      style={{
        whiteSpace: 'pre-wrap',
        borderRadius: '4px',
        border: '1px solid var(--aparture-hairline)',
        background: 'var(--aparture-bg)',
        padding: 'var(--aparture-space-4)',
        fontFamily: 'var(--aparture-font-serif)',
        fontSize: 'var(--aparture-text-sm)',
        color: 'var(--aparture-ink)',
        lineHeight: 1.6,
      }}
    >
      {tokens.map((token, idx) => {
        if (token.type === 'added') {
          const rationale = getRationaleFor(token, changes);
          return (
            <span
              key={idx}
              style={{
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                borderRadius: '2px',
                padding: '0 2px',
              }}
              title={rationale ?? undefined}
            >
              {token.text}
            </span>
          );
        }
        if (token.type === 'removed') {
          return (
            <span
              key={idx}
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                textDecoration: 'line-through',
                borderRadius: '2px',
                padding: '0 2px',
              }}
            >
              {token.text}
            </span>
          );
        }
        return <span key={idx}>{token.text}</span>;
      })}
    </div>
  );
}
