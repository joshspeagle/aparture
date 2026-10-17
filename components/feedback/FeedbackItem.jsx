import { useState } from 'react';
import { borderColorFor, iconFor, metaLabel } from './eventMeta.js';
import { isEditableFeedback } from '../../lib/profile/feedbackStatus.js';
import TextArea from '../ui/TextArea.jsx';
import {
  COMMENT_CANCEL_BUTTON_STYLE,
  COMMENT_SAVE_BUTTON_STYLE,
} from '../ui/commentButtonStyles.js';

const ACTION_LINK_STYLE = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  color: 'var(--aparture-mute)',
  textDecoration: 'underline',
};

// Edit (comments and notes) and delete (every event). Delete asks once
// inline; edit swaps in a textarea. Rendered only when the panel supplies
// the handlers.
function ItemActions({ event, onRemove, onUpdateText }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'confirm-delete'
  const [draft, setDraft] = useState('');
  const editable = Boolean(onUpdateText) && isEditableFeedback(event);

  if (mode === 'edit') {
    const save = () => {
      const trimmed = draft.trim();
      if (trimmed) onUpdateText(event.id, trimmed);
      setMode('view');
    };
    return (
      <div style={{ marginTop: '6px' }}>
        <TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          aria-label="Edit feedback text"
          style={{ minHeight: 'unset', fontSize: 'var(--aparture-text-xs)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
          <button type="button" onClick={() => setMode('view')} style={COMMENT_CANCEL_BUTTON_STYLE}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!draft.trim()}
            style={COMMENT_SAVE_BUTTON_STYLE}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'confirm-delete') {
    return (
      <div
        role="group"
        aria-label="Confirm delete"
        style={{
          marginTop: '4px',
          display: 'flex',
          gap: 'var(--aparture-space-3)',
          alignItems: 'center',
          fontSize: 'var(--aparture-text-xs)',
          color: 'var(--aparture-ink)',
        }}
      >
        <span>Delete this feedback?</span>
        <button
          type="button"
          onClick={() => onRemove(event.id)}
          style={{ ...ACTION_LINK_STYLE, color: 'var(--aparture-ink)' }}
        >
          Delete
        </button>
        <button type="button" onClick={() => setMode('view')} style={ACTION_LINK_STYLE}>
          Keep
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '4px', display: 'flex', gap: 'var(--aparture-space-3)' }}>
      {editable && (
        <button
          type="button"
          onClick={() => {
            setDraft(event.text ?? '');
            setMode('edit');
          }}
          aria-label="Edit this feedback"
          style={ACTION_LINK_STYLE}
        >
          edit
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => setMode('confirm-delete')}
          aria-label="Delete this feedback"
          style={ACTION_LINK_STYLE}
        >
          delete
        </button>
      )}
    </div>
  );
}

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
  if (event.type === 'answer') {
    return `${icon} answered "${event.question}" with "${event.answer}"`;
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
        fontSize: '12px',
        color: 'var(--aparture-mute)',
      }}
    >
      {metaLabel(event.type)} · {date} · briefing {event.briefingDate}
      {event.editedAt ? ' · edited' : ''}
    </p>
  );
}

export default function FeedbackItem({ event, onRemove, onUpdateText }) {
  const color = borderColorFor(event.type);
  const icon = iconFor(event.type);
  const date = formatDate(event.timestamp);
  const isGeneral = event.type === 'general-comment';
  const isPaperComment = event.type === 'paper-comment';
  const isFilterOverride = event.type === 'filter-override';
  const isScopedFeedback = event.type === 'scoped-feedback';
  const isAnswer = event.type === 'answer';

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
      {isAnswer ? (
        <div>
          <p style={{ fontSize: 'var(--aparture-text-xs)', color: 'var(--aparture-mute)' }}>
            <span style={{ marginRight: '4px' }} aria-hidden>
              {icon}
            </span>
            {event.question}
          </p>
          <p
            style={{
              marginTop: '4px',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
            }}
          >
            {event.answer}
          </p>
          <MetaLine event={event} date={date} />
        </div>
      ) : isScopedFeedback ? (
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
              color: 'var(--aparture-override-text)',
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
      {(onRemove || onUpdateText) && (
        <ItemActions event={event} onRemove={onRemove} onUpdateText={onUpdateText} />
      )}
    </article>
  );
}
