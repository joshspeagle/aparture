import { useMemo, useState } from 'react';
import FeedbackHeader from './FeedbackHeader.jsx';
import GeneralCommentInput from './GeneralCommentInput.jsx';
import FeedbackFilters from './FeedbackFilters.jsx';
import FeedbackTimeline from './FeedbackTimeline.jsx';
import FeedbackEmptyState from './FeedbackEmptyState.jsx';

export default function FeedbackPanel({ events, cutoff, onAddGeneralComment, onSuggestClick }) {
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
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 mb-6">
      <FeedbackHeader
        newCount={counts.newCount}
        totalCount={counts.totalCount}
        onSuggestClick={onSuggestClick}
      />

      <div className="mb-4">
        <GeneralCommentInput onSave={onAddGeneralComment} />
      </div>

      <div className="mb-4">
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
