import { useMemo, useState } from 'react';
import FeedbackHeader from './FeedbackHeader.jsx';
import GeneralCommentInput from './GeneralCommentInput.jsx';
import ScopedCommentInput from './ScopedCommentInput.jsx';
import FeedbackFilters from './FeedbackFilters.jsx';
import FeedbackTimeline from './FeedbackTimeline.jsx';
import FeedbackEmptyState from './FeedbackEmptyState.jsx';

const BRIEFING_GENERAL_PLACEHOLDER =
  'e.g., "Theme 2 grouping is wrong — different topics." Or: "Exec summary missed the methodology angle." Or: "Lead with the diffusion-models cluster next time." Or: "Briefing nailed it."';

const RUN_FEEDBACK_PLACEHOLDER =
  'e.g., "Felt narrow this week — I expected more cosmology." Or: "Scoring was too compressed — everything scored 6-7." Or: "Quantum-info was over-filtered." Or: "Filter felt too aggressive overall." Or: "Run felt right — keep it as is."';

export default function FeedbackPanel({
  events,
  cutoff,
  briefingId,
  onAddGeneralComment,
  onSuggestClick,
  lastFeedbackCutoff,
  runFeedbackSavedText,
  onRunFeedback,
}) {
  const [filters, setFilters] = useState({
    type: 'all',
    newOnly: false,
    dateRange: 'all',
  });

  const counts = useMemo(
    () => ({
      newCount: events.filter((e) => e.timestamp > cutoff).length,
      totalCount: events.length,
    }),
    [events, cutoff]
  );

  const hasEvents = events.length > 0;

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
      <FeedbackHeader
        newCount={counts.newCount}
        totalCount={counts.totalCount}
        onSuggestClick={onSuggestClick}
        lastFeedbackCutoff={lastFeedbackCutoff}
      />

      <div style={{ marginBottom: 'var(--aparture-space-3, 12px)' }}>
        <ScopedCommentInput
          scope={{ kind: 'run' }}
          triggerLabel="+ feedback on this run"
          placeholder={RUN_FEEDBACK_PLACEHOLDER}
          savedText={runFeedbackSavedText}
          onSave={onRunFeedback}
        />
      </div>

      <div style={{ marginBottom: 'var(--aparture-space-4)' }}>
        <GeneralCommentInput
          onSave={(text) => onAddGeneralComment?.(text, briefingId)}
          placeholder={BRIEFING_GENERAL_PLACEHOLDER}
        />
      </div>

      <div style={{ marginBottom: 'var(--aparture-space-4)' }}>
        <FeedbackFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {hasEvents ? (
        <FeedbackTimeline events={events} filters={filters} cutoff={cutoff} />
      ) : (
        <FeedbackEmptyState />
      )}
    </section>
  );
}
