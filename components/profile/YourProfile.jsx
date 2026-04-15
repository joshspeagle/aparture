import { useState } from 'react';
import StatusRow from './StatusRow.jsx';
import MigrationNotice from './MigrationNotice.jsx';
import HistoryDropdown from './HistoryDropdown.jsx';

export default function YourProfile({
  profile,
  updateProfile,
  migrationNotice,
  dismissMigrationNotice,
  revertToRevision,
  clearHistory,
  newInteractionCount,
  onScrollToFeedback,
  onPreviewClick,
  onSuggestClick,
  draftContent,
  setDraftContent,
  disabled = false,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const currentContent = profile?.content ?? '';
  const currentDraft = draftContent ?? currentContent;
  const dirty = currentDraft !== currentContent;

  const handleSave = () => {
    if (!dirty) return;
    updateProfile(currentDraft);
  };

  const handleDiscard = () => {
    setDraftContent(currentContent);
  };

  const handlePreview = () => {
    onPreviewClick?.();
  };

  const handleSuggest = () => {
    if (dirty) return;
    onSuggestClick?.();
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 mb-6">
      <MigrationNotice notice={migrationNotice} onDismiss={dismissMigrationNotice} />

      <header
        className="flex cursor-pointer items-center justify-between mb-3"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-100">Your Profile</h2>
          {dirty && (
            <span className="text-xs text-amber-400" aria-label="unsaved changes">
              ● Unsaved changes
            </span>
          )}
        </div>
        <span className="text-slate-400 text-sm" aria-hidden>
          {collapsed ? '▸' : '▾'}
        </span>
      </header>

      {!collapsed && (
        <>
          <div className="mb-3">
            <StatusRow
              newInteractionCount={newInteractionCount}
              lastUpdated={profile?.updatedAt}
              onScrollToFeedback={onScrollToFeedback}
            />
          </div>

          <textarea
            value={currentDraft}
            onChange={(e) => setDraftContent(e.target.value)}
            readOnly={disabled}
            rows={8}
            className="w-full min-h-[10rem] resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            placeholder="Describe your research interests in prose. This profile drives every pipeline stage and the briefing synthesis."
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled || !dirty}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={dirty ? 'Commit your changes as a new profile revision' : 'No changes to save'}
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={disabled || !dirty}
              className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={dirty ? 'Discard your unsaved changes' : 'Nothing to discard'}
            >
              Discard
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handlePreview}
              disabled={disabled}
              className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Preview how this profile (including unsaved changes) would affect filter + scoring + synthesis on your last analysis run"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={disabled || dirty}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                dirty
                  ? 'Save or discard your unsaved changes before requesting suggestions'
                  : 'Ask the model to suggest profile improvements based on your recent feedback'
              }
            >
              Suggest improvements
            </button>
          </div>

          <HistoryDropdown
            revisions={profile?.revisions ?? []}
            onRevert={revertToRevision}
            onClearHistory={clearHistory}
          />
        </>
      )}
    </section>
  );
}
