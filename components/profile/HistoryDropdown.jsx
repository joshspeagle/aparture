import * as Collapsible from '@radix-ui/react-collapsible';
import { useState } from 'react';

function formatDate(ts) {
  if (!ts) return 'unknown';
  return new Date(ts).toLocaleDateString();
}

function SourceBadge({ source }) {
  const label = source === 'suggested' ? 'suggested' : 'manual';
  const classes =
    source === 'suggested'
      ? 'bg-blue-900/40 text-blue-300 border-blue-800'
      : 'bg-slate-800 text-slate-300 border-slate-700';
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${classes}`}
    >
      {label}
    </span>
  );
}

export default function HistoryDropdown({ revisions, onRevert }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-2">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
        >
          History {open ? '⏶' : '⏷'}
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="mt-2 rounded border border-slate-700 bg-slate-900/50 px-3 py-2">
        {revisions.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No revisions yet.</p>
        ) : (
          <ul className="space-y-2">
            {revisions.map((rev) => (
              <li key={rev.createdAt} className="flex items-start justify-between gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{formatDate(rev.createdAt)}</span>
                    <SourceBadge source={rev.source} />
                  </div>
                  {rev.rationale && (
                    <p className="mt-1 text-slate-500 truncate" title={rev.rationale}>
                      {rev.rationale}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRevert(rev.createdAt)}
                  className="rounded border border-slate-600 px-2 py-0.5 text-slate-300 hover:border-slate-400 hover:text-slate-100 shrink-0"
                >
                  Revert
                </button>
              </li>
            ))}
          </ul>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
