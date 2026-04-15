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
  newInteractionCount,
  onScrollToFeedback,
  onPreviewClick,
  onSuggestClick,
  disabled = false,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 mb-6">
      <MigrationNotice notice={migrationNotice} onDismiss={dismissMigrationNotice} />

      <header
        className="flex cursor-pointer items-center justify-between mb-3"
        onClick={() => setCollapsed((c) => !c)}
      >
        <h2 className="text-base font-semibold text-slate-100">Your Profile</h2>
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
            value={profile?.content ?? ''}
            onChange={(e) => updateProfile(e.target.value)}
            readOnly={disabled}
            rows={8}
            className="w-full min-h-[10rem] resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            placeholder="Describe your research interests in prose. This profile drives every pipeline stage and the briefing synthesis."
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onPreviewClick}
              disabled={disabled}
              className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onSuggestClick}
              disabled={disabled}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suggest improvements
            </button>
          </div>

          <HistoryDropdown revisions={profile?.revisions ?? []} onRevert={revertToRevision} />
        </>
      )}
    </section>
  );
}
