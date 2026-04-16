import * as Collapsible from '@radix-ui/react-collapsible';
import { useState } from 'react';
import Button from '../ui/Button.jsx';

function formatDate(ts) {
  if (!ts) return 'unknown';
  return new Date(ts).toLocaleString();
}

function SourceBadge({ source }) {
  const label = source === 'suggested' ? 'suggested' : 'manual';
  const badgeStyle =
    source === 'suggested'
      ? {
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#93c5fd',
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
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...badgeStyle,
      }}
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
          History {open ? '\u23F6' : '\u23F7'}
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
              <p
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--aparture-mute)',
                }}
              >
                {revisions.length} revision{revisions.length === 1 ? '' : 's'} · newest first
              </p>
              {onClearHistory && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{
                    fontSize: '10px',
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
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {revisions.map((rev) => {
                const isExpanded = expandedId === rev.createdAt;
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
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} revision from ${formatDate(rev.createdAt)}`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--aparture-space-2)',
                          }}
                        >
                          <span style={{ color: 'var(--aparture-mute)' }} aria-hidden>
                            {isExpanded ? '▾' : '▸'}
                          </span>
                          <span style={{ color: 'var(--aparture-ink)' }}>
                            {formatDate(rev.createdAt)}
                          </span>
                          <SourceBadge source={rev.source} />
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
                          marginLeft: '20px',
                          marginBottom: 'var(--aparture-space-2)',
                          marginRight: '4px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--aparture-mute)',
                            marginBottom: '4px',
                          }}
                        >
                          Profile content at this revision
                        </div>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            borderRadius: '4px',
                            border: '1px solid var(--aparture-hairline)',
                            background: 'var(--aparture-bg)',
                            padding: 'var(--aparture-space-3)',
                            fontSize: '11px',
                            color: 'var(--aparture-ink)',
                            maxHeight: '16rem',
                            overflowY: 'auto',
                          }}
                        >
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
