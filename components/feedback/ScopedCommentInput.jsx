import { useState } from 'react';
import TextArea from '../ui/TextArea.jsx';

export default function ScopedCommentInput({
  scope: _scope,
  triggerLabel,
  placeholder,
  savedText = '',
  onSave,
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(savedText);

  if (!expanded && savedText) {
    return (
      <div>
        <button
          onClick={() => setExpanded(true)}
          style={{
            padding: '5px 12px',
            borderRadius: '12px',
            fontSize: 'var(--aparture-text-xs, 12px)',
            border: '1px solid var(--aparture-info-border, #93c5fd)',
            color: 'var(--aparture-info-text, #1e3a8a)',
            background: 'var(--aparture-info-soft, #eff6ff)',
            cursor: 'pointer',
          }}
        >
          — feedback saved
        </button>
        <div
          style={{
            marginTop: '6px',
            fontSize: 'var(--aparture-text-xs, 12px)',
            fontStyle: 'italic',
            color: 'var(--aparture-mute, #6b7280)',
            lineHeight: 1.4,
          }}
        >
          {savedText}
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          padding: '5px 12px',
          borderRadius: '12px',
          fontSize: 'var(--aparture-text-xs, 12px)',
          border: '1px dashed var(--aparture-border, #cbd5e1)',
          color: 'var(--aparture-mute, #64748b)',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        {triggerLabel}
      </button>
    );
  }

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setExpanded(false);
      return;
    }
    onSave(trimmed);
    setExpanded(false);
  };

  const handleCancel = () => {
    setText(savedText);
    setExpanded(false);
  };

  return (
    <div>
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ minHeight: 'unset' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        <button
          onClick={handleCancel}
          style={{
            padding: '4px 12px',
            fontSize: 'var(--aparture-text-xs, 12px)',
            borderRadius: '6px',
            border: '1px solid var(--aparture-border, #d1d5db)',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '4px 12px',
            fontSize: 'var(--aparture-text-xs, 12px)',
            borderRadius: '6px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          save
        </button>
      </div>
    </div>
  );
}
