import { useMemo, useState } from 'react';
import FeedbackHeader from './FeedbackHeader.jsx';
import GeneralCommentInput from './GeneralCommentInput.jsx';
import FeedbackFilters from './FeedbackFilters.jsx';
import FeedbackTimeline from './FeedbackTimeline.jsx';
import FeedbackEmptyState from './FeedbackEmptyState.jsx';

export default function FeedbackPanel({
  events,
  cutoff,
  briefingId,
  onAddGeneralComment,
  onSuggestClick,
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
      />

      <div style={{ marginBottom: 'var(--aparture-space-4)' }}>
        <GeneralCommentInput
          onSave={(text) => onAddGeneralComment?.(text, briefingId)}
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
