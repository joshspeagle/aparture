// Shared visual metadata for feedback events. Keeps icon / border / label
// lookups in one place so FeedbackItem and SuggestDialog stay in sync.

const TYPE_META = {
  star: { icon: '★', borderColor: '#f59e0b', label: 'starred' },
  dismiss: { icon: '⊘', borderColor: '#64748b', label: 'dismissed' },
  'paper-comment': { icon: '💬', borderColor: '#a855f7', label: 'comment' },
  'general-comment': { icon: '💭', borderColor: '#3b82f6', label: 'general' },
  'filter-override': { icon: '⇄', borderColor: '#f97316', label: 'filter override' },
  'scoped-feedback': { icon: '📋', borderColor: '#6366f1', label: 'scoped feedback' },
};

const FALLBACK = { icon: '·', borderColor: 'var(--aparture-hairline)', label: 'event' };

function metaFor(type) {
  return TYPE_META[type] ?? FALLBACK;
}

export function iconFor(type) {
  return metaFor(type).icon;
}

export function borderColorFor(type) {
  return metaFor(type).borderColor;
}

export function metaLabel(type) {
  return metaFor(type).label;
}
