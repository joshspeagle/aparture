import { borderColorFor, iconFor, metaLabel } from './eventMeta.js';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString();
}

function scopeKindLabel(scope) {
  if (scope?.kind === 'bucket') return `${scope.bucket} bucket`;
  if (scope?.kind === 'score-review') return 'Score-review note';
  return 'Run note';
}

function labelFor(event) {
  const icon = iconFor(event.type);
  if (event.type === 'general-comment') {
    return `${icon} general comment`;
  }
  if (event.type === 'scoped-feedback') {
    return `${icon} ${scopeKindLabel(event.scope).toLowerCase()}`;
  }
  if (event.type === 'filter-override') {
    return `${icon} filter override on ${event.paperTitle || event.arxivId} (${event.originalVerdict} → ${event.newVerdict})`;
  }
  // `||` not `??`: legacy events may carry paperTitle: '' — fall through to
  // the arxivId rather than rendering a blank label.
  const title = event.paperTitle || event.arxivId || 'paper';
  return `${icon} ${event.type} on ${title} (${event.arxivId})`;
}

function MetaLine({ event, date }) {
  return (
    <p
      style={{
        marginTop: '4px',
        fontSize: '10px',
        color: 'var(--aparture-mute)',
      }}
    >
      {metaLabel(event.type)} · {date} · briefing {event.briefingDate}
    </p>
  );
}

export default function FeedbackItem({ event }) {
  const color = borderColorFor(event.type);
  const icon = iconFor(event.type);
  const date = formatDate(event.timestamp);
  const isGeneral = event.type === 'general-comment';
  const isPaperComment = event.type === 'paper-comment';
  const isFilterOverride = event.type === 'filter-override';
  const isScopedFeedback = event.type === 'scoped-feedback';

  return (
    <article
      aria-label={labelFor(event)}
      data-event-type={event.type}
      style={{
        borderLeft: `4px solid ${color}`,
        background: 'var(--aparture-surface)',
        padding: '8px 12px',
        marginBottom: '4px',
        borderRadius: '0 4px 4px 0',
      }}
    >
      {isScopedFeedback ? (
        <div>
          <p style={{ fontSize: 'var(--aparture-text-sm)', color: 'var(--aparture-ink)' }}>
            <span style={{ marginRight: '4px' }} aria-hidden>
              {icon}
            </span>
            {scopeKindLabel(event.scope)}
          </p>
          {event.text && (
            <p
              style={{
                marginTop: '4px',
                fontSize: 'var(--aparture-text-xs)',
                fontStyle: 'italic',
                color: 'var(--aparture-mute)',
              }}
            >
              &ldquo;{event.text}&rdquo;
            </p>
          )}
          <MetaLine event={event} date={date} />
        </div>
      ) : isGeneral ? (
        <div>
          <p style={{ fontSize: 'var(--aparture-text-sm)', color: 'var(--aparture-ink)' }}>
            <span style={{ marginRight: '4px' }} aria-hidden>
              {icon}
            </span>
            {event.text}
          </p>
          <MetaLine event={event} date={date} />
        </div>
      ) : isFilterOverride ? (
        <div>
          <p style={{ fontSize: 'var(--aparture-text-sm)', color: 'var(--aparture-ink)' }}>
            <span style={{ marginRight: '4px' }} aria-hidden>
              {icon}
            </span>
            {event.paperTitle || event.arxivId}
            <span
              style={{
                marginLeft: '8px',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
              }}
            >
              {event.arxivId}
            </span>
          </p>
          <p
            style={{
              marginTop: '4px',
              fontSize: 'var(--aparture-text-xs)',
              color: '#f97316',
            }}
          >
            filter said <span style={{ fontWeight: 500 }}>{event.originalVerdict}</span>, user
            changed to <span style={{ fontWeight: 500 }}>{event.newVerdict}</span>
          </p>
          {event.summary && (
            <p
              style={{
                marginTop: '4px',
                fontSize: 'var(--aparture-text-xs)',
                fontStyle: 'italic',
                color: 'var(--aparture-mute)',
              }}
            >
              {event.summary}
            </p>
          )}
          {event.justification && (
            <p
              style={{
                marginTop: '2px',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                opacity: 0.8,
              }}
            >
              {event.justification}
            </p>
          )}
          <MetaLine event={event} date={date} />
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 'var(--aparture-text-sm)', color: 'var(--aparture-ink)' }}>
            <span style={{ marginRight: '4px' }} aria-hidden>
              {icon}
            </span>
            {/* `||` not `??`: paper comments from filter/score-review rows may
                carry paperTitle: '' on legacy events — show the id instead. */}
            {event.paperTitle || event.arxivId}
            <span
              style={{
                marginLeft: '8px',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
              }}
            >
              {event.arxivId}
            </span>
          </p>
          {isPaperComment && event.text && (
            <p
              style={{
                marginTop: '4px',
                fontSize: 'var(--aparture-text-xs)',
                fontStyle: 'italic',
                color: 'var(--aparture-mute)',
              }}
            >
              &ldquo;{event.text}&rdquo;
            </p>
          )}
          <MetaLine event={event} date={date} />
        </div>
      )}
    </article>
  );
}
