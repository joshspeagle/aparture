import { useState } from 'react';
import Button from '../ui/Button.jsx';
import TextArea from '../ui/TextArea.jsx';

export default function GeneralCommentInput({ onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');

  const handleSave = () => {
    onSave(text);
    setText('');
    setExpanded(false);
  };

  const handleCancel = () => {
    setText('');
    setExpanded(false);
  };

  const canSave = text.trim().length > 0;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-mute)',
          border: '1px solid var(--aparture-hairline)',
          borderRadius: '4px',
          padding: '8px 12px',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'var(--aparture-font-sans)',
        }}
      >
        + Add a comment
      </button>
    );
  }

  return (
    <div>
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="General comment on this week's briefing or your research interests..."
        style={{ minHeight: '8rem', marginBottom: 'var(--aparture-space-2)' }}
        autoFocus
      />
      <div
        style={{
          display: 'flex',
          gap: 'var(--aparture-space-2)',
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
