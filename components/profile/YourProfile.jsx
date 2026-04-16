import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import TextArea from '../ui/TextArea.jsx';
import MigrationNotice from './MigrationNotice.jsx';
import HistoryDropdown from './HistoryDropdown.jsx';

export default function YourProfile({
  profile,
  updateProfile,
  migrationNotice,
  dismissMigrationNotice,
  revertToRevision,
  clearHistory,
  newFeedback,
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

  // Break down new feedback by type for the suggest section
  const feedbackCounts = (newFeedback ?? []).reduce(
    (acc, e) => {
      if (e.type === 'star') acc.stars++;
      else if (e.type === 'dismiss') acc.dismisses++;
      else if (e.type === 'paper-comment' || e.type === 'general-comment') acc.comments++;
      else if (e.type === 'filter-override') acc.overrides++;
      return acc;
    },
    { stars: 0, dismisses: 0, comments: 0, overrides: 0 }
  );
  const totalNew = (newFeedback ?? []).length;

  const dateStr = profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'never';

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
          {/* Updated timestamp */}
          <div
            style={{
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-3)',
            }}
          >
            Updated {dateStr}
          </div>

          <TextArea
            value={currentDraft}
            onChange={(e) => setDraftContent(e.target.value)}
            readOnly={disabled}
            rows={8}
            style={{ minHeight: '10rem' }}
            placeholder="Describe your research interests in prose. This profile drives every pipeline stage and the briefing synthesis."
          />

          {/* Save / Discard buttons */}
          <div
            style={{
              marginTop: 'var(--aparture-space-3)',
              display: 'flex',
              gap: 'var(--aparture-space-2)',
            }}
          >
            <Button variant="primary" onClick={handleSave} disabled={disabled || !dirty}>
              Save changes
            </Button>
            <Button variant="secondary" onClick={handleDiscard} disabled={disabled || !dirty}>
              Discard
            </Button>
          </div>

          {/* Suggest improvements section */}
          <Card style={{ marginTop: 'var(--aparture-space-6)' }}>
            <h3
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
                margin: 0,
                marginBottom: 'var(--aparture-space-3)',
              }}
            >
              Suggest improvements
            </h3>

            {totalNew > 0 ? (
              <p
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-ink)',
                  lineHeight: 1.6,
                  margin: 0,
                  marginBottom: 'var(--aparture-space-3)',
                }}
              >
                <span style={{ color: 'var(--aparture-accent)', fontWeight: 600 }}>
                  {totalNew} new interaction{totalNew === 1 ? '' : 's'}
                </span>{' '}
                since your last revision
                {feedbackCounts.stars > 0 ||
                feedbackCounts.dismisses > 0 ||
                feedbackCounts.comments > 0
                  ? ': '
                  : '.'}
                {[
                  feedbackCounts.stars > 0 &&
                    `${feedbackCounts.stars} star${feedbackCounts.stars === 1 ? '' : 's'}`,
                  feedbackCounts.dismisses > 0 &&
                    `${feedbackCounts.dismisses} dismiss${feedbackCounts.dismisses === 1 ? '' : 'es'}`,
                  feedbackCounts.comments > 0 &&
                    `${feedbackCounts.comments} comment${feedbackCounts.comments === 1 ? '' : 's'}`,
                  feedbackCounts.overrides > 0 &&
                    `${feedbackCounts.overrides} filter override${feedbackCounts.overrides === 1 ? '' : 's'}`,
                ]
                  .filter(Boolean)
                  .join(', ')}
                .
              </p>
            ) : (
              <p
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  lineHeight: 1.6,
                  margin: 0,
                  marginBottom: 'var(--aparture-space-3)',
                }}
              >
                No new feedback since your last profile revision.
              </p>
            )}

            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                lineHeight: 1.6,
                margin: 0,
                marginBottom: 'var(--aparture-space-4)',
              }}
            >
              The briefing model will review your recent feedback and propose specific edits to your
              profile.
              {dirty ? ' Save or discard your unsaved changes first.' : ''}
            </p>

            <Button
              variant="primary"
              onClick={handleSuggest}
              disabled={disabled || dirty || totalNew === 0}
            >
              Suggest improvements →
            </Button>
          </Card>

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
