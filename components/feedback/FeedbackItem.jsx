function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString();
}

function borderClass(type) {
  switch (type) {
    case 'star':
      return 'border-l-yellow-500';
    case 'dismiss':
      return 'border-l-slate-500';
    case 'paper-comment':
      return 'border-l-purple-500';
    case 'general-comment':
      return 'border-l-blue-500';
    default:
      return 'border-l-slate-700';
  }
}

function iconFor(type) {
  switch (type) {
    case 'star':
      return '★';
    case 'dismiss':
      return '⊘';
    case 'paper-comment':
      return '💬';
    case 'general-comment':
      return '💭';
    default:
      return '·';
  }
}

function labelFor(event) {
  const icon = iconFor(event.type);
  if (event.type === 'general-comment') {
    return `${icon} general comment`;
  }
  const title = event.paperTitle ?? event.arxivId ?? 'paper';
  return `${icon} ${event.type} on ${title} (${event.arxivId})`;
}

function metaLabel(type) {
  switch (type) {
    case 'star':
      return 'starred';
    case 'dismiss':
      return 'dismissed';
    case 'paper-comment':
      return 'comment';
    case 'general-comment':
      return 'general';
    default:
      return type;
  }
}

export default function FeedbackItem({ event }) {
  const border = borderClass(event.type);
  const icon = iconFor(event.type);
  const date = formatDate(event.timestamp);
  const isGeneral = event.type === 'general-comment';
  const isPaperComment = event.type === 'paper-comment';

  return (
    <article
      aria-label={labelFor(event)}
      className={`border-l-4 ${border} bg-slate-900/40 px-3 py-2 mb-1 rounded-r`}
    >
      {isGeneral ? (
        <div>
          <p className="text-sm text-slate-200">
            <span className="mr-1" aria-hidden>
              {icon}
            </span>
            {event.text}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {metaLabel(event.type)} · {date} · briefing {event.briefingDate}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-200">
            <span className="mr-1" aria-hidden>
              {icon}
            </span>
            {event.paperTitle ?? event.arxivId}
            <span className="ml-2 text-xs text-slate-500">{event.arxivId}</span>
          </p>
          {isPaperComment && event.text && (
            <p className="mt-1 text-xs italic text-slate-400">“{event.text}”</p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            {metaLabel(event.type)} · {date} · briefing {event.briefingDate}
          </p>
        </div>
      )}
    </article>
  );
}
