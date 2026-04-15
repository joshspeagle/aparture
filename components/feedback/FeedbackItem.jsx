import { borderClass, iconFor, metaLabel } from './eventMeta.js';

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
    <p className="mt-1 text-[10px] text-slate-500">
      {metaLabel(event.type)} · {date} · briefing {event.briefingDate}
    </p>
  );
}

export default function FeedbackItem({ event }) {
  const border = borderClass(event.type);
  const icon = iconFor(event.type);
  const date = formatDate(event.timestamp);
  const isGeneral = event.type === 'general-comment';
  const isPaperComment = event.type === 'paper-comment';
  const isFilterOverride = event.type === 'filter-override';

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
          <MetaLine event={event} date={date} />
        </div>
      ) : isFilterOverride ? (
        <div>
          <p className="text-sm text-slate-200">
            <span className="mr-1" aria-hidden>
              {icon}
            </span>
            {event.paperTitle ?? event.arxivId}
            <span className="ml-2 text-xs text-slate-500">{event.arxivId}</span>
          </p>
          <p className="mt-1 text-xs text-orange-400">
            filter said <span className="font-medium">{event.originalVerdict}</span>, user changed
            to <span className="font-medium">{event.newVerdict}</span>
          </p>
          {event.summary && <p className="mt-1 text-xs italic text-slate-400">{event.summary}</p>}
          {event.justification && (
            <p className="mt-0.5 text-xs text-slate-500">{event.justification}</p>
          )}
          <MetaLine event={event} date={date} />
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
          <MetaLine event={event} date={date} />
        </div>
      )}
    </article>
  );
}
