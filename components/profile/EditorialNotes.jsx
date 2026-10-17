import { useState } from 'react';
import Button from '../ui/Button.jsx';
import TextArea from '../ui/TextArea.jsx';
import {
  MAX_NOTE_CHARS,
  MAX_NOTES_PER_SCOPE,
  NOTE_SCOPES,
  NOTE_SCOPE_INFO,
  newNoteId,
  notesForScope,
} from '../../lib/profile/editorialNotes.js';

const SOURCE_TEXT = {
  manual: 'You wrote this',
  suggested: 'From an accepted suggestion',
  answer: "From your answer to an editor's question",
};

const metaStyle = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: '12px',
  color: 'var(--aparture-mute)',
};

const linkButton = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: 'var(--aparture-accent)',
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: '12px',
  textDecoration: 'underline',
};

// Event-time helpers, outside the component so render stays pure.
function newManualNote(text, scope) {
  const now = Date.now();
  return { id: newNoteId(now), text, scope, source: 'manual', createdAt: now };
}

function withEditedText(note, text) {
  return { ...note, text: text.trim(), editedAt: Date.now() };
}

function noteMeta(note) {
  const when = note.editedAt ?? note.createdAt;
  const date = when ? ` · ${new Date(when).toLocaleDateString()}` : '';
  return `${SOURCE_TEXT[note.source] ?? SOURCE_TEXT.manual}${note.editedAt ? ', edited' : ''}${date}`;
}

function NoteRow({ note, disabled, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  if (editing) {
    return (
      <li style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-2)' }}>
        <TextArea
          aria-label="Edit note"
          value={text}
          maxLength={MAX_NOTE_CHARS}
          rows={2}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 'var(--aparture-space-2)' }}>
          <Button
            variant="primary"
            disabled={!text.trim() || text.trim() === note.text}
            onClick={() => {
              onSave(text);
              setEditing(false);
            }}
          >
            Save note
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setText(note.text);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span
        style={{
          fontFamily: 'var(--aparture-font-serif)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-ink)',
        }}
      >
        {note.text}
      </span>
      <span style={metaStyle}>
        {noteMeta(note)}
        {!disabled && (
          <>
            {' · '}
            <button type="button" style={linkButton} onClick={() => setEditing(true)}>
              Edit
            </button>
            {' · '}
            <button
              type="button"
              style={linkButton}
              aria-label={`Remove note: ${note.text}`}
              onClick={onRemove}
            >
              Remove
            </button>
          </>
        )}
      </span>
    </li>
  );
}

// The Editorial notes tab: what the editor has learned about the reader's
// taste, by scope. Every change goes through onChange (useProfile.updateNotes),
// which records a revision like any profile edit.
export default function EditorialNotes({ notes = [], onChange, disabled = false }) {
  const [drafts, setDrafts] = useState({});

  const add = (scope) => {
    const text = (drafts[scope] ?? '').trim();
    if (!text) return;
    onChange([...notes, newManualNote(text, scope)], {
      rationale: `Added a ${NOTE_SCOPE_INFO[scope].label.toLowerCase()} note`,
    });
    setDrafts((d) => ({ ...d, [scope]: '' }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-6)' }}>
      <p style={{ ...metaStyle, fontSize: 'var(--aparture-text-xs)', lineHeight: 1.6, margin: 0 }}>
        Short notes on your taste, learned from your feedback or written by you. Each scope’s notes
        follow your research profile in the prompts that scope covers. Where a note and your profile
        disagree, the profile wins. Suggestions can propose notes; nothing changes here unless you
        accept it.
      </p>
      {NOTE_SCOPES.map((scope) => {
        const items = notesForScope(notes, scope);
        const full = items.length >= MAX_NOTES_PER_SCOPE;
        const info = NOTE_SCOPE_INFO[scope];
        return (
          <section key={scope} aria-labelledby={`notes-${scope}`}>
            <h3
              id={`notes-${scope}`}
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
                margin: 0,
              }}
            >
              {info.label}{' '}
              <span style={{ ...metaStyle, fontWeight: 400 }}>
                {items.length} of {MAX_NOTES_PER_SCOPE}
              </span>
            </h3>
            <p style={{ ...metaStyle, margin: '2px 0 var(--aparture-space-2)' }}>{info.help}</p>
            {items.length > 0 && (
              <ul
                style={{
                  listStyle: 'none',
                  margin: '0 0 var(--aparture-space-3)',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--aparture-space-3)',
                }}
              >
                {items.map((n) => (
                  <NoteRow
                    key={n.id}
                    note={n}
                    disabled={disabled}
                    onSave={(text) =>
                      onChange(
                        notes.map((x) => (x.id === n.id ? withEditedText(x, text) : x)),
                        { rationale: `Edited a ${info.label.toLowerCase()} note` }
                      )
                    }
                    onRemove={() =>
                      onChange(
                        notes.filter((x) => x.id !== n.id),
                        { rationale: `Removed a ${info.label.toLowerCase()} note` }
                      )
                    }
                  />
                ))}
              </ul>
            )}
            {!disabled &&
              (full ? (
                <p style={metaStyle}>
                  This scope is at its limit. Edit or remove a note to make room.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--aparture-space-2)' }}>
                  <input
                    type="text"
                    aria-label={`New ${info.label.toLowerCase()} note`}
                    value={drafts[scope] ?? ''}
                    maxLength={MAX_NOTE_CHARS}
                    onChange={(e) => setDrafts((d) => ({ ...d, [scope]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') add(scope);
                    }}
                    placeholder="Add a note in your own words"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '8px 12px',
                      background: 'var(--aparture-bg)',
                      color: 'var(--aparture-ink)',
                      border: '1px solid var(--aparture-hairline)',
                      borderRadius: '4px',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-sm)',
                    }}
                  />
                  <Button
                    variant="secondary"
                    disabled={!(drafts[scope] ?? '').trim()}
                    onClick={() => add(scope)}
                  >
                    Add
                  </Button>
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}
