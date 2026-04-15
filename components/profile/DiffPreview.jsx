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
    <div className="whitespace-pre-wrap rounded-md border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200 font-serif leading-relaxed">
      {tokens.map((token, idx) => {
        if (token.type === 'added') {
          const rationale = getRationaleFor(token, changes);
          return (
            <span
              key={idx}
              className="bg-green-900/30 text-green-200 rounded-sm px-0.5"
              title={rationale ?? undefined}
            >
              {token.text}
            </span>
          );
        }
        if (token.type === 'removed') {
          return (
            <span key={idx} className="bg-red-900/30 text-red-300 line-through rounded-sm px-0.5">
              {token.text}
            </span>
          );
        }
        return <span key={idx}>{token.text}</span>;
      })}
    </div>
  );
}
