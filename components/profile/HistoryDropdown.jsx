import * as Collapsible from '@radix-ui/react-collapsible';
import { useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';
import { countChanges, diffLines, withContext } from '../../lib/profile/lineDiff.js';

function formatDate(ts) {
  if (!ts) return 'unknown';
  return new Date(ts).toLocaleString();
}

// The kind of change a revision records. Revisions saved before template,
// revert, and switch sources existed say 'manual'.
const SOURCE_LABELS = {
  manual: 'manual',
  suggested: 'suggested',
  template: 'template',
  revert: 'revert',
  switch: 'switch',
};

const smallCaps = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--aparture-mute)',
};

function SourceBadge({ source }) {
  const label = SOURCE_LABELS[source] ?? 'manual';
  const badgeStyle =
    source === 'suggested'
      ? {
          background: 'rgba(59, 130, 246, 0.15)',
          // Documented informational blue — #93c5fd was unreadable in light mode.
          color: 'var(--aparture-info-text)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
        }
      : {
          background: 'var(--aparture-surface)',
          color: 'var(--aparture-mute)',
          borderColor: 'var(--aparture-hairline)',
        };

  return (
    <span
      style={{
        borderRadius: '2px',
        border: '1px solid',
        padding: '1px 6px',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...badgeStyle,
      }}
    >
      {label}
    </span>
  );
}

function describeCounts({ added, removed }) {
  const lines = (n) => `${n} line${n === 1 ? '' : 's'}`;
  if (added && removed) return `${lines(added)} added, ${removed} removed`;
  if (added) return `${lines(added)} added`;
  if (removed) return `${lines(removed)} removed`;
  return 'blank lines only';
}

// Tints carry the meaning with the +/− marker; the text itself stays ink,
// so it keeps full contrast in both themes.
const LINE_KINDS = {
  added: { marker: '+', background: 'rgba(34, 197, 94, 0.14)' },
  removed: { marker: '−', background: 'rgba(239, 68, 68, 0.12)' },
  same: { marker: ' ', background: 'transparent' },
};

function ChangeDiff({ lines }) {
  return (
    <div
      style={{
        borderRadius: '4px',
        border: '1px solid var(--aparture-hairline)',
        background: 'var(--aparture-bg)',
        padding: 'var(--aparture-space-2) 0',
        fontFamily: 'var(--aparture-font-mono)',
        fontSize: '12px',
        color: 'var(--aparture-ink)',
        maxHeight: '16rem',
        overflowY: 'auto',
      }}
    >
      {lines.map((line, idx) =>
        line.type === 'gap' ? (
          <div
            key={idx}
            style={{ padding: '0 var(--aparture-space-3)', color: 'var(--aparture-mute)' }}
          >
            ⋯ {line.count} unchanged line{line.count === 1 ? '' : 's'}
          </div>
        ) : (
          <div
            key={idx}
            data-change={line.type}
            style={{
              display: 'flex',
              gap: 'var(--aparture-space-2)',
              padding: '0 var(--aparture-space-3)',
              background: LINE_KINDS[line.type].background,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            <span aria-hidden style={{ flexShrink: 0, width: '1ch' }}>
              {LINE_KINDS[line.type].marker}
            </span>
            <span style={{ minWidth: 0 }}>{line.text || ' '}</span>
          </div>
        )
      )}
    </div>
  );
}

function FullText({ content }) {
  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        borderRadius: '4px',
        border: '1px solid var(--aparture-hairline)',
        background: 'var(--aparture-bg)',
        padding: 'var(--aparture-space-3)',
        margin: 'var(--aparture-space-2) 0 0',
        fontSize: '12px',
        color: 'var(--aparture-ink)',
        maxHeight: '16rem',
        overflowY: 'auto',
      }}
    >
      {content || '(empty profile)'}
    </pre>
  );
}

// Each revision holds the text from before its change, so the change is the
// diff from that text to the next newer one: the revision above it in the
// list, or the current profile for the newest.
function useChanges(revisions, currentContent) {
  return useMemo(
    () =>
      revisions.map((rev, idx) => {
        const after = idx === 0 ? currentContent : revisions[idx - 1].content;
        const lines = typeof after === 'string' ? diffLines(rev.content, after) : null;
        return { lines, counts: lines ? countChanges(lines) : null };
      }),
    [revisions, currentContent]
  );
}

