import * as Collapsible from '@radix-ui/react-collapsible';
import { useState } from 'react';

function formatDate(ts) {
  if (!ts) return 'unknown';
  return new Date(ts).toLocaleString();
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

export default function HistoryDropdown({ revisions, onRevert, onClearHistory }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpanded = (createdAt) => {
    setExpandedId((current) => (current === createdAt ? null : createdAt));
  };

  const handleClearHistory = () => {
    if (!onClearHistory) return;
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Clear profile revision history? This removes all past revisions but does not change your current profile content. Cannot be undone.'
          );
    if (confirmed) {
      onClearHistory();
      setExpandedId(null);
    }
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-2">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
        >
          History {open ? '⏶' : '⏷'}
          {revisions.length > 0 && <span className="text-slate-500">({revisions.length})</span>}
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="mt-2 rounded border border-slate-700 bg-slate-900/50 px-3 py-2">
        {revisions.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No revisions yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {revisions.length} revision{revisions.length === 1 ? '' : 's'} · newest first
              </p>
              {onClearHistory && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[10px] text-slate-500 hover:text-red-400 underline-offset-2 hover:underline"
                  title="Remove all past revisions (does not change current profile content)"
                >
                  Clear history
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {revisions.map((rev) => {
                const isExpanded = expandedId === rev.createdAt;
                return (
                  <li
                    key={rev.createdAt}
                    className="rounded border border-transparent hover:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3 text-xs px-1 py-1">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExpanded(rev.createdAt)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpanded(rev.createdAt);
                          }
                        }}
                        className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500 rounded"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} revision from ${formatDate(rev.createdAt)}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400" aria-hidden>
                            {isExpanded ? '▾' : '▸'}
                          </span>
                          <span className="text-slate-300">{formatDate(rev.createdAt)}</span>
                          <SourceBadge source={rev.source} />
                        </div>
                        {rev.rationale && (
                          <p
                            className={`mt-1 text-slate-500 ${isExpanded ? '' : 'truncate'}`}
                            title={rev.rationale}
                          >
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
                    </div>
                    {isExpanded && (
                      <div className="ml-5 mb-2 mr-1">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                          Profile content at this revision
                        </div>
                        <pre className="whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200 max-h-64 overflow-y-auto">
                          {rev.content || '(empty profile)'}
                        </pre>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
