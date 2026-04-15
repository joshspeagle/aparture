// Shared visual metadata for feedback events. Keeps icon / border / label
// lookups in one place so FeedbackItem and SuggestDialog stay in sync.

const TYPE_META = {
  star: { icon: '★', border: 'border-l-yellow-500', label: 'starred' },
  dismiss: { icon: '⊘', border: 'border-l-slate-500', label: 'dismissed' },
  'paper-comment': { icon: '💬', border: 'border-l-purple-500', label: 'comment' },
  'general-comment': { icon: '💭', border: 'border-l-blue-500', label: 'general' },
  'filter-override': { icon: '⇄', border: 'border-l-orange-500', label: 'filter override' },
};

const FALLBACK = { icon: '·', border: 'border-l-slate-700', label: 'event' };

export function metaFor(type) {
  return TYPE_META[type] ?? FALLBACK;
}

export function iconFor(type) {
  return metaFor(type).icon;
}

export function borderClass(type) {
  return metaFor(type).border;
}

export function metaLabel(type) {
  return metaFor(type).label;
}