function RevisionList({ revisions, currentContent, onRevert }) {
  const [expandedId, setExpandedId] = useState(null);
  const changes = useChanges(revisions, currentContent);

  const toggleExpanded = (createdAt) => {
    setExpandedId((current) => (current === createdAt ? null : createdAt));
  };

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {revisions.map((rev, idx) => {
        const isExpanded = expandedId === rev.createdAt;
        const { lines, counts } = changes[idx];
        return (
          <li
            key={rev.createdAt}
            style={{
              borderRadius: '4px',
              border: '1px solid transparent',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--aparture-space-3)',
                fontSize: 'var(--aparture-text-xs)',
                padding: '4px',
              }}
            >
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
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} change from ${formatDate(rev.createdAt)}`}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--aparture-space-2)',
                  }}
                >
                  <span style={{ color: 'var(--aparture-mute)' }} aria-hidden>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  <span style={{ color: 'var(--aparture-ink)' }}>{formatDate(rev.createdAt)}</span>
                  <SourceBadge source={rev.source} />
                  {Number.isFinite(rev.acceptedCount) && (
                    <span style={{ color: 'var(--aparture-mute)' }}>
                      {rev.acceptedCount} of {rev.acceptedCount + (rev.rejectedCount ?? 0)} changes
                      accepted
                    </span>
                  )}
                  {counts && (
                    <span style={{ color: 'var(--aparture-mute)' }}>{describeCounts(counts)}</span>
                  )}
                </div>
                {rev.rationale && (
                  <p
                    style={{
                      marginTop: '4px',
                      color: 'var(--aparture-mute)',
                      overflow: isExpanded ? 'visible' : 'hidden',
                      textOverflow: isExpanded ? 'unset' : 'ellipsis',
                      whiteSpace: isExpanded ? 'normal' : 'nowrap',
                    }}
                    title={rev.rationale}
                  >
                    {rev.rationale}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                onClick={() => onRevert(rev.createdAt)}
                aria-label="Revert to the text before this change"
                title="Revert to the text before this change"
                style={{
                  flexShrink: 0,
                  padding: '2px 8px',
                  fontSize: 'var(--aparture-text-xs)',
                }}
              >
                Revert
              </Button>
            </div>
            {isExpanded && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--aparture-space-2)',
                  marginLeft: '20px',
                  marginBottom: 'var(--aparture-space-2)',
                  marginRight: '4px',
                }}
              >
                {lines ? (
                  <>
                    <div style={smallCaps}>What this change did</div>
                    <ChangeDiff lines={withContext(lines, 2)} />
                    <details>
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontSize: 'var(--aparture-text-xs)',
                          color: 'var(--aparture-mute)',
                        }}
                      >
                        Full text before this change
                      </summary>
                      <FullText content={rev.content} />
                    </details>
                  </>
                ) : (
                  <>
                    <div style={smallCaps}>Text before this change</div>
                    <FullText content={rev.content} />
                  </>
                )}
                <p style={{ fontSize: 'var(--aparture-text-xs)', color: 'var(--aparture-mute)' }}>
                  Revert puts back the text from before this change. Your current text is saved to
                  history first.
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function HistoryDropdown({ revisions, currentContent, onRevert, onClearHistory }) {
  const [open, setOpen] = useState(false);

  const handleClearHistory = () => {
    if (!onClearHistory) return;
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Clear profile revision history? This removes all past revisions but does not change your current profile content. Cannot be undone.'
          );
    if (confirmed) onClearHistory();
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      style={{ marginTop: 'var(--aparture-space-2)' }}
    >
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'var(--aparture-font-sans)',
          }}
        >
          History {open ? '⏶' : '⏷'}
          {revisions.length > 0 && (
            <span style={{ color: 'var(--aparture-mute)', opacity: 0.7 }}>
              ({revisions.length})
            </span>
          )}
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content
        style={{
          marginTop: 'var(--aparture-space-2)',
          borderRadius: '4px',
          border: '1px solid var(--aparture-hairline)',
          background: 'var(--aparture-surface)',
          padding: 'var(--aparture-space-3) var(--aparture-space-3)',
        }}
      >
        {revisions.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              padding: 'var(--aparture-space-2) 0',
            }}
          >
            No revisions yet.
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--aparture-space-2)',
                paddingBottom: 'var(--aparture-space-2)',
                borderBottom: '1px solid var(--aparture-hairline)',
              }}
            >
              <p style={smallCaps}>
                {revisions.length} change{revisions.length === 1 ? '' : 's'} · newest first
              </p>
              {onClearHistory && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{
                    fontSize: '12px',
                    color: 'var(--aparture-mute)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--aparture-font-sans)',
                  }}
                  title="Remove all past revisions (does not change current profile content)"
                >
                  Clear history
                </button>
              )}
            </div>
            <RevisionList
              revisions={revisions}
              currentContent={currentContent}
              onRevert={onRevert}
            />
          </>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
