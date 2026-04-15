import { useState } from 'react';

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
        className="text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md px-3 py-2 w-full text-left"
      >
        + Add a comment
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="General comment on this week's briefing or your research interests…"
        className="w-full min-h-[8rem] resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleCancel}
          className="border border-slate-600 hover:border-slate-400 text-slate-200 px-3 py-1.5 rounded-md text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );
}
