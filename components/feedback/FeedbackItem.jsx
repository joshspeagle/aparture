import { borderColorFor, iconFor, metaLabel } from './eventMeta.js';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString();
}

function labelFor(event) {
  const icon = iconFor(event.type);
  if (event.type === 'general-comment') {
    return `${icon} general comment`;
  }
  if (event.type === 'filter-override') {
    return `${icon} filter override on ${event.paperTitle ?? event.arxivId} (${event.originalVerdict} → ${event.newVerdict})`;
  }
  const title = event.paperTitle ?? event.arxivId ?? 'paper';
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
      {isGeneral ? (
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
            {event.paperTitle ?? event.arxivId}
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
              color: '#fb923c',
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
            {event.paperTitle ?? event.arxivId}
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
