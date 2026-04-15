export default function StatusRow({ newInteractionCount, lastUpdated, onScrollToFeedback }) {
  const dateStr = lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'never';
  const hasCount = newInteractionCount > 0;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      {hasCount ? (
        <button
          type="button"
          onClick={onScrollToFeedback}
          className="text-red-400 hover:text-red-300 font-medium underline-offset-2 hover:underline"
        >
          {newInteractionCount} new interactions
        </button>
      ) : (
        <span>No new feedback</span>
      )}
      <span>·</span>
      <span>Updated {dateStr}</span>
    </div>
  );
}
