import { useState } from 'react';
import Button from '../ui/Button.jsx';
import TextArea from '../ui/TextArea.jsx';
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

  const handleSuggest = () => {
    if (dirty) return;
    onSuggestClick?.();
  };

  return (
    <section
      style={{
        background: 'var(--aparture-surface)',
        border: '1px solid var(--aparture-hairline)',
        borderRadius: '8px',
        padding: 'var(--aparture-space-6)',
        marginBottom: 'var(--aparture-space-6)',
      }}
    >
      <MigrationNotice notice={migrationNotice} onDismiss={dismissMigrationNotice} />

      <header
        style={{
          display: 'flex',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--aparture-space-3)',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--aparture-space-3)' }}>
          <h2
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-base)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
              margin: 0,
            }}
          >
            Your Profile
          </h2>
          {dirty && (
            <span
              style={{
                fontSize: 'var(--aparture-text-xs)',
                color: '#f59e0b',
              }}
              aria-label="unsaved changes"
            >
              ● Unsaved changes
            </span>
          )}
        </div>
        <span
          style={{ color: 'var(--aparture-mute)', fontSize: 'var(--aparture-text-sm)' }}
          aria-hidden
        >
          {collapsed ? '▸' : '▾'}
        </span>
      </header>

      {!collapsed && (
        <>
          <div style={{ marginBottom: 'var(--aparture-space-3)' }}>
            <StatusRow
              newInteractionCount={newInteractionCount}
              lastUpdated={profile?.updatedAt}
              onScrollToFeedback={onScrollToFeedback}
            />
          </div>

          <TextArea
            value={currentDraft}
            onChange={(e) => setDraftContent(e.target.value)}
            readOnly={disabled}
            rows={8}
            style={{ minHeight: '10rem' }}
            placeholder="Describe your research interests in prose. This profile drives every pipeline stage and the briefing synthesis."
          />

          <div
            style={{
              marginTop: 'var(--aparture-space-3)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--aparture-space-2)',
            }}
          >
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={disabled || !dirty}
              title={dirty ? 'Commit your changes as a new profile revision' : 'No changes to save'}
            >
              Save changes
            </Button>
            <Button
              variant="secondary"
              onClick={handleDiscard}
              disabled={disabled || !dirty}
              title={dirty ? 'Discard your unsaved changes' : 'Nothing to discard'}
            >
              Discard
            </Button>
            <div style={{ flex: 1 }} />
            <Button
              variant="secondary"
              onClick={onPreviewClick}
              disabled={disabled}
              title="Preview how this profile (including unsaved changes) would affect filter + scoring + synthesis on your last analysis run"
            >
              Preview
            </Button>
            <Button
              variant="primary"
              onClick={handleSuggest}
              disabled={disabled || dirty}
              title={
                dirty
                  ? 'Save or discard your unsaved changes before requesting suggestions'
                  : 'Ask the model to suggest profile improvements based on your recent feedback'
              }
            >
              Suggest improvements
            </Button>
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
