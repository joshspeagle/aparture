import { useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';

/**
 * Apply a single edit to text. Defensive: silently returns the original
 * text if the anchor is not found (the API-side validator should prevent this).
 *
 * @param {string} text
 * @param {{type: 'replace'|'insert'|'delete', anchor: string, content?: string}} edit
 * @returns {string}
 */
export function applyEdit(text, edit) {
  const idx = text.indexOf(edit.anchor);
  if (idx < 0) return text;
  if (edit.type === 'replace') {
    return text.slice(0, idx) + (edit.content ?? '') + text.slice(idx + edit.anchor.length);
  }
  if (edit.type === 'insert') {
    return (
      text.slice(0, idx + edit.anchor.length) +
      (edit.content ?? '') +
      text.slice(idx + edit.anchor.length)
    );
  }
  if (edit.type === 'delete') {
    return text.slice(0, idx) + text.slice(idx + edit.anchor.length);
  }
  return text;
}

/**
 * Apply every change whose id is in acceptedIds to baseText. Non-overlap
 * is required (enforced server-side) so order of application doesn't
 * change the result.
 *
 * @param {string} baseText
 * @param {Array<{id: string, edit: object}>} changes
 * @param {Set<string>} acceptedIds
 * @returns {string}
 */
export function applyAll(baseText, changes, acceptedIds) {
  let text = baseText;
  for (const change of changes) {
    if (acceptedIds.has(change.id)) {
      text = applyEdit(text, change.edit);
    }
  }
  return text;
}

function editTypeLabel(type) {
  if (type === 'replace') return 'Replace';
  if (type === 'insert') return 'Insert';
  if (type === 'delete') return 'Delete';
  return type;
}

function ChangeCard({ change, checked, onToggle }) {
  const { edit, rationale } = change;
  const showAnchor = edit.type !== 'insert';
  const showContent = edit.type !== 'delete' && edit.content;

  return (
    <label
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        border: '1px solid var(--aparture-hairline)',
        borderLeft: `3px solid ${checked ? 'var(--aparture-accent)' : 'var(--aparture-hairline)'}`,
        borderRadius: '4px',
        background: checked ? 'rgba(34, 197, 94, 0.04)' : 'var(--aparture-surface)',
        cursor: 'pointer',
        alignItems: 'flex-start',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ marginTop: '4px', accentColor: 'var(--aparture-accent)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--aparture-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '4px',
          }}
        >
          {editTypeLabel(edit.type)}
        </div>
        <div
          style={{
            fontFamily: 'var(--aparture-font-mono)',
            fontSize: 'var(--aparture-text-xs)',
            lineHeight: 1.5,
            marginBottom: '6px',
            wordBreak: 'break-word',
          }}
        >
          {showAnchor && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                textDecoration: edit.type === 'delete' ? 'line-through' : 'none',
                padding: '2px 4px',
                borderRadius: '2px',
                marginBottom: showContent ? '3px' : 0,
              }}
            >
              {edit.anchor}
            </div>
          )}
          {edit.type === 'insert' && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--aparture-mute)',
                marginBottom: '3px',
                fontStyle: 'italic',
              }}
            >
              after: &ldquo;{edit.anchor}&rdquo;
            </div>
          )}
          {showContent && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#22c55e',
                padding: '2px 4px',
                borderRadius: '2px',
              }}
            >
              {edit.content}
            </div>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            fontStyle: 'italic',
          }}
        >
          {rationale}
        </div>
      </div>
    </label>
  );
}

/**
 * Per-hunk accept/reject diff preview.
 *
 * Props:
 *   - currentProfile: string — the profile text edits will be applied to.
 *   - changes: Array<{id, rationale, edit}> — atomic non-overlapping edits.
 *   - onApply: ({acceptedIds, resultText}) => void — called on Apply click.
 *   - onCancel: () => void — optional, renders a Cancel button next to Apply.
 */
export default function DiffPreview({ currentProfile, changes, onApply, onCancel }) {
  const safeChanges = Array.isArray(changes) ? changes : [];
  const [acceptedIds, setAcceptedIds] = useState(
    () => new Set(safeChanges.map((c) => c.id))
  );

  const cumulative = useMemo(
    () => applyAll(currentProfile ?? '', safeChanges, acceptedIds),
    [currentProfile, safeChanges, acceptedIds]
  );

  const toggle = (id) => {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setAcceptedIds(new Set(safeChanges.map((c) => c.id)));
  const selectNone = () => setAcceptedIds(new Set());

  const count = acceptedIds.size;
  const total = safeChanges.length;
  const canApply = count > 0;

  const handleApply = () => {
    if (!onApply) return;
    const orderedIds = safeChanges
      .filter((c) => acceptedIds.has(c.id))
      .map((c) => c.id);
    onApply({ acceptedIds: orderedIds, resultText: cumulative });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-3)' }}>
      <div
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          color: 'var(--aparture-mute)',
        }}
      >
        Pick which suggested changes to apply. Each change is atomic; untick the ones you want to
        skip.
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--aparture-space-2)',
          maxHeight: '40vh',
          overflowY: 'auto',
        }}
      >
        {safeChanges.map((c) => (
          <ChangeCard
            key={c.id}
            change={c}
            checked={acceptedIds.has(c.id)}
            onToggle={() => toggle(c.id)}
          />
        ))}
      </div>

      <div
        data-testid="cumulative-preview"
        style={{
          padding: 'var(--aparture-space-3) var(--aparture-space-4)',
          background: 'var(--aparture-bg)',
          border: '1px dashed var(--aparture-accent)',
          borderRadius: '4px',
          fontFamily: 'var(--aparture-font-serif)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-ink)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--aparture-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '6px',
          }}
        >
          Preview ({count} of {total} changes)
        </div>
        <div>{cumulative}</div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--aparture-space-3)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
          }}
        >
          <button
            type="button"
            onClick={selectAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--aparture-accent)',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Select all
          </button>
          {' \u00b7 '}
          <button
            type="button"
            onClick={selectNone}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--aparture-accent)',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Select none
          </button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--aparture-space-2)' }}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="primary" onClick={handleApply} disabled={!canApply}>
            Apply {count} of {total} {count === 1 ? 'change' : 'changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
